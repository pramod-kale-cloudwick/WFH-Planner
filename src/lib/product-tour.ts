"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export const TOUR_DONE_KEY = "wfh-tour-done";
export const TOUR_ANCHOR = "calendar-grid";

const at = (key: string) => `[data-tour="${key}"]`;

const STEPS: DriveStep[] = [
  { popover: { title: "Welcome to WFH Planner", description: "A one-minute walkthrough of how WFH weeks are planned and what every part of the screen means. Skip anytime." } },
  { element: at("nav-dashboard"), popover: { title: "Dashboard", description: "Your home base: a monthly calendar showing who works from home on each day." } },
  { element: at("nav-employees"), popover: { title: "Employees", description: "The team list with each person's WFH type and fixed office days. You can edit your own profile here." } },
  { element: at("nav-settings"), popover: { title: "Settings", description: "Office seats and the resulting WFH slots per week.<br/><b>WFH per week</b> = rotating people − seats left after permanent WFO." } },
  { element: at("nav-audit"), popover: { title: "Audit", description: "History of every swap. Admins can undo a swap from here." } },
  { element: at("nav-swaps"), popover: { title: "Swap Requests", description: "Requests to trade WFH weeks. The yellow badge counts requests waiting on you." } },
  { element: at("bell"), popover: { title: "Notifications", description: "Schedule changes that affect you (re-plans, swaps, admin edits) plus new calendar notes." } },
  { element: at("month-nav"), popover: { title: "Month navigation", description: "Jump between months. <b>Today</b> brings you back to the current month." } },
  { element: at("generate"), popover: { title: "Generate Schedule (admin)", description: "Builds the alphabetical rotation for the next 20 weeks. The current and next week stay frozen; swapped or edited weeks are kept." } },
  {
    element: at(TOUR_ANCHOR),
    popover: {
      title: "WFH calendar",
      description: "<ul style='padding-left:1rem;list-style:disc;display:grid;gap:4px'><li>A name on a day = working from home that day.</li><li>Click a name with <b>⇄</b> to swap that week.</li><li>Dashed <b>Name · 1d</b> = one-day WFH given to free a seat for someone's fixed office day.</li><li>Click any day to add notes. Admins can also assign WFH there.</li></ul>",
      side: "top",
    },
  },
  { element: at("legend"), popover: { title: "Rotating team", description: "Everyone in the WFH rotation and their calendar colour. The rotation goes alphabetically, week after week." } },
  { element: at("fixed-days"), popover: { title: "Fixed office days", description: "These people come to office on these days every week, even during their WFH week." } },
  { element: at("profile"), popover: { title: "Profile menu", description: "Retake this tour anytime from here with <b>Take a tour</b>, or sign out." } },
];

export function startTour() {
  const steps = STEPS.filter((s) => !s.element || document.querySelector(s.element as string));
  const tour = driver({
    steps, showProgress: true, progressText: "{{current}} of {{total}}", popoverClass: "wfh-tour", nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Finish",
    onPopoverRender: (popover, { driver: d }) => {
      if (d.isLastStep()) return;
      const skip = Object.assign(document.createElement("button"), { textContent: "Skip tour", className: "wfh-tour-skip", onclick: () => d.destroy() });
      popover.footerButtons.prepend(skip);
    },
    onDestroyed: () => localStorage.setItem(TOUR_DONE_KEY, "1"),
  });
  tour.drive();
}
