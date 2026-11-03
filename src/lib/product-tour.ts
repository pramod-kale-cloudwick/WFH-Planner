"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export const TOUR_DONE_KEY = "wfh-tour-done";
export const TOUR_ANCHOR = "calendar-grid";

const at = (key: string) => `[data-tour="${key}"]`;
const list = (items: string[]) => `<ul style='padding-left:1rem;list-style:disc;display:grid;gap:4px'>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

const STEPS: DriveStep[] = [
  { popover: { title: "Welcome to WFH Planner", description: "A one-minute walkthrough of how WFH weeks are planned and what every part of the screen means. Skip anytime." } },
  { element: at("nav-dashboard"), popover: { title: "Dashboard", description: "Your home base: a monthly calendar showing who works from home on each day." } },
  {
    element: at("nav-employees"),
    popover: {
      title: "Employees",
      description: list([
        "Team list with each person's WFH type, fixed days and status. Edit your own profile here.",
        "Admins can mark someone <b>Away</b> (leave, offsite) for whole weeks. Rotation stays put, their WFH turn lapses, and the freed seat brings one WFH person back to office.",
      ]),
    },
  },
  {
    element: at("nav-settings"),
    popover: {
      title: "Settings",
      description: list([
        "Office seats and the resulting WFH slots per week.<br/><b>WFH per week</b> = rotating people − seats left after permanent WFO.",
        "<b>Regenerate Schedule</b> (admin) throws away everything from the current week on, including swaps and edits, and rebuilds fresh.",
      ]),
    },
  },
  { element: at("nav-audit"), popover: { title: "Audit", description: "History of every swap. Admins can undo a swap from here." } },
  { element: at("nav-swaps"), popover: { title: "Swap Requests", description: "Requests to trade WFH weeks. The yellow badge counts requests waiting on you." } },
  { element: at("feedback"), popover: { title: "Feedback", description: list(["Send <b>feedback</b>, request a <b>feature</b> or <b>report a bug</b>.", "Track your submissions here; you get notified when an admin marks one resolved."]) } },
  { element: at("bell"), popover: { title: "Notifications", description: "Schedule changes that affect you (re-plans, swaps, admin edits, away periods) plus new calendar notes." } },
  { element: at("month-nav"), popover: { title: "Month navigation", description: "Jump between months. <b>Today</b> brings you back to the current month." } },
  {
    element: at("generate"),
    popover: {
      title: "Generate Schedule (admin)",
      description: list([
        "Plans the alphabetical rotation for the next 20 weeks.",
        "No schedule yet: starts <b>next week</b> (Monday), so a mid-week click never disturbs the current week.",
        "Schedule exists: starts from the <b>week after next</b>; swapped or edited weeks are kept.",
        "Need a clean slate? Use <b>Regenerate</b> in Settings. Affected people get notified either way.",
      ]),
    },
  },
  {
    element: at(TOUR_ANCHOR),
    popover: {
      title: "WFH calendar",
      description: list([
        "A name on a day = working from home that day.",
        "No name = in office that day.",
        "Hover any name to see why they're home.",
        "Switch to <b>who's in office</b> from the profile menu; it also shows seats used per day (red = over capacity).",
        "Away people are kept out of the cells and listed below the calendar.",
        "Click your rotation-week name to swap that week.",
        "Click any day to add notes. Admins can also assign WFH there.",
      ]),
      side: "top",
    },
  },
  {
    element: at("icon-key"),
    popover: {
      title: "What the icons mean",
      description: list([
        "🔁 <b>Rotation WFH week</b>: rotating person on their turn, home Mon–Fri.",
        "📌 <b>Rotating · fixed WFH day</b>: office week, but home on their fixed weekday.",
        "🏠 <b>Permanent WFH</b>: home every day except their fixed office days.",
        "🏢 <b>Permanent WFO · fixed WFH day</b>: in office, but home on this fixed weekday.",
        "Dashed <b>Name · 1d</b>: in office that week, gave up their seat that day so a permanent-WFH person can use a fixed office day.",
        "In office view, a dashed name is using that freed seat.",
      ]),
      side: "top",
    },
  },
  {
    element: at("legend"),
    popover: {
      title: "Rotating team",
      description: list([
        "Everyone in the WFH rotation and their calendar colour. The rotation goes alphabetically, week after week.",
        "<b>Click a name</b> to spotlight that person across the calendar; others dim. Click again to clear.",
      ]),
      side: "top",
    },
  },
  { element: at("away"), popover: { title: "Away", description: "Who's on leave this month and for which weeks. They don't take an office seat, and their WFH turns in that period lapse.", side: "top" } },
  { element: at("fixed-days"), popover: { title: "Fixed days", description: "<b>Fixed office days</b>: permanent-WFH people who come in on these days.<br/><b>Fixed WFH days</b>: rotating and permanent-WFO people who stay home on these days." } },
  { element: at("profile"), popover: { title: "Profile menu", description: list(["Toggle the calendar between <b>who's WFH</b> and <b>who's in office</b>.", "Retake this tour anytime with <b>Take a tour</b>, or sign out."]) } },
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
