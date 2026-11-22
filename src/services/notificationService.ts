// Real Browser Push, Vibration & Audio Notification Service for Mobile, Tablet, and Desktop

const NOTIF_STORAGE_KEY = 'workchat_notifications_enabled_v2';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  timestamp: number;
}

type NotificationListener = (notif: InAppNotification) => void;

class NotificationService {
  private isEnabled: boolean = true;
  private audioCtx: AudioContext | null = null;
  private listeners: Set<NotificationListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
      this.isEnabled = stored !== null ? stored === 'true' : true;
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public setIsEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIF_STORAGE_KEY, String(enabled));
    }
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Request browser notification permission
  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.setIsEnabled(true);
      }
      return permission;
    } catch (e) {
      console.warn('Failed to request notification permission:', e);
      return 'denied';
    }
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  // Play subtle pleasant notification chime via Web Audio API
  public playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Dual tone pleasant chime (880Hz -> 1320Hz)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  // Vibrate mobile/tablet device
  public vibrate() {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 80, 150]);
      }
    } catch (e) {
      // Vibration not supported
    }
  }

  // Send real system notification to user device (tablet, laptop, phone)
  public notify(options: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }) {
    if (!this.isEnabled) return;

    // 1. Always play chime
    this.playChime();

    // 2. Vibrate phone / tablet
    this.vibrate();

    // 3. Dispatch to in-app notification toasts (always works across iframe / mobile / desktop)
    const inAppNotif: InAppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: options.title,
      body: options.body,
      icon: options.icon,
      timestamp: Date.now(),
    };
    this.listeners.forEach((listener) => listener(inAppNotif));

    // 4. Fire real native OS / browser notification if supported and granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(options.title, {
          body: options.body,
          icon: options.icon || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
          tag: options.tag || 'workchat-msg',
          silent: false,
        });

        if (options.onClick) {
          notif.onclick = () => {
            window.focus();
            options.onClick?.();
            notif.close();
          };
        }
      } catch (e) {
        console.warn('System notification error:', e);
      }
    }
  }
}

export const notificationService = new NotificationService();
