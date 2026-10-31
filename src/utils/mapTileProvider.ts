/**
 * Production Leaflet Map Tile Provider & Reliability Utility
 * Supports configurable tile providers (OSM, CartoDB Voyager/Positron),
 * graceful offline/failure tile fallbacks, and memory leak prevention.
 */

export type MapTileProvider = 'osm' | 'cartodb' | 'cartodb_voyager' | 'cartodb_positron' | 'cartodb_dark';

export interface TileProviderConfig {
  url: string;
  subdomains: string[];
  maxZoom: number;
  attribution: string;
}

export const OFFLINE_TILE_FALLBACK_SVG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="#0f172a"/>
    <path d="M0 0 L256 256 M256 0 L0 256" stroke="#1e293b" stroke-width="0.8"/>
    <rect x="28" y="112" width="200" height="32" rx="6" fill="#1e293b" fill-opacity="0.9"/>
    <text x="128" y="132" fill="#64748b" font-size="11" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="600" text-anchor="middle">Offline Map Area</text>
  </svg>`
);

export const TILE_PROVIDERS: Record<string, TileProviderConfig> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  cartodb: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  cartodb_voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  cartodb_positron: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  cartodb_dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

export function getMapTileConfig(provider?: string): TileProviderConfig {
  const envProvider = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MAP_TILE_PROVIDER) as string;
  const customUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MAP_TILE_URL;

  const key = provider || envProvider || 'osm';
  const baseConfig = TILE_PROVIDERS[key] || (key.startsWith('cartodb') ? TILE_PROVIDERS.cartodb : TILE_PROVIDERS.osm);

  if (customUrl && typeof customUrl === 'string') {
    return {
      ...baseConfig,
      url: customUrl,
    };
  }

  return baseConfig;
}

export interface CreateTileLayerOptions {
  provider?: string;
  maxZoom?: number;
  onTileError?: (err: any) => void;
}

export function createProductionTileLayer(L: any, options: CreateTileLayerOptions = {}) {
  const config = getMapTileConfig(options.provider);
  const maxZoom = options.maxZoom || config.maxZoom;

  const tileLayer = L.tileLayer(config.url, {
    maxZoom,
    subdomains: config.subdomains,
    attribution: config.attribution,
    crossOrigin: true,
  });

  // Handle tile load errors gracefully (offline, timeout, rate limit) to avoid broken grey boxes
  tileLayer.on('tileerror', (event: any) => {
    if (event?.tile && !event.tile._allgoTileFallbackApplied) {
      event.tile._allgoTileFallbackApplied = true;
      event.tile.src = OFFLINE_TILE_FALLBACK_SVG;
    }
    if (options.onTileError) {
      try {
        options.onTileError(event);
      } catch {
        // ignore callback error
      }
    }
  });

  return tileLayer;
}

/**
 * Safely cleans up a Leaflet Map instance and its DOM container
 * to prevent memory leaks and "Map container is already initialized" crashes on remount.
 */
export function cleanupLeafletInstance(map: any, container?: HTMLElement | null) {
  const domContainer = container || (map && typeof map.getContainer === 'function' ? map.getContainer() : null);
  if (map) {
    try {
      map.eachLayer((layer: any) => {
        try {
          if (layer.off) layer.off();
          map.removeLayer(layer);
        } catch {
          // ignore layer removal error
        }
      });
      map.off();
      map.remove();
    } catch (e) {
      console.warn('Error during Leaflet map cleanup:', e);
    }
  }
  if (domContainer) {
    try {
      delete (domContainer as any)._leaflet_id;
    } catch {
      // ignore
    }
  }
}
