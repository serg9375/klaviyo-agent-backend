import { configFromEnv } from "./lib/klaviyo";

// Crash on boot when env vars are missing, instead of failing on the first merchant request.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") configFromEnv();
}
