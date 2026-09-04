# Design Brief

## 1. Product purpose

A single-file, offline, browser-based metronome for guitar practice, with tempo ramping and structured practice-phase/break sequencing.

## 2. Primary user

A solo guitarist practicing with an instrument in hand, running the app in a browser tab (laptop or tablet) during a practice session, glancing at it rather than actively navigating it.

## 3. Principles

1. **The glance beats the click.** — While playing, current tempo, beat position, and active practice phase must be readable at a glance, without pausing, interacting, or hunting through the UI.
2. **Open is instant.** — No login, setup screen, first-run wizard, or loading step stands between opening the file (or a bookmarked tab) and being ready to play. Double-click or bookmark, and it just works, every time.
3. **Minimal by subtraction.** — Every on-screen element must justify its place during play; when a feature is added, default to hiding/collapsing secondary controls rather than layering in more UI.
4. **The beat must never lie.** — Visual feedback (dots, BPM readout, phase indicator) reflects only audio that has actually played — never early, never stale after a stop.
5. **Build-free is non-negotiable.** — No framework, dependency, or convenience is worth breaking the single-file, zero-build, offline premise. This is the technical enabler of principle 2 — one file, no install, no server.

## 4. Success metric for the surface

A user opens the bookmarked file and is tapping tempo or hitting play within seconds — no login, setup, or loading step in the way. Once playing, they read current BPM, beat position, and active practice phase within a glance, without pausing or breaking their playing rhythm.

## 5. Out of scope

- Does not add a build step, bundler, framework, or npm dependency
- Does not make network calls or load external scripts
- Does not add user accounts, login, or any cloud-synced settings (persistence is local-only via `localStorage`)
- Does not show onboarding flows, first-run wizards, or setup screens
- Does not support multi-instrument or ensemble/multi-player sync
- Does not add customizable dashboards, widgets, or dense settings panels that compete with the primary at-a-glance readout

## 6. Learned constraints

- **Dark-only is permanent, not a gap.** — 2026-09-04, confirmed during `/finalize`: the app is intentionally dark-only with no light theme planned. A guitarist practicing is often in a dim room glancing at the screen; a light theme isn't a goal here, it's out of scope. Future `/finalize`/`/tokens` runs should not re-flag the absence of a light mode as a finding.
