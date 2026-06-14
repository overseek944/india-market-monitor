import { useCallback, useEffect, useState } from "react";

export function useDesktopNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(setPermission).catch(() => undefined);
    }
  }, []);

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "granted") {
        try {
          new Notification(title, options);
        } catch {
          /* some browsers throw without a SW; ignore */
        }
      }
    },
    []
  );

  return { permission, notify };
}
