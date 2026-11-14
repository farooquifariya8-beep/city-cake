---
name: design-pass
description: "Design or restyle a screen to docs/design.md. Use for visual work: layout, colour, type, motion, illustration, copy on screen."
---

# Design pass

Read `docs/design.md` and `docs/resources.md` first. Then load the unslop skill if your harness has it (`~/.agents/skills/unslop/SKILL.md`).

## Order

Work in this order. Each pass assumes the one before it.

1. **Spacing.** Snap to the 4 px grid. Fix padding and radius pairs.
2. **Colour.** Surfaces from tokens. Category hue for anything that belongs to a category. One accent for the primary action.
3. **Icons.** lucide, one size per context, 1.5 stroke.
4. **Copy.** Say what the thing does. Real names and numbers from the data. Sentence case. No exclamation marks.
5. **Type.** Display font for page titles and big numbers only. Mono for aligned figures. Weights 400 and 500.
6. **Layout.** One primary action. Vary card sizes where content varies. Nothing in a narrow centred column on desktop.
7. **Details.** Hairline borders, focus rings, hover states, empty and loading states.
8. **Visuals.** Illustration only where it explains or sets the scene: the hero, an explainer figure, empty states.
9. **Motion.** One entrance per page, one easing curve, reduced motion respected.

## Check

Open the page at 1440 and at 390 wide, in light and dark. Look for anything on the banned list in `docs/design.md`. Fix it before you report.
