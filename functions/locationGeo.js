const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const { validPoint } = require('./bookingPolicy');
const { distanceKm } = require('./dispatchPolicy');

/**
 * Standard geohash encoder.
 * Precision 5: ~4.9km x ~4.9km (neighborhood/zone)
 * Precision 6: ~1.2km x ~0.61km (sub-zone)
 * Precision 7: ~153m x ~153m (hyper-local)
 */
function encodeGeohash(lat, lng, precision = 6) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let hash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }
    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/**
 * Computes the 8 surrounding geohash boxes for a given geohash prefix
 * to guarantee complete bounding-box coverage regardless of boundary edges.
 */
function decodeBBox(geohash) {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let isEven = true;

  for (let i = 0; i < geohash.length; i++) {
    const cd = BASE32.indexOf(geohash[i]);
    if (cd === -1) break;
    for (let mask = 16; mask > 0; mask >>= 1) {
      if (isEven) {
        const mid = (lngMin + lngMax) / 2;
        if (cd & mask) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (cd & mask) latMin = mid;
        else latMax = mid;
      }
      isEven = !isEven;
    }
  }
  return { latMin, latMax, lngMin, lngMax };
}

function getGeohashNeighbors(geohash) {
  if (!geohash || geohash.length === 0) return [];
  const bbox = decodeBBox(geohash);
  const latSpan = bbox.latMax - bbox.latMin;
  const lngSpan = bbox.lngMax - bbox.lngMin;
  const centerLat = (bbox.latMin + bbox.latMax) / 2;
  const centerLng = (bbox.lngMin + bbox.lngMax) / 2;

  const neighbors = new Set([geohash]);
  const offsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (const [dLat, dLng] of offsets) {
    let nLat = centerLat + dLat * latSpan;
    let nLng = centerLng + dLng * lngSpan;
    if (nLat > 90) nLat = 90;
    if (nLat < -90) nLat = -90;
    if (nLng > 180) nLng -= 360;
    if (nLng < -180) nLng += 360;
    neighbors.add(encodeGeohash(nLat, nLng, geohash.length));
  }

  return [...neighbors];
}

/**
 * Validates incoming location ping against freshness, accuracy, and anti-spoofing constraints.
 */
function validateLocationUpdate(location, accuracy, metadata = {}, now = Date.now()) {
  if (!validPoint(location)) {
    return { valid: false, reason: 'Invalid latitude or longitude coordinates.' };
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    return { valid: false, reason: 'A fresh device position accurate to within 100 metres is required.' };
  }
  if (metadata.isMock === true || metadata.mockDetected === true) {
    return { valid: false, reason: 'Mock location providers and spoofed GPS are prohibited.' };
  }
  if (metadata.timestamp) {
    const ts = Date.parse(metadata.timestamp);
    if (Number.isFinite(ts)) {
      if (now - ts > 60000) {
        return { valid: false, reason: 'Location timestamp is older than 60 seconds.' };
      }
      if (ts > now + 5000) {
        return { valid: false, reason: 'Location timestamp is in the future.' };
      }
    }
  }
  return { valid: true };
}

/**
 * Determines whether a breadcrumb should be recorded to persistent trip history.
 * Sampled at most once per 10 seconds or when displacement exceeds 25 meters.
 */
function shouldSampleBreadcrumb(lastBreadcrumb, currentPoint, now = Date.now(), minIntervalMs = 10000, minDistanceMeters = 25) {
  if (!lastBreadcrumb || !lastBreadcrumb.timestamp) return true;
  const elapsed = now - Date.parse(lastBreadcrumb.timestamp);
  if (elapsed >= minIntervalMs) return true;
  if (lastBreadcrumb.lat != null && lastBreadcrumb.lng != null && currentPoint?.lat != null && currentPoint?.lng != null) {
    const km = distanceKm({ lat: lastBreadcrumb.lat, lng: lastBreadcrumb.lng }, currentPoint);
    if (km * 1000 >= minDistanceMeters) return true;
  }
  return false;
}

module.exports = {
  encodeGeohash,
  decodeBBox,
  getGeohashNeighbors,
  validateLocationUpdate,
  shouldSampleBreadcrumb,
  distanceKm,
};
