export interface UserProfile {
  phoneVerified?: boolean;
  requestedRole?: 'customer' | 'driver' | 'merchant';
  emailVerified?: boolean;
  serviceIdentityEnabled?: boolean;
  favorites?: string[];
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'driver' | 'merchant' | 'admin';
  /** Partner accounts: pending_approval | pending_kyc | approved | verified | rejected | active */
  approvalStatus?: 'pending_approval' | 'pending_kyc' | 'approved' | 'verified' | 'rejected' | 'active';
  approvalReason?: string;
  createdAt: string;
  walletBalance?: number;
  photoURL?: string;
  defaultAddressId?: string;
  defaultAddress?: string;
  merchantId?: string;
  merchantType?: 'restaurant' | 'grocery';
  merchantBusinessIds?: { restaurant?: string[]; grocery?: string[] };
  merchantStaffAccess?: Record<string, { merchantType: 'restaurant' | 'grocery'; ownerUid: string; permissions: Array<'orders' | 'catalog' | 'business'> }>;
  transportOperatorId?: string;
  preferences?: {
    orderUpdates: boolean;
    promotions: boolean;
    language: 'en' | 'ta';
  };
}


export interface SavedAddress {
  location?: { lat: number; lng: number };
  deliveryDetails?: { building: string; landmark: string; instructions: string };
  id: string;
  label: string;
  address: string;
  createdAt: string;
}

export interface DriverProfile {
  supportedServices?: Booking['serviceType'][];
  rejectedBookingIds?: string[];
  availableEarningsCents?: number;
  reservedEarningsCents?: number;
  codCashInHandCents?: number;
  activeBookingId?: string | null;
  transportOperatorId?: string;
  transportCapabilities?: { approved?: boolean; [key: string]: unknown };
  earningsDate?: string;
  driverId: string;
  vehicleType: 'bike' | 'auto' | 'car' | 'suv';
  vehicleNo: string;
  licenseNo: string;
  status: 'pending' | 'verified' | 'rejected';
  online: boolean;
  currentLat?: number;
  currentLng?: number;
  locationUpdatedAt?: string;
  locationAccuracyMeters?: number;
  locationConsent?: boolean;
  locationConsentAt?: string;
  todayEarnings?: number;
  completedJobs?: number;
  payoutAccount?: {
    accountType: 'bank' | 'upi';
    beneficiaryName: string;
    maskedAccount: string;
    verifiedAt?: string;
  };
  acceptanceRate?: number;
  rejectionCount24h?: number;
  recentRejections?: number[];
  cooldownUntil?: string;
  rating?: number;
  onTimeRate?: number;
}

export type DriverRejectionReason = 'too_far' | 'low_fare' | 'vehicle_issue' | 'emergency' | 'ending_shift' | 'other';

export interface DriverPayoutAccount {
  driverId: string;
  accountType: 'bank' | 'upi';
  beneficiaryName: string;
  maskedAccount: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
  status: 'verified' | 'rejected' | 'pending';
  verifiedAt?: string;
  updatedAt?: string;
}

export interface DriverCodDeposit {
  depositId: string;
  driverId: string;
  driverName?: string;
  amountCents: number;
  amount: number;
  paymentMode: 'bank_transfer' | 'upi';
  bankReference: string;
  status: 'pending_review' | 'reconciled' | 'rejected';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  reconciledAt?: string;
  reconciledBy?: string;
}


export interface DriverLedgerEntry {
  id?: string;
  entryId?: string;
  bookingId?: string;
  amountCents: number;
  direction?: 'credit' | 'debit';
  balanceAfterCents?: number;
  codCollectedCents?: number;
  type: 'delivery_earning' | 'transport_toll_reimbursement' | 'payout_reserved' | 'payout_completed' | 'payout_reversed' | 'cod_collected' | 'adjustment';
  description?: string;
  transferredCents?: number;
  requestId?: string;
  reference?: string;
  createdAt?: any;
}

export interface Restaurant {
  description?: string;
  openingHours?: string;
  acceptingOrders?: boolean;
  pausedUntil?: string | null;
  pausedAt?: string | null;
  pausedReason?: string | null;
  isBusy?: boolean;
  maxPreparationOrders?: number;
  id: string;
  name: string;
  cuisine: string;
  image: string;
  rating: number;
  deliveryTime: string;
  pureVeg: boolean;
  address: string;
}

export interface MenuItem {
  ingredients?: string;
  allergens?: string[];
  servingSize?: string;
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  isVeg: boolean;
  dietary?: 'veg' | 'non_veg' | 'egg' | 'vegan';
  spiciness?: 0 | 1 | 2 | 3;
  available?: boolean;
  category: string;
  description: string;
  image: string;
  variants?: { id: string; name?: string; label: string; price: number; available?: boolean; isDefault?: boolean }[];
  addOnGroups?: { id: string; title?: string; label: string; required: boolean; minSelect?: number; maxSelect?: number; maxSelections: number; options: { id: string; name?: string; label: string; price: number; available: boolean }[] }[];
  modifierGroups?: { id: string; title: string; minSelect: number; maxSelect: number; options: { id: string; name: string; price: number; available?: boolean }[] }[];
}

export interface GroceryStore {
  description?: string;
  openingHours?: string;
  acceptingOrders?: boolean;
  pausedUntil?: string | null;
  pausedAt?: string | null;
  pausedReason?: string | null;
  isBusy?: boolean;
  maxPreparationOrders?: number;
  id: string;
  name: string;
  address: string;
  rating: number;
  deliveryTime: string;
  image: string;
}

export interface GroceryProduct {
  description?: string;
  brand?: string;
  ingredients?: string;
  allergens?: string[];
  storageInstructions?: string;
  countryOfOrigin?: string;
  expiresAt?: string | null;
  id: string;
  storeId: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
  category: string;
  image: string;
}

export interface Booking {
  recordAuthority?: 'legacy_neon';
  picking?: { revision: number; lines: Record<string, { itemId: string; quantity: number }>; shortages?: Record<string, { itemId: string; itemName: string; orderedQuantity: number; packedQuantity: number; missingQuantity: number; orderTotalDeltaCents: number; walletDeltaCents: number; updatedAt: string }>; substitutions?: Record<string, { status: 'pending' | 'accepted' | 'removed' | 'expired'; replacement: { id: string; name: string; price: number; quantity: number }; originalItemId: string; originalName: string; originalUnitPrice: number; acceptedTotalCents: number; removedTotalCents: number; proposedAt: string; expiresAt?: string; revision: number }>; updatedAt: string };
  exception?: { kind: string; reason: string; status: 'open' | 'resolved'; revision: number; reportedBy: string; reportedAt: string; resolution?: string; resolvedBy?: string; resolvedAt?: string };
  preparation?: { expectedReadyAt: string; reason: string; revision: number; updatedAt: string };
  offerExpiresAt?: string;
  settlementContract?: PartnerSettlementContract;
  driverSettlement?: { version: number; serviceType: Booking['serviceType']; baseCents: number; distanceCents: number; plannedDurationCents: number; waitingCents: number; waitMinutes: number; totalCents: number; capApplied: boolean };
  arrivedAtPickup?: string;
  merchantPickupConfirmedAt?: string;
  arrivedAtDestination?: string;
  pickupCompletedAt?: string;
  priceBreakdown?: PriceBreakdown;
  fareBreakdown?: { baseCents: number; distanceCents: number; timeCents: number; weightCents: number; minimumAdjustmentCents: number; insuranceCents: number; subtotalCents: number; discountCents: number; totalCents: number };
  pickupArea?: string;
  dropArea?: string;
  driverPayout?: number;
  bookingId: string;
  customerId: string;
  customerName: string;
  serviceType: 'food' | 'grocery' | 'ride' | 'parcel' | 'takeover' | 'transport';
  /**
   * Full order state machine:
   * pending → (driver offer sent) → driver_offer_pending → accepted → preparing → ready
   * → driver_assigned → driver_at_store → (merchant verifies pickup_code) → transit
   * → arrived_at_destination → (customer enters delivery OTP) → delivered → completed
   * Any state → cancelled
   */
  status: 'pending' | 'driver_offer_pending' | 'accepted' | 'preparing' | 'ready' | 'driver_assigned' | 'driver_at_store' | 'pickup_verified' | 'transit' | 'arrived_at_destination' | 'delivery_otp_verified' | 'delivered' | 'completed' | 'cancelled';
  /** 4-digit code shown to driver; merchant scans/reads at pickup to confirm handover. */
  pickupCode?: string;
  /** 4-digit OTP shown to customer; driver must enter at doorstep to confirm delivery. */
  deliveryOtp?: string;
  /** Timestamp when merchant confirmed pickup code. */
  pickupCodeVerifiedAt?: string;
  /** Timestamp when customer delivery OTP was verified. */
  deliveryOtpVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  deliveredAt?: string;
  cancellationReason?: string;
  price: number;
  pickupAddress?: string;
  dropAddress?: string;
  driverId?: string | null;
  driverName?: string;
  merchantId?: string;
  otp?: string;
  pickupOtp?: string;
  paymentStatus?: 'paid' | 'pending_cod' | 'cancelled' | 'refund_processing' | 'refunded' | 'refund_required';
  paymentMethod?: 'upi' | 'card' | 'netbanking' | 'wallet' | 'cash' | 'emi' | 'other';
  paymentOrderId?: string;
  paymentId?: string;
  bundleId?: string;
  legId?: string;
  details?: BookingDetails;
}


export interface PriceBreakdown { itemCents: number; deliveryCents: number; packagingCents: number; platformCents: number; taxCents: number; taxBps?: number; discountCents: number; tipCents?: number; surgeCents?: number; totalCents: number; }
export interface PartnerSettlementContract {
  version: number;
  serviceType: Booking['serviceType'];
  baseCents: number;
  perKmCents: number;
  perMinuteCents: number;
  minimumCents: number;
  maxPayoutCents: number;
  waitingPerMinuteCents: number;
  maxWaitingMinutes: number;
  allowZeroPayout: boolean;
}
export interface BookingDetails {
  packageType?: string;
  vehicleRequired?: string;
  deliveryPlaceId?: string;
  restaurantId?: string;
  restaurantName?: string;
  storeId?: string;
  parcelDescription?: string;
  fragile?: boolean;
  declaredValue?: number;
  restrictedItemsConfirmed?: boolean;
  parcelContacts?: { senderName: string; senderPhone: string; recipientName: string; recipientPhone: string };
  quoteId?: string;
  pickupPlaceId?: string;
  dropPlaceId?: string;
  pickupLocation?: { lat: number; lng: number };
  dropLocation?: { lat: number; lng: number };
  pickupZoneId?: string;
  dropZoneId?: string;
  routeProvider?: string;
  takeoverOption?: string;
  takeoverTransmission?: 'manual' | 'automatic';
  preferredDate?: string;
  pickupTimeReview?: { status: 'confirmed' | 'declined'; reviewedBy: string; reviewedByRole?: string; reviewedAt: string; reason: string; revision?: number };
  deliveryMode?: string;
  weightKg?: number;
  dimensions?: { lengthCm: number; widthCm: number; heightCm: number };
  actualWeightKg?: number;
  volumetricWeightKg?: number;
  billableWeightKg?: number;
  ownershipConfirmed?: boolean;
  vehicleWeightKg?: number;
  vehicleDimensions?: { lengthCm: number; widthCm: number; heightCm: number };
  vehicleCondition?: string;
  vehiclePhotos?: { contentType: string; base64: string }[];
  parcelType?: string;
  // Food & Grocery orders details
  items?: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    variantId?: string;
    variantName?: string;
    addOns?: { id: string; name: string; price: number }[];
    removed?: boolean;
  }[];
  notes?: string;

  // Rides & Driver details
  vehicleType?: string;
  vehicleNo?: string;
  licenseNo?: string;
  estimatedKm?: number;
  estimatedMinutes?: number;

  // Driver Takeover details
  takeoverVehicleModel?: string;
  takeoverVehicleNo?: string;
  takeoverInspectionPhotos?: string[]; // simulated base64 or link
  takeoverCustodyConfirmed?: boolean;

  // Intercity Vehicle Transport details
  transportVehicleType?: 'bike' | 'car';
  transportMakeModel?: string;
  transportRegNo?: string;
  transportPhotosUploaded?: boolean;
}

export interface SupportTicket {
  requesterRole?: 'customer' | 'driver' | 'merchant';
  messageRevision?: number;
  bookingId?: string | null;
  category?: string;
  assignedTo?: string | null;
  revision?: number;
  resolution?: string | null;
  firstResponseDueAt?: string | null;
  firstResponseAt?: string;
  ticketId: string;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'escalated' | 'resolved';
  createdAt: string;
}

export interface TransportOperatorDashboardData {
  operator: { id: string; name: string; status: string };
  quoteRequests: Array<{ requestId: string; status: 'open' | 'offered'; revision: number; requestedAt: string | null; preferredDate: string | null; vehicle: string | null; registration: string | null; vehicleType: string | null; weightKg: number | null; vehicleDimensions: { lengthCm?: number; widthCm?: number; heightCm?: number } | null; pickup: string | null; drop: string | null; estimatedKm: number | null; estimatedMinutes: number | null; condition: string | null; quote?: { amountCents: number; reason: string; expiresAt: string | null; decision: string } | null }>;
  hasMoreQuoteRequests: boolean;
  bookings: Array<{ bookingId: string; status: string; price: number | null; createdAt: string | null; pickupDate: string | null; pickupTimeReview: { status?: string; reason?: string; revision?: number } | null; vehicle: string | null; registration: string | null; pickup: string | null; drop: string | null; driverId: string | null; transportAssignment?: { status?: string; driverId?: string; vehicleId?: string } | null }>;
  hasMoreBookings: boolean;
  vehicles: Array<{ vehicleId: string; [key: string]: unknown }>;
  hasMoreVehicles: boolean;
  drivers: Array<{ driverId: string; [key: string]: unknown }>;
  hasMoreDrivers: boolean;
  earningsCents: number;
  earningsEntries: number;
  earnings: Array<{ bookingId: string; type: string; grossCents: number; driverPayoutCents: number; amountCents: number; status: string; reviewReason?: string; createdAt: string | null }>;
  hasMoreEarnings: boolean;
  balance: { availableCents: number; reservedCents: number };
  operatorPayouts: Array<{ requestId: string; amountCents: number; status: string; createdAt: string | null; transferReference: string | null }>;
  hasMoreOperatorPayouts: boolean;
  tollClaims: Array<{ claimId: string; bookingId: string; driverId: string; amountCents: number; description: string; status: string; reviewReason: string | null; createdAt: string | null; receiptCount: number }>;
  hasMoreTollClaims: boolean;
}

export interface TransportOperatorOption { operatorId: string; name: string }
export interface TransportQuoteRequestStatus { requestId: string; status: 'open' | 'offered' | 'declined' | 'accepted' | 'expired'; revision: number; offer?: { amountCents: number; terms: string; expiresAt: string; pickupTimeReview: { status: string; reviewedAt: string; reason: string } }; message?: string }

export type LegType = 'ride' | 'food' | 'grocery' | 'parcel' | 'takeover' | 'transport';
export type LegStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'transit' | 'delivered' | 'completed' | 'cancelled';
export type BundleStatus = 'pending' | 'active' | 'partial' | 'completed' | 'cancelled';
export type FulfillmentMethod = 'ride_driver' | 'separate_partner' | 'self_pickup';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export interface BundleLegBreakdown {
  legId: string;
  type: LegType;
  itemCents: number;
  deliveryCents: number;
  rideFareCents: number;
  detourCents: number;
  packagingCents: number;
  platformCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
}

export interface BundleLeg {
  refundStatus?: 'pending' | 'reconciliation_required' | 'provider_pending' | 'processed' | 'manual_review' | 'not_required';
  refundId?: string;
  refundIntentId?: string | null;
  legId: string;
  legIndex: number;
  type: LegType;
  status: LegStatus;
  merchantId?: string;
  driverId?: string | null;
  driverName?: string;
  pickupAddress: string;
  dropAddress: string;
  pickupLocation?: { lat: number; lng: number };
  dropLocation?: { lat: number; lng: number };
  fulfillmentMethod?: FulfillmentMethod;
  fulfillmentDecidedAt?: string;
  items?: BookingDetails['items'];
  details?: BookingDetails;
  priceBreakdown: BundleLegBreakdown;
  settlementContract?: PartnerSettlementContract;
  otp?: string;
  pickupOtp?: string;
  estimatedKm?: number;
  estimatedMinutes?: number;
  readyEta?: string;
  detour?: { addedKm: number; addedMinutes: number; costCents: number };
  exception?: Booking['exception'];
  preparation?: Booking['preparation'];
  picking?: Booking['picking'];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TripBundle {
  bundleId: string;
  status: BundleStatus;
  customerId: string;
  customerName: string;
  totalCents: number;
  paymentOrderId: string;
  paymentId: string;
  paymentMethod?: PaymentMethod;
  paymentStatus: 'created' | 'paid' | 'partial_refund' | 'refunded';
  couponCode?: string;
  couponDiscountCents?: number;
  breakdown: BundleLegBreakdown[];
  legCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
