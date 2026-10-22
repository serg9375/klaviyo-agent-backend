// Crash on boot when env vars are missing, instead of failing on the first merchant request.
// The branch form lets the edge bundle drop the import, so node:crypto never reaches it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configFromEnv } = await import("./lib/klaviyo");
    configFromEnv();
  }
}
