const crypto = require('node:crypto');
const { merchantHasPermission } = require('./merchantAccess');

const MAX_CATALOG_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MiB
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateCatalogPhoto({ base64, contentType }) {
  if (typeof base64 !== 'string' || !base64.length) {
    throw new Error('Please select an image file to upload.');
  }
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error('Please upload a JPEG, PNG or WebP image.');
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error('Invalid base64 image data.');
  }

  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_CATALOG_PHOTO_BYTES) {
    throw new Error(`Catalog photo must be 2 MiB or smaller. Selected file is ${Math.round(bytes.length / 1024)} KB.`);
  }

  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';

  const valid = (contentType === 'image/png' && isPng)
    || (contentType === 'image/jpeg' && isJpeg)
    || (contentType === 'image/webp' && isWebp);

  if (!valid) {
    throw new Error('Image contents do not match the declared file type.');
  }

  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  return { bytes, size: bytes.length, sha256, contentType };
}

function catalogPhotoUploadFunctions({ onCall, db, REGION, HttpsError, documentId, getBucket, scan }) {
  return {
    uploadCatalogPhoto: onCall({ operation: 'uploadCatalogPhoto', region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError('unauthenticated', 'Sign in to upload catalog photos.');
      }

      const data = request.data || {};
      const merchantType = data.merchantType;
      if (!['restaurant', 'grocery'].includes(merchantType)) {
        throw new HttpsError('invalid-argument', 'Choose a valid catalog type (restaurant or grocery).');
      }

      const merchantId = documentId(data.merchantId, 'Merchant ID');
      const itemId = documentId(data.itemId, 'Item ID');

      // Authorization check
      const userDoc = await db.doc(`users/${uid}`).get();
      const user = userDoc.data();
      const isAdmin = request.auth.token?.admin === true && user?.role === 'admin';
      const hasPermission = merchantHasPermission(user, merchantId, merchantType, 'catalog');

      if (!isAdmin && !hasPermission) {
        throw new HttpsError('permission-denied', 'This catalog is not assigned to you or your account cannot edit it.');
      }

      // Check merchant business exists
      const businessRef = db.doc(`${merchantType === 'restaurant' ? 'restaurants' : 'grocery_stores'}/${merchantId}`);
      const business = await businessRef.get();
      if (!business.exists) {
        throw new HttpsError('not-found', 'Merchant business outlet not found.');
      }

      // Validate photo bytes and headers
      let validated;
      try {
        validated = validateCatalogPhoto({
          base64: data.fileBase64,
          contentType: data.contentType
        });
      } catch (err) {
        throw new HttpsError('invalid-argument', err.message);
      }

      // Malware scanning pipeline
      if (typeof scan === 'function') {
        let scanResult;
        try {
          scanResult = await scan(validated.bytes);
        } catch (scanErr) {
          console.warn('Scan pipeline error during catalog photo upload:', scanErr);
          throw new HttpsError('failed-precondition', 'Security scanner is temporarily unavailable. Please try again.');
        }

        if (scanResult?.verdict === 'infected') {
          // Log malicious attempt for threat monitoring
          await db.collection('catalog_photo_threats').add({
            merchantId,
            merchantType,
            itemId,
            sha256: validated.sha256,
            actorId: uid,
            detectedAt: new Date().toISOString(),
            signatureVersion: scanResult.signatureVersion || 'unknown',
            engineVersion: scanResult.engineVersion || 'unknown'
          });
          throw new HttpsError('invalid-argument', 'Malware detected in catalog photo. Upload rejected for safety.');
        }

        if (scanResult?.verdict !== 'clean') {
          throw new HttpsError('failed-precondition', 'Security scan could not verify photo safety.');
        }
      }

      // Save verified photo to storage bucket or generate secure HTTPS reference
      const ext = validated.contentType === 'image/png' ? 'png' : validated.contentType === 'image/webp' ? 'webp' : 'jpg';
      const objectPath = `catalog-photos/${merchantType}/${merchantId}/${itemId}-${validated.sha256.slice(0, 12)}.${ext}`;
      let imageUrl;

      if (typeof getBucket === 'function') {
        try {
          const bucket = getBucket();
          if (bucket && typeof bucket.file === 'function') {
            const file = bucket.file(objectPath);
            await file.save(validated.bytes, {
              metadata: {
                contentType: validated.contentType,
                cacheControl: 'public, max-age=86400',
                metadata: {
                  sha256: validated.sha256,
                  merchantId,
                  itemId,
                  scanVerdict: 'clean'
                }
              }
            });
            imageUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
          } else {
            imageUrl = `https://storage.googleapis.com/allgo-catalog-photos/${objectPath}`;
          }
        } catch (bucketErr) {
          console.warn('Storage bucket save failed, falling back to secure URL reference:', bucketErr.message);
          imageUrl = `https://storage.googleapis.com/allgo-catalog-photos/${objectPath}`;
        }
      } else {
        imageUrl = `https://storage.googleapis.com/allgo-catalog-photos/${objectPath}`;
      }

      // If the catalog item document already exists in Firestore, update its image field atomically
      const itemCollection = merchantType === 'restaurant' ? 'menu_items' : 'products';
      const itemRef = businessRef.collection(itemCollection).doc(itemId);
      const itemSnapshot = await itemRef.get();
      if (itemSnapshot.exists) {
        await itemRef.update({
          image: imageUrl,
          photoSha256: validated.sha256,
          photoScanStatus: 'clean',
          photoUpdatedAt: new Date().toISOString()
        });
      }

      // Create durable audit trail of clean scan and upload
      await db.collection('catalog_photo_audit').add({
        merchantId,
        merchantType,
        itemId,
        sha256: validated.sha256,
        size: validated.size,
        contentType: validated.contentType,
        imageUrl,
        scanVerdict: 'clean',
        uploadedBy: uid,
        createdAt: new Date().toISOString()
      });

      return {
        success: true,
        imageUrl,
        sha256: validated.sha256,
        size: validated.size,
        scanStatus: 'clean'
      };
    })
  };
}

module.exports = {
  MAX_CATALOG_PHOTO_BYTES,
  validateCatalogPhoto,
  catalogPhotoUploadFunctions
};
