import { Haptics, NotificationType } from '@capacitor/haptics';

let sharedAudioCtx: AudioContext | null = null;
let chimeInterval: ReturnType<typeof setInterval> | null = null;
let isUnlocked = false;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  return sharedAudioCtx;
}

export function unlockAudioContext(): void {
  if (!sharedAudioCtx) {
    getSharedAudioContext();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().then(() => {
      isUnlocked = true;
    }).catch(() => {});
  } else if (sharedAudioCtx && sharedAudioCtx.state === 'running') {
    isUnlocked = true;
  }
}

// Attach a one-time gesture unlock listener if in browser environment
if (typeof window !== 'undefined') {
  const handleUserGesture = () => {
    unlockAudioContext();
    window.removeEventListener('pointerdown', handleUserGesture);
    window.removeEventListener('keydown', handleUserGesture);
  };
  window.addEventListener('pointerdown', handleUserGesture, { once: true });
  window.addEventListener('keydown', handleUserGesture, { once: true });
}

export function playChimeTone(ctx: AudioContext): void {
  try {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (err) {
    console.warn('Audio synthesis tone play failed:', err);
  }
}

export async function triggerHapticAlert(): Promise<void> {
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (err) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (vibErr) {
      console.warn('Haptic feedback unavailable:', err, vibErr);
    }
  }
}

export function playOrderChime(): void {
  const ctx = getSharedAudioContext();
  if (ctx) {
    playChimeTone(ctx);
  }
  void triggerHapticAlert();
}

export function startRepeatingAlert(intervalMs = 3500): void {
  if (chimeInterval) return;

  const tick = () => {
    playOrderChime();
  };

  tick();
  chimeInterval = setInterval(tick, intervalMs);
}

export function stopRepeatingAlert(): void {
  if (chimeInterval) {
    clearInterval(chimeInterval);
    chimeInterval = null;
  }
}

export function isAlertActive(): boolean {
  return chimeInterval !== null;
}

export function closeAudioContext(): void {
  stopRepeatingAlert();
  if (sharedAudioCtx) {
    try {
      void sharedAudioCtx.close();
    } catch (err) {
      console.warn('Could not close AudioContext:', err);
    }
    sharedAudioCtx = null;
    isUnlocked = false;
  }
}
