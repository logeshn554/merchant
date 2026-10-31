import type { DriverProfile } from '../types';

type Point = { lat: number; lng: number } | null | undefined;
type Eligibility = { eligible: true; distanceMeters: number } | { eligible: false; reason: string };

function validPoint(point: Point): point is { lat: number; lng: number } {
  return Boolean(point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180);
}

export function driverArrivalEligibility(driver: Pick<DriverProfile, 'currentLat' | 'currentLng' | 'locationUpdatedAt' | 'locationAccuracyMeters'> | null, target: Point, now = Date.now()): Eligibility {
  if (!validPoint(target)) return { eligible: false, reason: 'Pickup or destination coordinates are unavailable. Contact operations.' };
  if (!driver || !validPoint({ lat: driver.currentLat!, lng: driver.currentLng! })) return { eligible: false, reason: 'Waiting for a valid GPS location.' };
  const reportedAt = Date.parse(driver.locationUpdatedAt || '');
  if (!Number.isFinite(reportedAt) || now - reportedAt > 60_000 || reportedAt > now + 5_000) return { eligible: false, reason: 'GPS location is stale. Wait for a fresh location update.' };
  const accuracy = driver.locationAccuracyMeters;
  if (!Number.isFinite(accuracy) || accuracy! < 0 || accuracy! > 100) return { eligible: false, reason: 'GPS accuracy must be 100 metres or better. Move to an open area and wait for a better fix.' };
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latDifference = toRadians(target.lat - driver.currentLat!);
  const lngDifference = toRadians(target.lng - driver.currentLng!);
  const a = Math.sin(latDifference / 2) ** 2 + Math.cos(toRadians(driver.currentLat!)) * Math.cos(toRadians(target.lat)) * Math.sin(lngDifference / 2) ** 2;
  const distanceMeters = 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  return distanceMeters <= 300
    ? { eligible: true, distanceMeters }
    : { eligible: false, reason: `Move within 300 metres of the location. Current GPS distance is about ${Math.round(distanceMeters)} metres.` };
}
