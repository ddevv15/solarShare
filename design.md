---
name: solarshare-calm-utility
source: derived
character: "A calm, practical interface for a community energy service. Warm neutral surfaces and one solar green accent keep the product trustworthy and easy to scan without making the demo feel decorative."
tokens: "Real values live in src/app/globals.css. Read them there and never duplicate them here."
contrast: "Light: body 9.35:1, ink 15.50:1, muted 5.52:1, on primary 6.55:1, control border 3.56:1. Dark: body 12.41:1, ink 16.79:1, muted 8.53:1, on primary 8.35:1, control border 3.23:1."
---

## Build mandate

Build complete product surfaces with a clear title, useful context, one primary action, and the states needed for real data. Keep the visual treatment deliberately plain while the trading logic is being proven. Do not leave controls or data without explanation.

## Character and direction

SolarShare feels steady, local, and transparent. Use a warm canvas, white or near black surfaces, compact type, and a deep green accent. The small sun mark and restrained source labels carry the product identity. Imagery and decorative illustration are outside this foundation.

## Composition patterns

Application pages live inside one shell. On wide screens the shell uses a fixed width side rail and a flexible content area. On small screens the brand and navigation move into a compact top region. Page content starts with a title, a short explanation, and at most one primary action, then uses a responsive card grid or a contained table.

Loading, empty, failure, and success states stay inside the content region they replace. They never blank the whole screen. Provider backed values keep their source label next to the value or section heading.

## Component and usage rules

Use shadcn source components from `src/components/ui` before adding one off markup. Use the primary green only for the single main action, active navigation, focus, and small status cues. Use borders for structure and a soft shadow only for major raised cards. Status and source meaning always includes text.

Forms use `FieldGroup`, `Field`, and persistent labels. Tables use real headers and a horizontal overflow container on small screens. Buttons keep a minimum 44 pixel target. Cards use their full header, content, and footer composition where those regions are present.

## Responsive and accessibility direction

Start at a 320 pixel viewport. Content remains readable without page level horizontal scrolling. Wide tables may scroll inside their own region. Every route offers a skip link. Focus uses a three pixel primary outline with spacing from the control. Semantic landmarks, heading order, live status roles, and user preference for reduced motion are part of the base system.
