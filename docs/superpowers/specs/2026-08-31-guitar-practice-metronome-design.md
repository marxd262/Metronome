# Guitar Practice Metronome — Design Spec

Date: 2026-08-31

## Purpose

A single-file HTML metronome app focused on guitar practice, offering three modes: a
standard metronome, a gradual speed ramp for building up tempo, and a slow/fast
interval drill for targeted speed practice.

## Architecture

- **Single self-contained file**: `metronome.html` — HTML + CSS + vanilla JavaScript.
  No build step, no external dependencies, no network calls. Runs by double-clicking
  the file or opening it in any modern browser.
- **Timing engine**: Web Audio API lookahead scheduler (schedule upcoming clicks
  against `AudioContext.currentTime` a short window ahead, re-checking on a fast
  `setInterval`/`requestAnimationFrame` tick). This avoids the drift and
  tab-throttling jitter of driving playback directly off `setInterval`.
- **Sound**: click sounds are synthesized via the Web Audio API (short
  oscillator/noise burst shaped by an amplitude envelope) rather than embedded audio
  files — keeps the file small and makes sound style/volume purely code-driven.
- **Persistence**: all settings are written to `localStorage` on change and restored
  on load. No backend, no accounts.

## Layout

- **Top bar** (shared across all modes):
  - Time signature (numerator + denominator, e.g. 4/4, 3/4, 7/8)
  - Subdivision (none / eighths / triplets / sixteenths)
  - Sound style (click / beep / wood block)
  - Volume
  - Tap Tempo button — sets the BPM field of the currently active tab by tapping in
    rhythm
- **Three tabs**, one active mode at a time: **Metronome**, **Ramp**, **Practice**.
  Each tab owns its own BPM-related controls.
- **Start/Stop** control (button + spacebar shortcut) governs playback regardless of
  active tab.
- Switching tabs while playing **stops playback** (avoids ambiguous mid-beat mode
  changes).
- A visual beat indicator (pulsing element / bar position) reflects live playback in
  every mode.

## Mode: Metronome (normal mode)

- **BPM** — main speed setting (range ~20–400, number input + slider).
- **% of BPM** — secondary quick-scale dial (range ~50–150%, default 100%). Actual
  playback speed = `BPM × (% / 100)`. Lets the target tempo stay fixed while
  practicing slower.
- **Accent first beat** toggle — beat 1 of each bar (per the shared time signature)
  plays a distinct, higher/louder click.

## Mode: Ramp (gradual speed increase)

- **Start BPM** and **Stop BPM**.
- **Scale mode** — toggle between:
  - **% per step** (e.g. +2% each step), or
  - **Fixed BPM per step** (e.g. +5 BPM each step)
- **Step length** — number of **bars** per step; beats-per-step is derived from the
  shared time signature.
- **Direction** is inferred from Start vs. Stop (Start < Stop ramps up, Start > Stop
  ramps down); the scale amount is entered as a positive magnitude.
- **End behavior**: on reaching Stop BPM, the metronome **holds at that speed** and
  continues playing until manually stopped (no auto-stop, no looping).
- While running, the UI shows the current step number and current effective BPM.

## Mode: Practice (slow/break/fast/break drill)

- **Base BPM** — represents the **target/fast** speed you're working toward.
- **Speed delta %** (default 50%) — `Slow = Base × (1 − delta%)`. At the default,
  Slow is exactly half of Fast.
- **Beats per phase** — one shared count (settable) applied to both the slow phase
  and the fast phase.
- **Break beats** are fixed at exactly **1 beat**, not user-configurable, and play at
  the **Slow** tempo (acting as a landing/reset point before jumping to full speed).
- Cycle: `[Slow × N beats] → [Break × 1 beat @ Slow tempo] → [Fast × N beats] →
  [Break × 1 beat @ Slow tempo] → repeat`.
- UI shows which phase is currently active (Slow / Break / Fast / Break).

## Persistence & Validation

- All top-bar and per-tab settings persist to `localStorage`, restored on load.
- Sensible defaults on first run: 120 BPM, 4/4, no subdivision, click sound, 100%
  volume, 100% BPM scale, Practice delta 50%.
- Inputs are clamped/validated: BPM within range, no zero/negative beats-per-phase,
  no zero-bar ramp steps, Start ≠ Stop for ramp (equal values would produce no ramp).

## Out of scope (for this spec)

- User accounts, cloud sync, or cross-device settings.
- Audio file import/upload for click sounds.
- Keeping playback running across a tab switch (switching tabs always stops
  playback).

## Testing / Verification

No build tooling, so verification is manual, done directly in a browser:

- Confirm click timing accuracy at a few BPM values (spot-check against a stopwatch
  or external reference) in each of the three modes.
- Confirm switching tabs stops playback cleanly.
- Confirm settings persist across a page reload.
- Confirm Ramp transitions steps at the correct bar/beat boundaries and holds at
  Stop BPM.
- Confirm Practice cycles transition at the correct beat counts and that Break beats
  play at Slow tempo.
- Confirm accent-on-beat-1 and subdivisions behave correctly across different time
  signatures.
