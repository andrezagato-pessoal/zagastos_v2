import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    // Check if already subscribed
    navigator.serviceWorker?.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) setSubscribed(true);
    });
  }, []);

  const handleEnable = async () => {
    if (permission === "unsupported") {
      toast.error("Notificações não são suportadas neste navegador");
      return;
    }

    setLoading(true);
    try {
      // 1. Get VAPID public key (generates if needed)
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke("push-notifications", {
        body: { action: "get-vapid-key" },
      });
      if (vapidError) throw vapidError;

      const vapidPublicKey = vapidData.publicKey;

      // 2. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permissão de notificação negada");
        setLoading(false);
        return;
      }

      // 3. Subscribe to push
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const subJson = subscription.toJSON();

      // 4. Save subscription to backend
      const { error: subError } = await supabase.functions.invoke("push-notifications", {
        body: {
          action: "subscribe",
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
      });
      if (subError) throw subError;

      setSubscribed(true);
      toast.success("Notificações ativadas! Lembrete diário às 20h 🔔");
    } catch (err: any) {
      console.error("Notification setup error:", err);
      toast.error("Erro ao ativar notificações: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (permission === "unsupported") return null;

  if (subscribed || permission === "granted") {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" disabled title="Notificações ativadas">
        <Bell className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={handleEnable}
      disabled={loading}
      title="Ativar notificações"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
    </Button>
  );
}
