import { useRef, useState, useEffect } from 'react';
import { MapPin, LoaderCircle, Search, Navigation } from 'lucide-react';
import {
  searchServiceLocations,
  reverseServiceLocation,
  autocompleteServiceLocations,
  type ServiceLocation
} from '../data/firestoreHelper';
import { fetchCurrentPosition } from '../location/useCurrentLocation';
import { createProductionTileLayer, cleanupLeafletInstance, type MapTileProvider } from '../utils/mapTileProvider';

export interface LocationPickerProps {
  label: string;
  initialAddress?: string;
  initialLocation?: ServiceLocation | null;
  disabled?: boolean;
  className?: string;
  tileProvider?: MapTileProvider;
  onSelect: (location: ServiceLocation | null) => void;
}

export default function LocationPicker({
  label,
  initialAddress = '',
  initialLocation,
  disabled,
  className = '',
  tileProvider,
  onSelect
}: LocationPickerProps) {
  const [text, setText] = useState(initialLocation?.address || initialAddress);
  const [selected, setSelected] = useState<ServiceLocation | null>(initialLocation || null);
  const [results, setResults] = useState<ServiceLocation[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);

  const revision = useRef(0);
  const mapElementRef = useRef<HTMLDivElement>(null);
  const leafletInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const tileLayerInstanceRef = useRef<any>(null);
  const prevTileProviderRef = useRef<string | undefined>(tileProvider);

  // Debounced Type-Ahead Autocomplete Suggestions (300ms, min 3 chars)
  useEffect(() => {
    if (disabled || text.trim().length < 3 || (selected && selected.address === text)) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const version = ++revision.current;
      try {
        const res = await autocompleteServiceLocations(text.trim());
        if (version === revision.current) {
          const list = (res as any)?.suggestions || [];
          setSuggestions(list);
        }
      } catch {
        // Fallback to Geocoding
        try {
          const locations = await searchServiceLocations(text.trim());
          if (version === revision.current) {
            setResults(locations);
          }
        } catch {
          // ignore
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [text, selected, disabled]);

  // Reverse geocode on pin move / drop
  const resolvePinCoordinates = async (lat: number, lng: number) => {
    const version = ++revision.current;
    setBusy(true);
    setError('');
    try {
      const locations = await reverseServiceLocation(lat, lng);
      if (version === revision.current) {
        const resolved = locations.find(loc => !loc.partialMatch);
        if (resolved) {
          setSelected(resolved);
          setText(resolved.address);
          onSelect(resolved);
          setResults([]);
        } else if (locations.length > 0) {
          setResults(locations);
          setError('Partial address match at pin. Move the pin closer to a marked road or building.');
        } else {
          setError('No address found at this pin. Move it or enter address manually.');
        }
      }
    } catch (err: any) {
      if (version === revision.current) {
        setError(err instanceof Error ? err.message : 'Could not resolve address for this pin.');
      }
    } finally {
      if (version === revision.current) setBusy(false);
    }
  };

  // Interactive Leaflet Map initialization and draggable pin (Zoom 12-19)
  useEffect(() => {
    if (!mapOpen || typeof window === 'undefined' || !mapElementRef.current || !mapCenter) return;

    let isMounted = true;
    import('leaflet').then(L => {
      if (!isMounted || !mapElementRef.current) return;

      const container = mapElementRef.current;

      // Initialize map once if not already initialized
      if (!leafletInstanceRef.current) {
        if ((container as any)._leaflet_id) {
          delete (container as any)._leaflet_id;
        }

        const map = L.map(container, {
          center: [mapCenter.lat, mapCenter.lng],
          zoom: mapZoom,
          minZoom: 12,
          maxZoom: 19,
          zoomControl: false,
          attributionControl: false,
        });
        leafletInstanceRef.current = map;

        const tileLayer = createProductionTileLayer(L, { provider: tileProvider });
        tileLayer.addTo(map);
        tileLayerInstanceRef.current = tileLayer;
        prevTileProviderRef.current = tileProvider;

        const pinIcon = L.divIcon({
          className: 'allgo-draggable-pin',
          html: `
            <div style="color:#e11d48;transform:translate(-50%,-100%);cursor:grab;">
              <svg style="width:36px;height:36px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="white"/>
              </svg>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

        const currentPin = pin || { lat: mapCenter.lat, lng: mapCenter.lng };
        const marker = L.marker([currentPin.lat, currentPin.lng], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);
        markerInstanceRef.current = marker;

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setPin({ lat: pos.lat, lng: pos.lng, x: 50, y: 50 });
          setSelected(null);
          setResults([]);
          setError('');
          onSelect(null);
          void resolvePinCoordinates(pos.lat, pos.lng);
        });

        map.on('click', (e: any) => {
          if (markerInstanceRef.current) {
            markerInstanceRef.current.setLatLng(e.latlng);
          }
          setPin({ lat: e.latlng.lat, lng: e.latlng.lng, x: 50, y: 50 });
          setSelected(null);
          setResults([]);
          setError('');
          onSelect(null);
          void resolvePinCoordinates(e.latlng.lat, e.latlng.lng);
        });

        map.on('zoomend', () => {
          setMapZoom(map.getZoom());
        });
      } else {
        const map = leafletInstanceRef.current;
        // Dynamically update tile layer if provider changed
        if (tileLayerInstanceRef.current && prevTileProviderRef.current !== tileProvider) {
          try { map.removeLayer(tileLayerInstanceRef.current); } catch {}
          const newLayer = createProductionTileLayer(L, { provider: tileProvider });
          newLayer.addTo(map);
          tileLayerInstanceRef.current = newLayer;
          prevTileProviderRef.current = tileProvider;
        }

        // Smoothly adjust view to new mapCenter
        map.setView([mapCenter.lat, mapCenter.lng], mapZoom);
        if (markerInstanceRef.current) {
          const targetCoord = pin || mapCenter;
          markerInstanceRef.current.setLatLng([targetCoord.lat, targetCoord.lng]);
        }
      }
    }).catch(err => {
      console.warn('Leaflet map could not load in LocationPicker:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [mapOpen, mapCenter?.lat, mapCenter?.lng, tileProvider]);

  // Teardown Leaflet instance when modal closes or component unmounts
  useEffect(() => {
    if (!mapOpen && leafletInstanceRef.current) {
      if (markerInstanceRef.current) {
        try { markerInstanceRef.current.off(); } catch {}
        markerInstanceRef.current = null;
      }
      if (tileLayerInstanceRef.current) {
        try { tileLayerInstanceRef.current.off(); } catch {}
        tileLayerInstanceRef.current = null;
      }
      cleanupLeafletInstance(leafletInstanceRef.current, mapElementRef.current);
      leafletInstanceRef.current = null;
    }
  }, [mapOpen]);

  useEffect(() => {
    return () => {
      if (markerInstanceRef.current) {
        try { markerInstanceRef.current.off(); } catch {}
        markerInstanceRef.current = null;
      }
      if (tileLayerInstanceRef.current) {
        try { tileLayerInstanceRef.current.off(); } catch {}
        tileLayerInstanceRef.current = null;
      }
      if (leafletInstanceRef.current) {
        cleanupLeafletInstance(leafletInstanceRef.current, mapElementRef.current);
        leafletInstanceRef.current = null;
      }
    };
  }, []);

  const openMap = () => {
    // Available even with no address selected! Defaults to selected or city center (Coimbatore / Tamil Nadu)
    const initial = selected?.location || { lat: 11.0168, lng: 76.9558 };
    setMapCenter(initial);
    setPin({ lat: initial.lat, lng: initial.lng, x: 50, y: 50 });
    setMapZoom(15);
    setMapOpen(true);
  };

  const placePin = (event: React.MouseEvent<HTMLDivElement>) => {
    if (leafletInstanceRef.current) {
      // Leaflet handles click events directly via map.on('click')
      return;
    }
    if (!mapCenter) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width * 640 - 320;
    const py = (event.clientY - bounds.top) / bounds.height * 400 - 200;
    const world = 256 * 2 ** mapZoom;
    const centerX = (mapCenter.lng + 180) / 360 * world;
    const centerSin = Math.sin(mapCenter.lat * Math.PI / 180);
    const centerY = (0.5 - Math.log((1 + centerSin) / (1 - centerSin)) / (4 * Math.PI)) * world;
    const sinLat = Math.sinh(Math.PI * (1 - 2 * (centerY + py) / world));
    const lng = ((centerX + px) / world * 360 + 540) % 360 - 180;
    const lat = Math.asin(sinLat) * 180 / Math.PI;
    setPin({ lat, lng, x: (event.clientX - bounds.left) / bounds.width * 100, y: (event.clientY - bounds.top) / bounds.height * 100 });
    setSelected(null);
    onSelect(null);
    void resolvePinCoordinates(lat, lng);
  };

  const usePin = async () => {
    if (!pin || busy) return;
    const version = ++revision.current;
    setBusy(true); setError(''); setResults([]); setSelected(null); onSelect(null);
    try {
      const locations = await reverseServiceLocation(pin.lat, pin.lng);
      if (version === revision.current) {
        const resolved = locations.find(location => !location.partialMatch);
        if (!resolved) {
          setResults(locations);
          setError('No complete address found at this pin. Move it or search for a more precise address.');
        } else {
          setSelected(resolved);
          setText(resolved.address);
          setResults(locations.filter(location => location.placeId !== resolved.placeId));
          onSelect(resolved);
          setMapOpen(false);
        }
      }
    } catch (cause) {
      if (version === revision.current) setError(cause instanceof Error ? cause.message : 'Could not resolve this map pin. Try another spot.');
    } finally {
      if (version === revision.current) setBusy(false);
    }
  };

  const search = async () => {
    if (busy || text.trim().length < 3) return;
    const version = revision.current;
    setBusy(true); setError(''); setResults([]); setSuggestions([]);
    try {
      const locations = await searchServiceLocations(text.trim());
      if (revision.current === version) {
        setResults(locations);
        if (!locations.length) setError('No addresses found. Include the street, area and city.');
      }
    } catch (error) {
      if (revision.current === version) setError(error instanceof Error ? error.message : 'Address lookup failed. Try again.');
    } finally { setBusy(false); }
  };

  // "Use current location" auto-selects best complete result and fills input (no second tap)
  const useDevice = async () => {
    // Uses fetchCurrentPosition (Capacitor on native, navigator.geolocation on web)
    const version = ++revision.current;
    setBusy(true); setError(''); setSelected(null); onSelect(null);
    try {
      const position = await fetchCurrentPosition();
      const locations = await reverseServiceLocation(position.latitude, position.longitude);
      if (version === revision.current) {
        const resolved = locations.find(location => !location.partialMatch) || locations[0];
        if (resolved && !resolved.partialMatch) {
          // Auto-select immediately without second tap!
          setSelected(resolved);
          setText(resolved.address);
          onSelect(resolved);
          setResults([]);
        } else {
          setResults(locations);
          if (!locations.length) setError('No address found at this location. Enter an address.');
        }
      }
    } catch (err: any) {
      if (version === revision.current) {
        const isDenied = (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number | string }).code === 1) || err?.code === 'PERMISSION_DENIED' || err?.message?.toLowerCase().includes('denied');
        setError(isDenied ? 'Location permission was denied. Please allow location access in your device settings or enter an address.' : (err?.message || 'Could not use device location. Allow location access or enter an address.'));
      }
    } finally {
      if (version === revision.current) setBusy(false);
    }
  };

  return (
    <div data-screen="location-picker" className={`my-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs ${className}`}>
      <label className="block text-xs font-bold text-slate-700">
        <span className="flex items-center gap-2">
          <MapPin size={17} className="text-indigo-600" />
          {label}
        </span>
        <div className="relative mt-2">
          <input
            required
            maxLength={300}
            value={text}
            disabled={disabled}
            onChange={event => {
              revision.current++;
              setText(event.target.value);
              setSelected(null);
              setResults([]);
              setError('');
              onSelect(null);
            }}
            placeholder="Type address, street, or area…"
            autoComplete="street-address"
            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {busy && (
            <div className="absolute right-3 top-3 text-slate-400">
              <LoaderCircle size={18} className="animate-spin" />
            </div>
          )}
        </div>
      </label>

      {/* Type-Ahead Autocomplete Suggestions Dropdown */}
      {suggestions.length > 0 && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg z-20 divide-y divide-slate-100">
          {suggestions.map(sugg => (
            <li key={sugg.placeId}>
              <button
                type="button"
                onClick={async () => {
                  setSuggestions([]);
                  setText(sugg.description);
                  setBusy(true);
                  try {
                    const locs = await searchServiceLocations(sugg.description);
                    const best = locs.find(l => !l.partialMatch) || locs[0];
                    if (best && !best.partialMatch) {
                      setSelected(best);
                      setText(best.address);
                      onSelect(best);
                    } else if (best) {
                      setSelected(best);
                      setText(best.address);
                      onSelect(best);
                    }
                  } catch {
                    // ignore
                  } finally {
                    setBusy(false);
                  }
                }}
                className="w-full p-2.5 text-left text-xs hover:bg-slate-50 transition-colors flex items-start gap-2"
              >
                <MapPin size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 block">{sugg.mainText}</span>
                  {sugg.secondaryText && <span className="text-[10px] text-slate-500">{sugg.secondaryText}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Actions Bar */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void search()}
          disabled={busy || disabled || text.trim().length < 3}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-indigo-50 px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          <Search size={14} />
          <span>{busy ? 'Searching…' : selected ? 'Search again' : 'Search address'}</span>
        </button>

        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => void useDevice()}
          className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Navigation size={14} className="text-indigo-600" />
          <span>Use device location</span>
        </button>

        <button
          type="button"
          disabled={busy || disabled}
          onClick={openMap}
          className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <MapPin size={14} className="text-rose-500" />
          <span>{selected ? 'Adjust map pin' : 'Pick on map'}</span>
        </button>
      </div>

      {/* Interactive Map Picker Section */}
      {mapOpen && (
        <section className="mt-3 rounded-2xl border border-slate-200 p-2.5 bg-slate-50" aria-label="Choose a location on the map">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Drag or tap pin to choose exact location</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Zoom out"
                disabled={mapZoom <= 12}
                onClick={() => {
                  const next = Math.max(12, mapZoom - 1);
                  setMapZoom(next);
                  if (leafletInstanceRef.current) leafletInstanceRef.current.setZoom(next);
                }}
                className="rounded-lg border bg-white px-2.5 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                −
              </button>
              <span className="text-xs font-mono font-semibold text-slate-600">{mapZoom}×</span>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={mapZoom >= 19}
                onClick={() => {
                  const next = Math.min(19, mapZoom + 1);
                  setMapZoom(next);
                  if (leafletInstanceRef.current) leafletInstanceRef.current.setZoom(next);
                }}
                className="rounded-lg border bg-white px-2.5 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div
            ref={mapElementRef}
            onClick={placePin}
            role="button"
            tabIndex={0}
            aria-label="Map. Tap to place the pickup or drop-off pin."
            onKeyDown={event => {
              if ((event.key === 'Enter' || event.key === ' ') && mapCenter) {
                if (leafletInstanceRef.current) {
                  const center = leafletInstanceRef.current.getCenter();
                  if (markerInstanceRef.current) {
                    markerInstanceRef.current.setLatLng(center);
                  }
                  setPin({ lat: center.lat, lng: center.lng, x: 50, y: 50 });
                  setSelected(null);
                  setResults([]);
                  setError('');
                  onSelect(null);
                  void resolvePinCoordinates(center.lat, center.lng);
                  return;
                }
                const bounds = event.currentTarget.getBoundingClientRect();
                placePin({
                  currentTarget: event.currentTarget,
                  clientX: bounds.left + bounds.width / 2,
                  clientY: bounds.top + bounds.height / 2
                } as React.MouseEvent<HTMLDivElement>);
              }
            }}
            className="relative h-[240px] w-full cursor-crosshair overflow-hidden rounded-xl border border-slate-200 bg-slate-100 z-0"
          >
            {busy && (
              <span className="absolute inset-0 z-30 grid place-items-center bg-white/70 text-xs text-slate-700 font-medium">
                <LoaderCircle size={18} className="animate-spin text-indigo-600" /> Resolving address…
              </span>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono">
              {pin ? `${pin.lat.toFixed(4)}°N, ${pin.lng.toFixed(4)}°E` : 'Drag pin to position'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60"
              >
                Close map
              </button>
              <button
                type="button"
                disabled={!pin || busy || disabled}
                onClick={() => void usePin()}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirm pin location
              </button>
            </div>
          </div>
        </section>
      )}

      {selected && (
        <p role="status" className="mt-2 text-xs font-medium text-emerald-700 flex items-center gap-1">
          <MapPin size={13} className="text-emerald-600" />
          <span>Selected: {selected.address}</span>
        </p>
      )}

      {error && <p role="alert" className="auth-error mt-2">{error}</p>}

      {/* Manual Search Results with Partial Match Protection */}
      {results.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {results.map(location => (
            <li key={location.placeId}>
              <button
                type="button"
                disabled={disabled || location.partialMatch}
                onClick={() => {
                  revision.current++;
                  setSelected(location);
                  setText(location.address);
                  setResults([]);
                  onSelect(location);
                }}
                className="w-full rounded-xl bg-slate-50 p-2.5 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50 border border-slate-200/60 transition-colors"
              >
                <span className="font-semibold text-slate-900 block">{location.address}</span>
                {location.partialMatch && (
                  <span className="block text-amber-700 text-[10px] mt-0.5 font-medium">
                    Incomplete match. Enter a more precise address.
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <small className="mt-2 block text-[10px] text-slate-400">
        Address search powered by Google Places & OpenStreetMap.
      </small>
    </div>
  );
}
