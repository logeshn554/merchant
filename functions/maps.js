const { HttpsError } = require('firebase-functions/v2/https');
const { validPoint } = require('./bookingPolicy');
const { distanceKm } = require('./dispatchPolicy');

const SERVICE_COUNTRY = process.env.MAPS_COUNTRY || 'IN';

// In-memory LRU Cache with TTL to protect billing and prevent redundant queries
const cache = new Map();
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 3600 * 1000; // 1 hour

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value, ttl = CACHE_TTL_MS) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

async function geocode(key, parameters) {
  const country = parameters.country || SERVICE_COUNTRY;
  const cacheKey = `geocode:${JSON.stringify(parameters)}:${country}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 1. If key is provided and not a placeholder, attempt Google Geocoding API
  if (key && key !== 'mock_key' && key !== 'free_osm') {
    const query = new URLSearchParams({
      ...parameters,
      components: parameters.components || `country:${country}`,
      key,
    });
    let response;
    try { response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${query}`, { signal: AbortSignal.timeout(10000) }); }
    catch { /* fall through to OpenStreetMap fallback */ }
    if (response && response.ok) {
      const payload = await response.json();
      if (payload.status === 'ZERO_RESULTS') {
        setCached(cacheKey, []);
        return [];
      }
      if (payload.status === 'OK' && Array.isArray(payload.results)) {
        const results = (payload.results || [])
          .filter(result => result.place_id && validPoint(result.geometry?.location))
          .slice(0, 5)
          .map(result => ({
            placeId: result.place_id,
            address: result.formatted_address,
            location: result.geometry.location,
            partialMatch: result.partial_match === true,
          }));
        setCached(cacheKey, results);
        return results;
      }
    }
  }

  // 2. Free OpenStreetMap (Nominatim) Fallback — zero Google billing
  try {
    let url;
    if (parameters.latlng) {
      const [lat, lng] = parameters.latlng.split(',');
      url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat.trim())}&lon=${encodeURIComponent(lng.trim())}&addressdetails=1`;
    } else if (parameters.address) {
      url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parameters.address)}&countrycodes=${country.toLowerCase()}&limit=5&addressdetails=1`;
    }

    if (url) {
      const osmRes = await fetch(url, {
        headers: { 'User-Agent': 'AllGo-OpenPlatform/1.0' },
        signal: AbortSignal.timeout(6000),
      });
      if (osmRes.ok) {
        const osmData = await osmRes.json();
        const items = Array.isArray(osmData) ? osmData : [osmData];
        const results = items
          .filter(i => i && i.lat && i.lon)
          .slice(0, 5)
          .map(item => ({
            placeId: String(item.place_id || item.osm_id),
            address: item.display_name,
            location: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
            partialMatch: false,
          }))
          .filter(res => validPoint(res.location));
        if (results.length > 0) {
          setCached(cacheKey, results);
          return results;
        }
      }
    }
  } catch {
    // network issue, proceed to default error check
  }

  if (!key) throw new HttpsError('failed-precondition', 'MAPS_API_KEY is not configured.');
  return [];
}

async function autocomplete(key, { input, sessionToken, country = SERVICE_COUNTRY } = {}) {
  if (!input || typeof input !== 'string' || input.trim().length < 3) {
    return [];
  }
  const cleanInput = input.trim();
  const cacheKey = `autocomplete:${cleanInput.toLowerCase()}:${country}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 1. Google Places Autocomplete if key is available
  if (key && key !== 'mock_key' && key !== 'free_osm') {
    const query = new URLSearchParams({
      input: cleanInput,
      components: `country:${country.toLowerCase()}`,
      ...(sessionToken ? { sessiontoken: sessionToken } : {}),
      key,
    });
    let response;
    try {
      response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${query}`, { signal: AbortSignal.timeout(6000) });
    } catch {
      // fall through to Nominatim
    }
    if (response && response.ok) {
      const payload = await response.json();
      if (payload.status === 'OK' && Array.isArray(payload.predictions)) {
        const results = payload.predictions.slice(0, 5).map(p => ({
          placeId: p.place_id,
          description: p.description,
          mainText: p.structured_formatting?.main_text || p.description,
          secondaryText: p.structured_formatting?.secondary_text || '',
        }));
        setCached(cacheKey, results);
        return results;
      }
      if (payload.status === 'ZERO_RESULTS') {
        setCached(cacheKey, []);
        return [];
      }
    }
  }

  // 2. OpenStreetMap (Nominatim) Fallback
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanInput)}&countrycodes=${country.toLowerCase()}&limit=5&addressdetails=1`;
    const osmRes = await fetch(url, {
      headers: { 'User-Agent': 'AllGo-OpenPlatform/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      const items = Array.isArray(osmData) ? osmData : [osmData];
      const results = items
        .filter(i => i && (i.place_id || i.osm_id))
        .slice(0, 5)
        .map(item => ({
          placeId: String(item.place_id || item.osm_id),
          description: item.display_name,
          mainText: item.name || (item.display_name ? item.display_name.split(',')[0].trim() : cleanInput),
          secondaryText: item.display_name ? item.display_name.split(',').slice(1).join(',').trim() : '',
        }));
      setCached(cacheKey, results);
      return results;
    }
  } catch {
    // network issue
  }

  if (!key) {
    throw new HttpsError('failed-precondition', 'MAPS_API_KEY is not configured.');
  }
  return [];
}

async function routeBetween(key, pickup, drop, travelMode = 'DRIVE', routingPreference = 'TRAFFIC_UNAWARE') {
  if (!['DRIVE', 'TWO_WHEELER'].includes(travelMode)) throw new HttpsError('failed-precondition', 'The service route mode is invalid.');
  if (!['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE'].includes(routingPreference)) throw new HttpsError('failed-precondition', 'The service route traffic preference is invalid.');

  // 1. If key is provided and not a placeholder, attempt Google Routes API
  if (key && key !== 'mock_key' && key !== 'free_osm') {
    let response;
    try {
      response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' },
        body: JSON.stringify({
          origin: pickup.placeId ? { placeId: pickup.placeId } : { location: { latLng: { latitude: pickup.location.lat, longitude: pickup.location.lng } } },
          destination: { placeId: drop.placeId }, travelMode, routingPreference,
        }),
      });
    } catch { /* fall through to mathematical haversine fallback */ }
    if (response && response.ok) {
      const payload = await response.json(), route = payload.routes?.[0];
      const durationSeconds = typeof route?.duration === 'string' && /^\d+(\.\d+)?s$/.test(route.duration) ? Number(route.duration.slice(0, -1)) : NaN;
      if (route && Number.isFinite(route.distanceMeters) && Number.isFinite(durationSeconds)) {
        return { distanceMeters: route.distanceMeters, durationSeconds };
      }
    }
  }

  // 2. Free Math-Based Route Calculation (Haversine + Urban Winding Factor)
  if (pickup?.location && drop?.location && validPoint(pickup.location) && validPoint(drop.location)) {
    const straightKm = distanceKm(pickup.location.lat, pickup.location.lng, drop.location.lat, drop.location.lng);
    const roadMeters = Math.round(straightKm * 1250); // 1.25x road factor for Indian city traffic
    const durationSeconds = Math.max(120, Math.round(roadMeters / 7)); // ~25 km/h urban average speed
    return { distanceMeters: roadMeters, durationSeconds };
  }

  throw new HttpsError('failed-precondition', 'No supported route connects these addresses.');
}

async function mapPreview(key, location, zoom = 16) {
  if (!validPoint(location) || !Number.isInteger(zoom) || zoom < 14 || zoom > 18) throw new HttpsError('invalid-argument', 'A valid map location and zoom are required.');

  // 1. If key is provided and not a placeholder, attempt Google Static Maps
  if (key && key !== 'mock_key' && key !== 'free_osm') {
    const query = new URLSearchParams({ center: `${location.lat},${location.lng}`, zoom: String(zoom), size: '640x400', scale: '2', maptype: 'roadmap', format: 'png32', key });
    let response;
    try { response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${query}`, { signal: AbortSignal.timeout(10000) }); }
    catch { /* fall through */ }
    if (response && response.ok && response.headers.get('content-type')?.startsWith('image/png')) {
      const image = Buffer.from(await response.arrayBuffer());
      if (image.length && image.length <= 2_000_000) {
        return { image: image.toString('base64') };
      }
    }
  }

  if (!key) throw new HttpsError('failed-precondition', 'Map preview is not configured yet.');
  // Lightweight 1x1 transparent PNG fallback for zero-cost operation
  const fallbackPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  return { image: fallbackPng };
}

module.exports = {
  geocode,
  autocomplete,
  routeBetween,
  mapPreview,
  clearCacheForTesting: () => cache.clear(),
};
