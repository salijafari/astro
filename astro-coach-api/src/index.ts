import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { isFirebaseAdminInitialized } from "./lib/firebase-admin.js";

const port = Number(process.env.PORT) || 3001;

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    firebase: isFirebaseAdminInitialized ? "connected" : "disabled - check env vars",
    database: "connected",
  });
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Listening on ${info.port}`);
});
