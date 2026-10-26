# Joined stepper control — Design

Date: 2026-10-26

## Purpose

It was not always clear which buttons belonged to which field. Every stepper was
a row of separately bordered boxes (`−5 − [input] ▾ Tap + +5`) with 4–8px gaps,
so a "+" beside one field was about as close to its neighbour's "−" as to its own
input — most visibly in the pattern editor, where Beats and Division sit side by
side. This groups each field's buttons and input into one visual object.

## Decision

Of five prototyped treatments (`experiments/field-grouping/`, switchable live),
**A — Joined** was chosen: one bordered box around the whole row, hairline
dividers between parts, no gaps, parts flat inside it. It groups without adding
height (the tray variant cost ~30px per field), and without nesting a second box
inside the editor's own (the card variant), which suits "minimal by subtraction".

Rejected: Tray (recessed well; +height), Card (label and slider inside a tile;
heaviest, boxes even the Volume slider), Rail (a vertical rule; weakest grouping),
Filled (tinted bar with ghost buttons; least tappable).

## Behaviour

- Applies to every `.stepper-row` in every theme: the panels' fields, the pattern
  header's Beats and Division, and Count-in.
- The box lights up as a whole: its border moves toward the accent on hover and
  takes the accent on focus anywhere inside it. The clamp flash (an out-of-range
  value) shows on the box, and wins over focus.
- Hovering a button tints it and turns its glyph accent; an open quick-select
  toggle stays highlighted; the keyboard focus ring is drawn inside the box.
- On a phone, where Tap wraps to its own full-width row, a rule separates it from
  the row above rather than a vertical divider.

## Out of scope

Selects, range sliders, and the buttons outside a stepper (Hide, the transport)
are unchanged. Each theme keeps its own tokens, so border colour, radius and
panel colour still differ; what no theme keeps inside a stepper is its own button
bevel, glow or gap.

## Implementation note

One block at the end of the `themes` layer — see the "joined stepper control"
section of `CLAUDE.md` for why it must be last and which states it restates.
