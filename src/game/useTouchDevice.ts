"use client";

import { useSyncExternalStore } from "react";

const query = "(pointer: coarse)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useTouchDevice() {
  return useSyncExternalStore(subscribe, () =>
    /iPhone|iPod|Android/i.test(navigator.userAgent) || window.matchMedia(query).matches,
  () => false);
}
