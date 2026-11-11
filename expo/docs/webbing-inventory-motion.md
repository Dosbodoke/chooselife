# My webbings: list motion

The motion in My webbings (`components/settings/my-webbing.tsx` and its rows
and headings) is adapted from a reference screen recording. The constants
live in `components/settings/inventory-motion.ts`.

## Reference

- File: `726d5f7cb4cd87b7840dff67e352be6e391dc891.mov` (T3
  attachment; not committed). 7.43 s, constant 30 fps, 223 frames,
  2132×2400.
- Content: a finance "Overview" screen. A card opens a floating sheet of
  overdue invoices, a button sends reminders, the sheet closes, and the
  changed card leaves the overview and comes back.
- Scale: the phone screen is about 1430 px across for 393 pt, so 1 pt ≈
  3.6 px.

Measured by script over every frame (luminance probes, template matching on
the heading below the card, edge scans). Frame N is at (N − 1) / 30 s.

| Segment            | Frames  | Time        | What moves                                                                                         |
| ------------------ | ------- | ----------- | -------------------------------------------------------------------------------------------------- |
| Button press       | 16–24   | 0.50–0.77 s | Pill scales to 0.93 in ~100 ms, back in ~67 ms with ~0.8% overshoot                                |
| Backdrop dims      | 22–32   | 0.70–1.03 s | Monotonic, ~330 ms, decelerating                                                                   |
| Sheet rises        | ~25–36  | 0.80–1.17 s | Settles with ~7 px overshoot; start too fast to fit                                                |
| Sheet rows reveal  | 32–43   | 1.03–1.40 s | One row every 2 frames (67 ms), each fades in over ~5 frames and rises ~12 pt                      |
| Wide pill press    | 73–83   | 2.40–2.73 s | Scales to 0.96, back with ~10% overshoot                                                           |
| Backdrop clears    | 122–133 | 4.03–4.40 s | ~370 ms, accelerating                                                                              |
| Card leaves        | 158–165 | 5.23–5.47 s | Fades over ~200 ms (slightly ease-in), lifts ~5 pt and shrinks (width 0.988 a third of the way in) |
| Space below closes | 160–173 | 5.30–5.73 s | Starts ~50 ms after the fade; spring, see fits                                                     |
| Space opens        | 196–207 | 6.50–6.87 s | Spring, see fits                                                                                   |
| Card returns       | 201–207 | 6.67–6.87 s | Starts ~175 ms after the space starts opening; ~200 ms fade, rises ~4 pt                           |

Spring fits (mass 1, RMSE on normalised progress):

| Motion        | Stiffness | Damping | ζ    | Settles (99%) | RMSE                                                  |
| ------------- | --------- | ------- | ---- | ------------- | ----------------------------------------------------- |
| Space closes  | 240       | 27      | 0.88 | ~310 ms       | 0.002                                                 |
| Space opens   | 290       | 30      | 0.88 | ~290 ms       | 0.003                                                 |
| Press release | ~1500     | ~46     | ~0.6 | —             | estimated from overshoot and time to peak, not fitted |

The backdrop and the card fades are monotonic and were not fitted; the
easings in code are approximations of their shape.

## What the list does with it

The video's sheet, backdrop, reminders and success state have no counterpart
here and were not copied. The detail screen keeps its native sheet.

| Interaction      | Motion                                                                                                                                                                                                                                                          | Source                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Collapse a group | Its rows fade (200 ms, `Easing.poly(1.5)`), lift 5 pt and shrink to 0.97 (approx.); 50 ms later the space closes on the 240/27 spring and everything below follows. The ID chips that stand in for the rows open on the 290/30 spring and fade in after 175 ms. | Card leaves / space closes / card returns |
| Expand a group   | The space opens on the 290/30 spring; rows fade in after 175 ms over 200 ms, rising 4 pt, 67 ms apart for at most three steps. The ID chips leave like rows do.                                                                                                 | Space opens / card returns / sheet rows   |
| Heading press    | Scales to 0.97 in 100 ms, springs back (~1500/46). 0.97 rather than the measured 0.96: it is a section heading, not a primary button.                                                                                                                           | Pill press                                |
| Chevron          | One chevron turns 90° on the same springs instead of swapping icons.                                                                                                                                                                                            | Not in the reference; continuity          |
| Row press        | Tint fades in over 100 ms, out over 150 ms. Rows sit in one card, so they do not scale.                                                                                                                                                                         | Press timing only                         |
| Regroup          | Rows keep their instances and reorder in one step; the list fades in over 200 ms.                                                                                                                                                                               | Card returns (opacity only)               |
| Search           | No motion.                                                                                                                                                                                                                                                      | —                                         |

Rows never unmount: `InventoryReveal` animates the row's space and keeps it
mounted, so photo uploads and the lifetime meter keep their state. Each shrinking space clips its departing content so the following heading
cannot overlap fading row text. This adapts the reference to our transparent
group headings. While the space animates, the content is positioned absolutely so
it keeps its own height (in the normal flow, Yoga squeezed it into the
shrinking space and its measured height collapsed).

## Rules

- Only an owner's tap on a heading, or Collapse all / Expand all, animates.
  Search and first render show the result at once. Regrouping reorders at once
  with a brief opacity reveal.
- More than 60 rows in one toggle: instant.
- Reduce Motion: collapse and expand are instant, the regroup fade is skipped,
  and Reanimated's system setting makes the press and chevron jump to their
  ends.
- Hidden rows take no touches and are hidden from VoiceOver and TalkBack as
  soon as they start to leave; they leave the layout when their space closes.
- Every motion retargets when interrupted: tapping a heading again mid-way
  turns it around from where it is.
- Nothing loops, and the lifetime meter is unchanged.

## Verification and limits

- Typecheck, ESLint, `jest features/webbing` (84 tests) and React Doctor on
  the changed files pass.
- iPhone 17 Pro simulator on staging (the [DEMO] owner, read-only): grouping
  by model, collapse, expand, five rapid taps, Collapse all and Expand all ran
  without a stuck or half-open row. Those captures exposed the squeezed-height
  bug above. After the fix, logged heights stayed constant through the
  animation, but another session took over the simulator before a final
  screen recording, so the fixed motion has not been compared frame by frame
  with the reference on a device.
- Parent review added clipping to avoid heading/row overlap and resets active
  transitions when motion is disabled (for example, when search starts).
  These final adjustments have static validation only.
- Reduce Motion and Android were not tried on a device.
- Simulator recordings are variable frame rate; use them for order and rough
  timing, not for fitting.
