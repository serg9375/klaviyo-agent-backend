import type { Deps } from "./connector";
import { configFromEnv } from "./klaviyo";
import { defaultStore } from "./store";

export function liveDeps(): Deps {
  return {
    store: defaultStore(),
    config: configFromEnv(),
    fetch,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
