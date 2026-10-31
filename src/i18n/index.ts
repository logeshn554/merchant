/**
 * AllGo Internationalization (i18n) Layer
 * Provides localized strings for English (en), Tamil (ta), and Hindi (hi), wired to user preferences.
 * Includes locale-aware currency and number formatting in Indian format.
 */

export type SupportedLanguage = 'en' | 'ta' | 'hi';
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'ta', 'hi'];
const LANGUAGE_STORAGE_KEY = 'allgo_user_language';

export const translations = {
  en: {
    // General
    appName: 'AllGo',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    back: 'Back',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    all: 'All',

    // Merchant Hub Navigation
    navOrders: 'Orders',
    navMenu: 'Menu',
    navInsights: 'Insights',
    navMoney: 'Money',
    navMore: 'More',
    navSettings: 'Settings',
    navHistory: 'History',
    navReviews: 'Reviews',
    navOffers: 'Offers',
    navPreview: 'Preview',
    navDocuments: 'Documents',
    navSupport: 'Support',
    navBusiness: 'Business',

    // Order Actions & States
    acceptOrder: 'Accept & Start Preparation',
    markReady: 'Mark Ready for Pickup',
    confirmHandoff: 'Confirm order handed to rider',
    rejectOrder: 'Reject Order',
    orderStatusPending: 'Pending Merchant Confirmation',
    orderStatusPreparing: 'Preparing Order',
    orderStatusReady: 'Ready for Pickup',
    orderStatusTransit: 'Out for Delivery',
    orderStatusDelivered: 'Delivered',
    orderStatusCancelled: 'Cancelled',

    // Insights & Money
    todayRevenue: 'Completed booking value today',
    todayDeliveries: 'Confirmed order deliveries',
    avgOrderValue: 'Average order value',
    weeklyPace: 'Weekly run-rate pace',
    weeklySettlements: 'Weekly Settlement Statements',
    payoutAccount: 'Payout Account (Bank / UPI)',
    qualityScorecard: 'Store Quality & Reliability Scorecard',

    // Pause Control
    pauseOrders: 'Pause Incoming Orders',
    resumeOrders: 'Resume Orders',
    ordersPaused: 'Orders are paused',
    acceptingOrders: 'Accepting orders normally',

    // Driver Hub & Partner Workflow
    driverOnline: 'Online',
    driverOffline: 'Offline',
    driverGoOnline: 'Go Online',
    driverGoOffline: 'Go Offline',
    driverOffers: 'Incoming Dispatches',
    driverActiveJob: 'Active Delivery',
    driverEarnings: 'Earnings',
    driverProfile: 'Partner Profile',
    driverAcceptDispatch: 'Accept Dispatch',
    driverRejectDispatch: 'Decline Dispatch',
    driverArrivedAtPickup: 'Arrived at Pickup',
    driverStartDelivery: 'Start Delivery',
    driverCompleteDelivery: 'Complete Delivery',
    driverEmergencySos: 'Emergency SOS',
    driverScorecard: 'Scorecard & Rankings',
    driverLeaderboard: 'Driver Leaderboard',
    driverLanguage: 'Language / மொழி / भाषा'
  },
  ta: {
    // General
    appName: 'ஆல்கோ',
    loading: 'ஏற்றுகிறது...',
    save: 'சேமிக்க',
    cancel: 'ரத்து செய்',
    confirm: 'உறுதி செய்',
    back: 'பின்செல்',
    delete: 'நீக்கு',
    edit: 'திருத்து',
    search: 'தேடு',
    all: 'அனைத்தும்',

    // Merchant Hub Navigation
    navOrders: 'ஆர்டர்கள்',
    navMenu: 'மெனு',
    navInsights: 'புள்ளிவிவரம்',
    navMoney: 'பணம்',
    navMore: 'மேலும்',
    navSettings: 'அமைப்புகள்',
    navHistory: 'வரலாறு',
    navReviews: 'மதிப்புரைகள்',
    navOffers: 'சலுகைகள்',
    navPreview: 'முன்னோட்டம்',
    navDocuments: 'ஆவணங்கள்',
    navSupport: 'உதவி',
    navBusiness: 'வணிகம்',

    // Order Actions & States
    acceptOrder: 'ஆர்டரை ஏற்று தயாரிக்க தொடங்கு',
    markReady: 'எடுத்துச் செல்ல தயார் என குறிக்க',
    confirmHandoff: 'ஓட்டுநரிடம் ஒப்படைத்ததை உறுதி செய்',
    rejectOrder: 'ஆர்டரை நிராகரி',
    orderStatusPending: 'வணிகர் உறுதிப்படுத்தலுக்கு காத்திருக்கிறது',
    orderStatusPreparing: 'தயாரிக்கப்படுகிறது',
    orderStatusReady: 'எடுத்துச்செல்ல தயார்',
    orderStatusTransit: 'டெலிவரிக்கு புறப்பட்டது',
    orderStatusDelivered: 'டெலிவரி செய்யப்பட்டது',
    orderStatusCancelled: 'ரத்து செய்யப்பட்டது',

    // Insights & Money
    todayRevenue: 'இன்றைய முன்பதிவு மதிப்பு',
    todayDeliveries: 'டெலிவரி செய்யப்பட்ட ஆர்டர்கள்',
    avgOrderValue: 'சராசரி ஆர்டர் மதிப்பு',
    weeklyPace: 'வாராந்திர விற்பனை வேகம்',
    weeklySettlements: 'வாராந்திர தீர்வு அறிக்கைகள்',
    payoutAccount: 'பட்டுவாடா கணக்கு (வங்கி / UPI)',
    qualityScorecard: 'கடை தரம் மற்றும் நம்பகத்தன்மை மதிப்பீடு',

    // Pause Control
    pauseOrders: 'புதிய ஆர்டர்களை நிறுத்திவை',
    resumeOrders: 'மீண்டும் தொடங்கு',
    ordersPaused: 'ஆர்டர்கள் நிறுத்திவைக்கப்பட்டுள்ளன',
    acceptingOrders: 'ஆர்டர்கள் சாதாரணமாக பெறப்படுகின்றன',

    // Driver Hub & Partner Workflow
    driverOnline: 'ஆன்லைன்',
    driverOffline: 'ஆஃப்லைன்',
    driverGoOnline: 'ஆன்லைனுக்கு செல்',
    driverGoOffline: 'ஆஃப்லைனுக்கு செல்',
    driverOffers: 'புதிய ஆர்டர்கள்',
    driverActiveJob: 'தற்போதைய டெலிவரி',
    driverEarnings: 'வருமானம்',
    driverProfile: 'ஓட்டுநர் சுயவிவரம்',
    driverAcceptDispatch: 'ஆர்டரை ஏற்றுக்கொள்',
    driverRejectDispatch: 'ஆர்டரை நிராகரி',
    driverArrivedAtPickup: 'பொருளை எடுக்கும் இடத்திற்கு வந்தடைந்தேன்',
    driverStartDelivery: 'டெலிவரியை தொடங்கு',
    driverCompleteDelivery: 'டெலிவரியை முடி',
    driverEmergencySos: 'அவசர உதவி (SOS)',
    driverScorecard: 'மதிப்பீட்டு அட்டை',
    driverLeaderboard: 'ஓட்டுநர் முன்னிலை பட்டியல்',
    driverLanguage: 'மொழி / Language / भाषा'
  },
  hi: {
    // General
    appName: 'ऑलगो',
    loading: 'लोड हो रहा है...',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    confirm: 'पुष्टि करें',
    back: 'वापस',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    search: 'खोजें',
    all: 'सभी',

    // Merchant Hub Navigation
    navOrders: 'ऑर्डर',
    navMenu: 'मेनू',
    navInsights: 'आंकड़े',
    navMoney: 'भुगतान',
    navMore: 'अधिक',
    navSettings: 'सेटिंग्स',
    navHistory: 'इतिहास',
    navReviews: 'समीक्षाएं',
    navOffers: 'ऑफ़र',
    navPreview: 'पूर्वावलोकन',
    navDocuments: 'दस्तावेज़',
    navSupport: 'सहायता',
    navBusiness: 'व्यवसाय',

    // Order Actions & States
    acceptOrder: 'ऑर्डर स्वीकार करें और तैयार करें',
    markReady: 'पिकअप के लिए तैयार चिह्नित करें',
    confirmHandoff: 'राइडर को ऑर्डर सौंपने की पुष्टि करें',
    rejectOrder: 'ऑर्डर अस्वीकार करें',
    orderStatusPending: 'व्यापारी पुष्टि की प्रतीक्षा में',
    orderStatusPreparing: 'ऑर्डर तैयार हो रहा है',
    orderStatusReady: 'पिकअप के लिए तैयार',
    orderStatusTransit: 'डिलीवरी के लिए निकल चुका है',
    orderStatusDelivered: 'डिलीवर कर दिया गया',
    orderStatusCancelled: 'रद्द किया गया',

    // Insights & Money
    todayRevenue: 'आज का कुल बुकिंग मूल्य',
    todayDeliveries: 'पुष्ट ऑर्डर डिलीवरी',
    avgOrderValue: 'औसत ऑर्डर मूल्य',
    weeklyPace: 'साप्ताहिक बिक्री गति',
    weeklySettlements: 'साप्ताहिक निपटान विवरण',
    payoutAccount: 'भुगतान खाता (बैंक / UPI)',
    qualityScorecard: 'स्टोर गुणवत्ता एवं विश्वसनीयता स्कोरकार्ड',

    // Pause Control
    pauseOrders: 'नए ऑर्डर रोकें',
    resumeOrders: 'ऑर्डर फिर से शुरू करें',
    ordersPaused: 'ऑर्डर रोके गए हैं',
    acceptingOrders: 'ऑर्डर सामान्य रूप से स्वीकार किए जा रहे हैं',

    // Driver Hub & Partner Workflow
    driverOnline: 'ऑनलाइन',
    driverOffline: 'ऑफ़लाइन',
    driverGoOnline: 'ऑनलाइन जाएं',
    driverGoOffline: 'ऑफ़लाइन जाएं',
    driverOffers: 'आगामी ऑर्डर',
    driverActiveJob: 'सक्रिय डिलीवरी',
    driverEarnings: 'कमाई',
    driverProfile: 'पार्टनर प्रोफ़ाइल',
    driverAcceptDispatch: 'ऑर्डर स्वीकार करें',
    driverRejectDispatch: 'ऑर्डर अस्वीकार करें',
    driverArrivedAtPickup: 'पिकअप स्थान पर पहुंचे',
    driverStartDelivery: 'डिलीवरी शुरू करें',
    driverCompleteDelivery: 'डिलीवरी पूर्ण करें',
    driverEmergencySos: 'आपातकालीन सहायता (SOS)',
    driverScorecard: 'स्कोरकार्ड एवं रैंकिंग',
    driverLeaderboard: 'ड्राइवर लीडरबोर्ड',
    driverLanguage: 'भाषा / Language / மொழி'
  }
} as const;

export type TranslationKey = keyof typeof translations['en'];

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN'
};

/**
 * Format currency in Indian Rupees given integer paise.
 */
export function formatCurrencyPaise(paise: number, lang?: SupportedLanguage): string {
  const language = lang || getStoredLanguage();
  const locale = LOCALE_MAP[language] || 'en-IN';
  const rupees = paise / 100;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(rupees);
}

/**
 * Format a number using Indian numbering system.
 */
export function formatLocalizedNumber(num: number, lang?: SupportedLanguage): string {
  const language = lang || getStoredLanguage();
  const locale = LOCALE_MAP[language] || 'en-IN';
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Get current stored language preference, defaulting to English.
 */
export function getStoredLanguage(): SupportedLanguage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === 'ta' || stored === 'en' || stored === 'hi') return stored as SupportedLanguage;
    }
  } catch {
    // Ignore storage errors
  }
  return 'en';
}

/**
 * Save user language preference.
 */
export function setStoredLanguage(lang: SupportedLanguage): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Translate a key into target language with optional interpolation.
 */
export function t(key: TranslationKey | string, lang?: SupportedLanguage, params?: Record<string, string | number>): string {
  const targetLang = lang || getStoredLanguage();
  const langDict = translations[targetLang as SupportedLanguage] || translations.en;
  let text: string = (langDict as Record<string, string>)[key] || (translations.en as Record<string, string>)[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
    }
  }

  return text;
}
