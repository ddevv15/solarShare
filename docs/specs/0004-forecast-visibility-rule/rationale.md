# Rationale for forecast visibility rule

This file preserves the supporting reasoning for the assumed decision. It does not ratify or clear the assumption recorded in [the decision](./index.md).

## Current reasoning

Using the shown interval start as `p_as_of` keeps the fixed seed deterministic. It also makes each seeded anchor day forecast visible because the interval begins after the seeded forecast issue time.

## Ratification still owed

The timestamp source and the rule for forecasts issued later than the current time still require deliberation through `/architect seller forecast and sharing`.
