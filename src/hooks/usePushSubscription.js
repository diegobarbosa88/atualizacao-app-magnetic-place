import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export const PUSH_SUPPORTED = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

/**
 * Ativa/consulta a subscrição de push notifications reais para um perfil
 * (role: 'admin' | 'worker' | 'client'). userId é opcional — null para admin
 * (conta única), obrigatório para worker/client.
 */
export function usePushSubscription({ supabase, role, userId }) {
  const [permission, setPermission] = useState(PUSH_SUPPORTED ? Notification.permission : 'unsupported');
  const [subscribing, setSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!PUSH_SUPPORTED) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!PUSH_SUPPORTED || !supabase || !VAPID_PUBLIC_KEY) return false;
    setSubscribing(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = subscription.toJSON();
      const id = `push_${role}_${(userId || 'default')}_${json.endpoint.slice(-24).replace(/[^a-zA-Z0-9]/g, '')}`;
      const { error } = await supabase.from('push_subscriptions').upsert({
        id,
        role,
        user_id: userId ? String(userId) : null,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }, { onConflict: 'endpoint' });
      if (error) throw error;

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('[usePushSubscription] falha ao subscrever:', e);
      return false;
    } finally {
      setSubscribing(false);
    }
  }, [supabase, role, userId]);

  const unsubscribe = useCallback(async () => {
    if (!PUSH_SUPPORTED || !supabase) return false;
    setSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        if (error) throw error;
      }
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error('[usePushSubscription] falha ao cancelar subscrição:', e);
      return false;
    } finally {
      setSubscribing(false);
    }
  }, [supabase]);

  return { permission, isSubscribed, subscribing, subscribe, unsubscribe, supported: PUSH_SUPPORTED };
}
