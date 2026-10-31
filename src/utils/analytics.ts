/**
 * Privacy-Consented Crash Reporting & Product Analytics
 * Ensures no events or error logs are recorded or transmitted without user opt-in consent.
 */

const CONSENT_STORAGE_KEY = 'allgo_analytics_consent';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: string;
}

export interface CrashReport {
  message: string;
  stack?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

/**
 * Returns whether the current user has explicitly granted analytics & crash reporting consent.
 */
export function hasAnalyticsConsent(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(CONSENT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Update the user's analytics consent preference.
 */
export function setAnalyticsConsent(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    // Ignore storage failures
  }
}

// In-memory buffer for diagnostics during current session
const sessionEvents: AnalyticsEvent[] = [];
const sessionCrashes: CrashReport[] = [];

/**
 * Log a user action or lifecycle event, gated by user consent.
 */
export function logAnalyticsEvent(name: string, properties?: Record<string, unknown>): boolean {
  if (!hasAnalyticsConsent()) {
    return false;
  }

  const event: AnalyticsEvent = {
    name,
    properties: sanitizePayload(properties),
    timestamp: new Date().toISOString()
  };

  sessionEvents.push(event);

  if (import.meta.env?.DEV) {
    console.debug('[AllGo Analytics]', name, event.properties);
  }

  return true;
}

/**
 * Report an application crash or caught unhandled error, gated by user consent.
 */
export function reportCrash(error: unknown, context?: Record<string, unknown>): boolean {
  if (!hasAnalyticsConsent()) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const report: CrashReport = {
    message,
    stack,
    timestamp: new Date().toISOString(),
    context: sanitizePayload(context)
  };

  sessionCrashes.push(report);

  if (import.meta.env?.DEV) {
    console.error('[AllGo CrashReport]', message, report.context);
  }

  return true;
}

/**
 * Initialize global unhandled error and rejection listeners.
 */
export function initCrashReporting(): () => void {
  if (typeof window === 'undefined') return () => {};

  const errorHandler = (event: ErrorEvent) => {
    reportCrash(event.error || event.message, { filename: event.filename, lineno: event.lineno });
  };

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    reportCrash(event.reason, { type: 'unhandled_promise_rejection' });
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);

  return () => {
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', rejectionHandler);
  };
}

/**
 * Remove PII (passwords, auth tokens, phone numbers) from analytics properties.
 */
function sanitizePayload(raw?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const sensitiveKeys = ['password', 'token', 'auth', 'phone', 'otp', 'secret', 'credit', 'card'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    const isSensitive = sensitiveKeys.some(s => key.toLowerCase().includes(s));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizePayload(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function getRecordedSessionEvents(): readonly AnalyticsEvent[] {
  return sessionEvents;
}

export function getRecordedSessionCrashes(): readonly CrashReport[] {
  return sessionCrashes;
}
