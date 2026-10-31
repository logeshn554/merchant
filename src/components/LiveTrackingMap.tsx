import React, { useState, useEffect, useRef } from 'react';
import { Navigation, MapPin, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { createProductionTileLayer, cleanupLeafletInstance, type MapTileProvider } from '../utils/mapTileProvider';

interface LiveTrackingMapProps {
  driverLat?: number;
  driverLng?: number;
  pickupLocation?: { lat: number; lng: number };
  dropLocation?: { lat: number; lng: number };
  destination?: 'pickup' | 'drop';
  title?: string;
  isRide?: boolean;
  isTakeover?: boolean;
  isTransport?: boolean;
  stageTitle?: string;
  route?: { distanceMeters: number; estimatedMinutes: number; calculatedAt: string } | null;
  freshRoute?: boolean;
  isStale?: boolean;
  lastPositionTimestamp?: number;
  now?: number;
  tileProvider?: MapTileProvider;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  driverLat,
  driverLng,
  pickupLocation,
  dropLocation,
  destination,
  title = 'Live Journey Tracking',
  isRide,
  isTakeover,
  isTransport,
  stageTitle,
  route,
  freshRoute,
  isStale,
  lastPositionTimestamp,
  now = Date.now(),
  tileProvider,
}) => {
  const [pulse, setPulse] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const prevTileProviderRef = useRef<string | undefined>(tileProvider);
  const driverMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const hasFittedBoundsRef = useRef(false);
  const lastTargetKeyRef = useRef('');

  useEffect(() => {
    const timer = setInterval(() => setPulse(p => !p), 1500);
    return () => clearInterval(timer);
  }, []);

  const hasDriver = typeof driverLat === 'number' && Number.isFinite(driverLat) && typeof driverLng === 'number' && Number.isFinite(driverLng);
  const hasPickup = Boolean(pickupLocation && Number.isFinite(pickupLocation.lat) && Number.isFinite(pickupLocation.lng));
  const hasDrop = Boolean(dropLocation && Number.isFinite(dropLocation.lat) && Number.isFinite(dropLocation.lng));

  // Determine effective destination based on stage: pickup before pickup, drop after
  const isTargetingDrop = destination === 'drop' || (!destination && hasDrop && !hasPickup);
  const targetLocation = isTargetingDrop ? dropLocation : (pickupLocation || dropLocation);
  const targetLabel = isTargetingDrop ? 'Dropoff' : 'Pickup';
  const hasTarget = Boolean(targetLocation && Number.isFinite(targetLocation.lat) && Number.isFinite(targetLocation.lng));

  const secondsAgo = Number.isFinite(lastPositionTimestamp)
    ? Math.max(0, Math.floor((now - (lastPositionTimestamp as number)) / 1000))
    : null;

  const fixOlderThan60s = isStale || (secondsAgo !== null && secondsAgo >= 60);

  const recenterMap = () => {
    if (!leafletMapRef.current || !hasDriver) return;
    const map = leafletMapRef.current;
    if (hasTarget && targetLocation) {
      import('leaflet').then(L => {
        const bounds = L.latLngBounds([
          [driverLat!, driverLng!],
          [targetLocation.lat, targetLocation.lng],
        ]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }).catch(() => {});
    } else {
      map.setView([driverLat!, driverLng!], 15);
    }
  };

  // Initialize and update Leaflet Map in browser environments
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || !hasDriver) return;

    let isMounted = true;
    import('leaflet').then(L => {
      if (!isMounted || !mapContainerRef.current) return;

      const container = mapContainerRef.current;

      // Initialize map once if not already initialized
      if (!leafletMapRef.current) {
        if ((container as any)._leaflet_id) {
          delete (container as any)._leaflet_id;
        }
        const map = L.map(container, {
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          touchZoom: true,
          scrollWheelZoom: false,
        }).setView([driverLat!, driverLng!], 15);

        leafletMapRef.current = map;

        // Configurable production tile layer with CartoDB/OSM fallback and tile error recovery
        const tileLayer = createProductionTileLayer(L, { provider: tileProvider });
        tileLayer.addTo(map);
        tileLayerRef.current = tileLayer;
        prevTileProviderRef.current = tileProvider;
      }

      const map = leafletMapRef.current;

      // Handle dynamic tile provider switch
      if (tileLayerRef.current && prevTileProviderRef.current !== tileProvider) {
        try { map.removeLayer(tileLayerRef.current); } catch {}
        const newLayer = createProductionTileLayer(L, { provider: tileProvider });
        newLayer.addTo(map);
        tileLayerRef.current = newLayer;
        prevTileProviderRef.current = tileProvider;
      }

      // Custom Driver Icon with hardware-accelerated CSS animation
      const driverIcon = L.divIcon({
        className: 'allgo-leaflet-driver',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:#818cf8;opacity:0.4;transform:scale(1.3);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;background:#4f46e5;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:2px solid white;">
              <svg style="width:14px;height:14px;transform:rotate(45deg);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverLat!, driverLng!]);
        driverMarkerRef.current.setIcon(driverIcon);
      } else {
        driverMarkerRef.current = L.marker([driverLat!, driverLng!], { icon: driverIcon, zIndexOffset: 1000 }).addTo(map);
      }

      // Custom Destination Icon (pickup before pickup, drop after)
      if (hasTarget && targetLocation) {
        const destIcon = L.divIcon({
          className: 'allgo-leaflet-dest',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="background:${isTargetingDrop ? '#e11d48' : '#059669'};color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.3);border:2px solid white;">
                <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <span style="font-size:9px;font-weight:700;color:white;background:rgba(15,23,42,0.9);padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);margin-top:2px;white-space:nowrap;">
                ${targetLabel}
              </span>
            </div>
          `,
          iconSize: [36, 46],
          iconAnchor: [18, 46],
        });

        if (destMarkerRef.current) {
          destMarkerRef.current.setLatLng([targetLocation.lat, targetLocation.lng]);
          destMarkerRef.current.setIcon(destIcon);
        } else {
          destMarkerRef.current = L.marker([targetLocation.lat, targetLocation.lng], { icon: destIcon }).addTo(map);
        }

        // Route Polyline
        if (polylineRef.current) {
          polylineRef.current.setLatLngs([
            [driverLat!, driverLng!],
            [targetLocation.lat, targetLocation.lng],
          ]);
        } else {
          polylineRef.current = L.polyline([
            [driverLat!, driverLng!],
            [targetLocation.lat, targetLocation.lng],
          ], {
            color: '#6366f1',
            weight: 4,
            opacity: 0.85,
            dashArray: '6, 8',
          }).addTo(map);
        }

        // Auto-fit bounds on initial load or target transition without fighting user panning
        const targetKey = `${targetLocation.lat},${targetLocation.lng},${isTargetingDrop}`;
        if (!hasFittedBoundsRef.current || lastTargetKeyRef.current !== targetKey) {
          const bounds = L.latLngBounds([
            [driverLat!, driverLng!],
            [targetLocation.lat, targetLocation.lng],
          ]);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
          hasFittedBoundsRef.current = true;
          lastTargetKeyRef.current = targetKey;
        }
      } else {
        if (destMarkerRef.current) {
          map.removeLayer(destMarkerRef.current);
          destMarkerRef.current = null;
        }
        if (polylineRef.current) {
          map.removeLayer(polylineRef.current);
          polylineRef.current = null;
        }
        if (!hasFittedBoundsRef.current) {
          map.panTo([driverLat!, driverLng!]);
          hasFittedBoundsRef.current = true;
        }
      }
    }).catch(err => {
      console.warn('Leaflet map initialization skipped or failed:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [driverLat, driverLng, targetLocation?.lat, targetLocation?.lng, isTargetingDrop, hasDriver, hasTarget, tileProvider]);

  // Strict cleanup on unmount to prevent Leaflet memory leaks during rapid navigation
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        cleanupLeafletInstance(leafletMapRef.current, mapContainerRef.current);
        leafletMapRef.current = null;
        tileLayerRef.current = null;
        driverMarkerRef.current = null;
        destMarkerRef.current = null;
        polylineRef.current = null;
      }
    };
  }, []);

  // Compute normalized relative positions for vector route fallback (0 to 100%)
  const points = [];
  if (hasDriver) points.push({ lat: driverLat!, lng: driverLng!, type: 'driver' });
  if (hasTarget && targetLocation) points.push({ lat: targetLocation.lat, lng: targetLocation.lng, type: 'target' });

  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  if (points.length > 0) {
    minLat = Math.min(...points.map(p => p.lat));
    maxLat = Math.max(...points.map(p => p.lat));
    minLng = Math.min(...points.map(p => p.lng));
    maxLng = Math.max(...points.map(p => p.lng));
    const padLat = Math.max(0.005, (maxLat - minLat) * 0.2);
    const padLng = Math.max(0.005, (maxLng - minLng) * 0.2);
    minLat -= padLat; maxLat += padLat;
    minLng -= padLng; maxLng += padLng;
  }

  const toPercent = (lat: number, lng: number) => {
    const y = ((maxLat - lat) / Math.max(0.0001, maxLat - minLat)) * 100;
    const x = ((lng - minLng) / Math.max(0.0001, maxLng - minLng)) * 100;
    return { x: Math.max(10, Math.min(90, x)), y: Math.max(15, Math.min(85, y)) };
  };

  const driverPos = hasDriver ? toPercent(driverLat!, driverLng!) : { x: 50, y: 50 };
  const targetPos = hasTarget && targetLocation ? toPercent(targetLocation.lat, targetLocation.lng) : { x: 75, y: 50 };

  return (
    <div className="relative w-full h-[300px] bg-slate-950 overflow-hidden rounded-2xl border border-slate-800 shadow-2xl select-none" data-testid="live-tracking-map">
      {/* Real Leaflet Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-slate-950" />

      {/* Fallback Vector Route Layer (visible behind controls if tiles are loading or in SSR/test) */}
      <div className="absolute inset-0 pointer-events-none z-[1] opacity-30">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {hasDriver && hasTarget && (
            <line
              x1={`${driverPos.x}%`}
              y1={`${driverPos.y}%`}
              x2={`${targetPos.x}%`}
              y2={`${targetPos.y}%`}
              stroke="#6366f1"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
          )}
        </svg>
      </div>

      {/* Top Floating ETA Pill */}
      <div className="absolute top-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl shadow-2xl flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${fixOlderThan60s ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${fixOlderThan60s ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          </span>
          <div>
            <p className="text-[11px] font-bold text-white flex items-center gap-1">
              <span>{stageTitle || (isRide ? 'Ride in progress' : isTakeover ? 'Driving your vehicle' : isTransport ? 'Carrier in transit' : 'On the way')}</span>
              {freshRoute && route && (
                <span className="text-emerald-400 font-extrabold font-mono">
                  · ~{route.estimatedMinutes} mins
                </span>
              )}
            </p>
            <p className="text-[9px] text-slate-400 flex items-center gap-1">
              {fixOlderThan60s ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 inline" /> Reconnecting to driver GPS…
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-400 inline" /> Live GPS tracking active · Asian South-1
                </span>
              )}
            </p>
          </div>
        </div>

        {freshRoute && route && (
          <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 shadow-inner">
            {(route.distanceMeters / 1000).toFixed(1)} km
          </span>
        )}
      </div>

      {/* Driver Stale Fix Warning Banner (older than 60s fallback) */}
      {fixOlderThan60s && (
        <div className="absolute top-16 left-3 right-3 bg-amber-950/90 border border-amber-500/60 p-2 rounded-lg text-amber-200 text-[11px] flex items-center gap-2 z-20 backdrop-blur-sm shadow-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <div>
            <p className="font-semibold text-amber-300">Driver location signal paused</p>
            <p className="text-[10px] text-amber-200/80">
              {secondsAgo !== null ? `Last fix was received ${secondsAgo}s ago.` : 'Fix is older than 60 seconds.'} Reconnecting to driver GPS…
            </p>
          </div>
        </div>
      )}

      {/* Re-center floating action */}
      {hasDriver && (
        <button
          type="button"
          onClick={recenterMap}
          aria-label="Re-center map on vehicle"
          className="absolute bottom-11 right-3 z-20 flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 shadow-xl backdrop-blur-md hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          <Navigation className="h-3 w-3 text-indigo-400" />
          <span>Re-center</span>
        </button>
      )}

      {/* Bottom Center Status & Last Updated Ns ago Pill */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9px] text-slate-300 pointer-events-none z-20">
        <span className="bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-700/80 shadow font-medium">
          {secondsAgo !== null
            ? `Last updated ${secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}`
            : 'Last updated recently'}
        </span>
        <span className="font-mono bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-700/80 shadow">
          {hasDriver ? `${driverLat!.toFixed(4)}°N, ${driverLng!.toFixed(4)}°E` : 'Locating vehicle…'}
        </span>
      </div>
    </div>
  );
};
