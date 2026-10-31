function distanceKm(a, b) {
  const rad = value => value * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function pickupEligibility(driver, booking, now = Date.now(), maxKm = 10) {
  const { validPoint } = require('./bookingPolicy');
  const location = { lat: driver.currentLat, lng: driver.currentLng }, pickup = booking.details?.pickupLocation;
  const reportedAt = Date.parse(driver.locationUpdatedAt || '');
  if (!validPoint(location) || !validPoint(pickup) || !Number.isFinite(reportedAt) || now - reportedAt > 60000 || reportedAt > now + 5000 || !Number.isFinite(driver.locationAccuracyMeters) || driver.locationAccuracyMeters > 100 || driver.locationAccuracyMeters < 0) return null;
  const km = distanceKm(location, pickup);
  return km <= maxKm ? km : null;
}
function destinationEligibility(driver, booking, now = Date.now(), maxKm = 0.3) {
  const { validPoint } = require('./bookingPolicy');
  const location = { lat: driver.currentLat, lng: driver.currentLng }, destination = booking.details?.dropLocation;
  const reportedAt = Date.parse(driver.locationUpdatedAt || '');
  if (!validPoint(location) || !validPoint(destination) || !Number.isFinite(reportedAt) || now - reportedAt > 60000 || reportedAt > now + 5000 || !Number.isFinite(driver.locationAccuracyMeters) || driver.locationAccuracyMeters > 100 || driver.locationAccuracyMeters < 0) return null;
  const km = distanceKm(location, destination);
  return km <= maxKm ? km : null;
}
function publicOffer(id, booking) {
  let driverSettlement;
  try {
    if (booking.settlementContract) {
      const { calculateDriverSettlement } = require('./settlementPolicy');
      driverSettlement = calculateDriverSettlement(booking);
    }
  } catch {
    driverSettlement = undefined;
  }
  const pickupArea = booking.pickupArea || (typeof booking.details?.pickupZoneId === 'string' ? `Zone: ${booking.details.pickupZoneId}` : 'Pickup Area');
  const dropArea = booking.dropArea || (typeof booking.details?.dropZoneId === 'string' ? `Zone: ${booking.details.dropZoneId}` : 'Destination Area');
  return {
    bookingId: id, serviceType: booking.serviceType, status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod || (booking.paymentStatus === 'pending_cod' ? 'cash' : 'online'),
    price: booking.price, driverId: null,
    createdAt: booking.createdAt, customerId: '', customerName: '',
    pickupAddress: 'Pickup details available after acceptance',
    dropAddress: 'Delivery details available after acceptance',
    pickupArea, dropArea,
    ...(driverSettlement ? { driverSettlement: { ...driverSettlement, settled: false } } : {}),
    ...(booking.settlementContract ? { settlementContract: booking.settlementContract } : {}),
    details: {
      ...(booking.serviceType === 'parcel' && typeof booking.details?.preferredDate === 'string' ? { preferredDate: booking.details.preferredDate } : {}),
      ...(booking.details?.vehicleType ? { vehicleType: booking.details.vehicleType } : {}),
      ...(booking.details?.transportVehicleType ? { transportVehicleType: booking.details.transportVehicleType } : {}),
      ...(Number.isFinite(booking.details?.estimatedKm) ? { estimatedKm: booking.details.estimatedKm } : {}),
      ...(Number.isFinite(booking.details?.estimatedMinutes) ? { estimatedMinutes: booking.details.estimatedMinutes } : {}),
      ...(booking.details?.packageType ? { packageType: booking.details.packageType } : {}),
      ...(Number.isFinite(booking.details?.billableWeightKg) ? { billableWeightKg: booking.details.billableWeightKg } : {}),
      ...(Number.isFinite(booking.details?.weightKg) ? { weightKg: booking.details.weightKg } : {})
    }
  };
}
module.exports = { publicOffer, pickupEligibility, destinationEligibility, distanceKm };
