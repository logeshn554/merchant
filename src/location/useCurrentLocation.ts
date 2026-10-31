import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type LocationStatus = 'idle' | 'prompt' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'loading';

export interface LocationPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface UseCurrentLocationResult {
  status: LocationStatus;
  position: LocationPosition | null;
  coords: LocationPosition | null;
  error: string | null;
  request: () => Promise<LocationPosition | null>;
  openSettings: () => Promise<void>;
  clear: () => void;
}

export async function fetchCurrentPosition(): Promise<LocationPosition> {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'denied') {
        throw Object.assign(new Error('Location permission denied.'), { code: 'PERMISSION_DENIED' });
      }
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        const req = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (req.location === 'denied') {
          throw Object.assign(new Error('Location permission denied.'), { code: 'PERMISSION_DENIED' });
        }
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch (err: any) {
      if (err?.message?.includes('denied') || err?.code === 'PERMISSION_DENIED') {
        throw Object.assign(new Error('Location permission denied. Please enable it in Settings.'), { code: 'PERMISSION_DENIED' });
      }
      if (err?.message?.includes('timeout') || err?.code === 'TIMEOUT') {
        throw Object.assign(new Error('GPS location request timed out.'), { code: 'TIMEOUT' });
      }
      throw Object.assign(new Error(err?.message || 'Location unavailable. Turn on device location services.'), { code: 'POSITION_UNAVAILABLE' });
    }
  }

  // Web fallback using navigator.geolocation
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw Object.assign(new Error('Geolocation is not supported by your browser or device.'), { code: 'POSITION_UNAVAILABLE' });
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      err => {
        if (err.code === 1) {
          reject(Object.assign(new Error('Location permission denied. Please allow location access in your browser.'), { code: 'PERMISSION_DENIED' }));
        } else if (err.code === 3) {
          reject(Object.assign(new Error('GPS location request timed out (15s). Move to an open area and try again.'), { code: 'TIMEOUT' }));
        } else {
          reject(Object.assign(new Error('Location services are turned off or unavailable.'), { code: 'POSITION_UNAVAILABLE' }));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  });
}

export function useCurrentLocation(): UseCurrentLocationResult {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [position, setPosition] = useState<LocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (Capacitor.isNativePlatform()) {
      Geolocation.checkPermissions().then((perm: { location: string }) => {
        if (!active) return;
        if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
          setStatus(prev => prev === 'idle' ? 'prompt' : prev);
        } else if (perm.location === 'denied') {
          setStatus(prev => prev === 'idle' ? 'denied' : prev);
        } else if (perm.location === 'granted') {
          setStatus(prev => prev === 'idle' ? 'granted' : prev);
        }
      }).catch(() => { /* ignore */ });
    } else if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
      (navigator as any).permissions.query({ name: 'geolocation' }).then((permResult: any) => {
        if (!active) return;
        if (permResult.state === 'prompt') {
          setStatus(prev => prev === 'idle' ? 'prompt' : prev);
        } else if (permResult.state === 'denied') {
          setStatus(prev => prev === 'idle' ? 'denied' : prev);
        } else if (permResult.state === 'granted') {
          setStatus(prev => prev === 'idle' ? 'granted' : prev);
        }
      }).catch(() => { /* ignore */ });
    }
    return () => { active = false; };
  }, []);

  const clear = useCallback(() => {
    setStatus('idle');
    setPosition(null);
    setError(null);
  }, []);

  const request = useCallback(async (): Promise<LocationPosition | null> => {
    if (inFlightRef.current) return position;
    inFlightRef.current = true;
    setStatus('loading');
    setError(null);

    try {
      const pos = await fetchCurrentPosition();
      setPosition(pos);
      setStatus('granted');
      setError(null);
      return pos;
    } catch (err: any) {
      const code = err?.code;
      if (code === 'PERMISSION_DENIED') {
        setStatus('denied');
        setError(err.message || 'Location permission denied. Please enable location access in settings.');
      } else if (code === 'TIMEOUT') {
        setStatus('timeout');
        setError('GPS request timed out. Please check your signal and try again.');
      } else {
        setStatus('unavailable');
        setError(err.message || 'Location services unavailable. Please turn on GPS or enter address manually.');
      }
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [position]);

  const openSettings = useCallback(async (): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      // In native environment, alert or direct to application settings
      try {
        // Native intent or instruction
        console.info('Opening native settings instructions for location permissions.');
      } catch {
        // fall through
      }
    } else {
      console.info('Open browser settings -> Site permissions -> Location to enable.');
    }
  }, []);

  return {
    status,
    position,
    coords: position,
    error,
    request,
    openSettings,
    clear,
  };
}

export default useCurrentLocation;
