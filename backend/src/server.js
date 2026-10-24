import "./config/load-env.js";
import { createApp } from "./app.js";
import { INTERVAL_SECONDS, startNotificationSender } from "./services/notifications.js";

const port = Number(process.env.PORT || 4000);

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  // Workflow emails (services/notifications.js). NOTIFY_SENDER=off leaves sending to another process.
  if (process.env.NOTIFY_SENDER !== "off") {
    startNotificationSender();
    console.log(`Email notifications: checking every ${INTERVAL_SECONDS} s`);
  }
});
