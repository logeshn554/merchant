const crypto = require('node:crypto');
const { merchantOpen } = require('./merchantPolicy');
const { productWithinExpiry } = require('./productExpiry');
const { validPoint } = require('./bookingPolicy');
const { distanceKm } = require('./dispatchPolicy');

function words(value) {
  return typeof value === 'string'
    ? [...new Set(value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || [])].slice(0, 30)
    : [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function matchesTerm(word, term) {
  if (!word || !term) return false;
  if (word.startsWith(term)) return true;
  if (term.length >= 4) {
    const prefix1 = word.slice(0, term.length);
    if (levenshtein(prefix1, term) <= 1) return true;
    if (word.length >= term.length + 1) {
      const prefix2 = word.slice(0, term.length + 1);
      if (levenshtein(prefix2, term) <= 1) return true;
    }
  }
  return false;
}

function searchRecord(service, parentId, itemId, item) {
  if (
    !['food', 'grocery'].includes(service) ||
    ![parentId, itemId].every(value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\/\x00-\x1f]/.test(value)) ||
    !item ||
    typeof item.name !== 'string' ||
    !item.name.trim() ||
    item.name.length > 120 ||
    item.archived === true
  ) return null;

  const terms = words(`${item.name} ${typeof item.category === 'string' ? item.category.slice(0, 80) : ''}`);
  const prefixes = [...new Set(terms.flatMap(term => Array.from({ length: Math.max(0, Math.min(term.length, 24) - 1) }, (_, index) => term.slice(0, index + 2))))];
  return { service, parentId, itemId, terms, prefixes, schemaVersion: 1 };
}

function searchId(service, parentId, itemId) {
  return crypto.createHash('sha256').update(JSON.stringify([service, parentId, itemId])).digest('hex');
}

async function syncSearchDocument(db, service, parentId, itemId) {
  const source = db.doc(`${service === 'food' ? 'restaurants' : 'grocery_stores'}/${parentId}/${service === 'food' ? 'menu_items' : 'products'}/${itemId}`);
  const target = db.doc(`catalog_search/${searchId(service, parentId, itemId)}`);
  await db.runTransaction(async tx => {
    const latest = await tx.get(source);
    const record = searchRecord(service, parentId, itemId, latest.data());
    if (record) tx.set(target, record);
    else tx.delete(target);
  });
}

function catalogSearchFunctions({ onCall, onDocumentWritten, db, REGION, databaseId, HttpsError, documentId, cleanText }) {
  const trigger = service => onDocumentWritten(
    { region: REGION, database: databaseId, document: service === 'food' ? 'restaurants/{merchantId}/menu_items/{itemId}' : 'grocery_stores/{merchantId}/products/{itemId}', retry: true },
    event => syncSearchDocument(db, service, event.params.merchantId, event.params.itemId)
  );

  return {
    indexFoodCatalog: trigger('food'),
    indexGroceryCatalog: trigger('grocery'),
    searchPublishedCatalog: onCall({ operation: 'searchPublishedCatalog', region: REGION }, async request => {
      const text = cleanText(request.data?.text, 'Search', 100);
      const terms = words(text).slice(0, 5);
      if (!terms.length || terms[0].length < 2) {
        throw new HttpsError('invalid-argument', 'Enter at least two letters of an item name.');
      }

      const customerLocation = request.data?.location;
      const hasCustomerLocation = validPoint(customerLocation);

      let search = db.collection('catalog_search').where('prefixes', 'array-contains', terms[0].slice(0, 24)).orderBy('__name__').limit(51);
      if (request.data?.cursor) {
        search = search.startAfter(documentId(request.data.cursor, 'Search cursor'));
      }

      const [snapshot, foodPricing, groceryPricing] = await Promise.all([
        search.get(),
        db.doc('service_pricing/food').get(),
        db.doc('service_pricing/grocery').get()
      ]);

      const pricing = { food: foodPricing.data(), grocery: groceryPricing.data() };
      const page = snapshot.docs.slice(0, 50);

      const candidates = page.filter(record => {
        const data = record.data();
        return ['food', 'grocery'].includes(data.service) &&
          pricing[data.service]?.enabled === true &&
          terms.every(term => data.terms?.some(word => matchesTerm(word, term)));
      });

      const items = (await Promise.all(candidates.map(async record => {
        const data = record.data();
        const parentPath = `${data.service === 'food' ? 'restaurants' : 'grocery_stores'}/${documentId(data.parentId, 'Merchant ID')}`;
        const [parent, item] = await Promise.all([
          db.doc(parentPath).get(),
          db.doc(`${parentPath}/${data.service === 'food' ? 'menu_items' : 'products'}/${documentId(data.itemId, 'Item ID')}`).get()
        ]);

        const live = item.data();
        const merchantData = parent.data();

        if (
          !parent.exists ||
          !item.exists ||
          live.archived === true ||
          live.available === false ||
          (data.service === 'grocery' && (!productWithinExpiry(live) || !Number.isSafeInteger(live.stock) || live.stock < 1)) ||
          !Number.isFinite(live.price) ||
          live.price <= 0 ||
          !terms.every(term => words(`${live.name} ${live.category || ''}`).some(word => matchesTerm(word, term)))
        ) {
          return null;
        }

        try {
          if (!merchantOpen(merchantData) || typeof merchantData.name !== 'string' || !merchantData.name.trim()) {
            return null;
          }
        } catch {
          return null;
        }

        let deliverable = false;
        let deliveryDistanceKm = null;

        if (hasCustomerLocation) {
          const merchantLoc = merchantData.location;
          if (validPoint(merchantLoc)) {
            const maxRadius = Number(merchantData.deliveryRadiusKm || 10);
            const km = distanceKm(merchantLoc, customerLocation);
            deliveryDistanceKm = Math.round(km * 10) / 10;
            if (km <= maxRadius) {
              deliverable = true;
            }
          }
        }

        return {
          id: record.id,
          itemId: item.id,
          parentId: parent.id,
          service: data.service,
          name: live.name,
          parentName: merchantData.name,
          price: live.price,
          deliverable,
          deliveryDistanceKm,
          openNow: true,
        };
      }))).filter(Boolean);

      // coverageConfirmed is strictly true only when customer coordinates were provided
      // and every returned candidate is confirmed deliverable to that address.
      const coverageConfirmed = hasCustomerLocation && items.length > 0 && items.every(item => item.deliverable);

      return {
        items,
        nextCursor: snapshot.size > 50 ? page.at(-1).id : null,
        coverageConfirmed,
      };
    })
  };
}

module.exports = {
  words,
  levenshtein,
  matchesTerm,
  searchRecord,
  searchId,
  syncSearchDocument,
  catalogSearchFunctions,
};
