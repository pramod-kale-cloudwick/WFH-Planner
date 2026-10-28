"use client";

import { useEffect } from "react";
import { startTour, TOUR_ANCHOR, TOUR_DONE_KEY } from "@/lib/product-tour";

/** Starts the tour once per browser (or on `?tour=1`) as soon as the calendar has rendered. */
export function ProductTour() {
  useEffect(() => {
    const url = new URL(window.location.href), requested = url.searchParams.has("tour");
    if (!requested && localStorage.getItem(TOUR_DONE_KEY)) return;
    if (requested) { url.searchParams.delete("tour"); window.history.replaceState(null, "", url.pathname + url.search); }
    let tries = 0;
    const timer = setInterval(() => {
      if (document.querySelector(`[data-tour="${TOUR_ANCHOR}"]`)) { clearInterval(timer); setTimeout(startTour, 300); }
      else if (++tries > 60) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, []);
  return null;
}
