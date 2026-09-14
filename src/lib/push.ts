import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function getFirebaseConfig() {
  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY;
  const projectId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID;
  const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID;
  const messagingSenderId = appId?.split(':')[1] ?? '';
  return { apiKey, projectId, appId, messagingSenderId };
}

function initFirebase() {
  if (app) return { app, messaging: messaging! };
  const cfg = getFirebaseConfig();
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.messagingSenderId) {
    throw new Error('not-configured');
  }
  app = initializeApp(cfg);
  messaging = getMessaging(app);
  return { app, messaging };
}

export type PushStatus =
  | { status: 'registered'; token: string }
  | { status: 'not-configured' | 'unsupported' | 'open-in-new-tab' | 'denied' | 'failed'; error?: string };

export async function requestPushNotifications(): Promise<PushStatus> {
  if (typeof window === 'undefined') return { status: 'unsupported' };

  const cfg = getFirebaseConfig();
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.messagingSenderId) {
    return { status: 'not-configured' };
  }

  if (!('Notification' in window) || !(await isSupported())) {
    return { status: 'unsupported' };
  }

  // Push permission must be requested from a top-level page with a user gesture.
  if (window.top !== window.self) {
    return { status: 'open-in-new-tab' };
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    return { status: 'denied' };
  }

  try {
    const { messaging } = initFirebase();
    const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY;
    if (!vapidKey) return { status: 'not-configured' };

    const query = new URLSearchParams(cfg).toString();
    const swRegistration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swRegistration });

    if (!token) return { status: 'denied' };

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('device_tokens').upsert(
        { user_id: user.id, token, platform: 'web', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );
    }

    return { status: 'registered', token };
  } catch (e: any) {
    return { status: 'failed', error: e?.message ?? String(e) };
  }
}

export async function unregisterPush(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (user) {
        const token = await getToken(messaging!, {});
        if (token) {
          await supabase.from('device_tokens').delete().eq('user_id', user.id).eq('token', token);
        }
      }
      await reg.unregister();
    }
  } catch {}
}
