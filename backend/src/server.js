import "./config/load-env.js";
import { createApp } from "./app.js";
import { recheckPendingFlags } from "./services/amendments.js";
import { INTERVAL_SECONDS, startNotificationSender } from "./services/notifications.js";

const port = Number(process.env.PORT || 4000);

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  // Workflow emails (services/notifications.js). NOTIFY_SENDER=off leaves sending to another process.
  if (process.env.NOTIFY_SENDER !== "off") {
    startNotificationSender();
    console.log(`Email notifications: checking every ${INTERVAL_SECONDS} s`);
  }
  // Scheme amendments whose re-check was cut short by a restart (README §5).
  setTimeout(
    () => recheckPendingFlags().catch((e) => console.warn("[amendment] start-up re-check failed:", e.message)),
    5_000,
  );
});
