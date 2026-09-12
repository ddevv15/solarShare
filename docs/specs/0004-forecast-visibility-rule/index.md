# 0004 · Forecast visibility rule

**Status**: Assumed
**Date**: 2026-09-12
**Authorized by**: Repository owner on 2026-09-12, during /develop

## Owed decision

Which timestamp supplies `p_as_of` when a household views a forecast, and whether a planning view should ever show a forecast issued later than now.

## Assumption built on

`p_as_of` for `select_current_forecast` is the start of the interval being shown, not the current time. A planning view does not select a forecast issued after that interval start. This keeps the fixed seed deterministic and makes every seeded anchor day forecast visible because each interval starts after the seeded forecast issue time.

## Code area

`src/app/(app)/seller`, `src/application`, and the caller bound forecast repository integration used by the seller planning view.

## Requirements

The seller can review tomorrow's labeled 15 minute estimates for generation, home demand, reserve, and shareable surplus. Forecast selection resolves deterministically for the fixed seed and retains its visible source label.

## Ratify

This decision was recorded by /develop, not deliberated. Run `/architect seller forecast and sharing` to deliberate and ratify it. Until then it stays flagged as an owed decision. It does not block marking the feature `done`.
