type StartFn = () => void;

let startFn: StartFn = () => {};

export function registerRouteProgressStart(fn: StartFn) {
  startFn = fn;
}

/** Call before `router.push` / `router.replace` so the top bar appears for programmatic navigations. */
export function startRouteProgress() {
  startFn();
}
