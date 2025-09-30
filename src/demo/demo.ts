// View Transitions API (document.startViewTransition)
document.startViewTransition(() => {
  // do DOM mutations here
});

// AbortSignal.timeout with fetch
const signal = AbortSignal.timeout(800);
await fetch("/api/data", { signal }).catch(() => {});
export {};