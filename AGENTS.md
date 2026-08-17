# AGENTS.md

Guidance for AI agents and new contributors working in this repository.

## What this is

`picktime` is a time picker distributed as a form-associated custom element,
`<pick-time>`. It is published to npm as an ESM-only package with a single
runtime dependency (`@floating-ui/dom`).

## Architecture

The central rule: **the controller owns state, the element owns the DOM.**
Nothing in the controller touches the document, and nothing in the element does
time arithmetic. Keeping that line clean is what makes the clock logic testable.

| File | Responsibility |
|---|---|
| `src/controller.ts` | Headless time state. Stores seconds-of-day, steps fields, computes validity. No DOM. |
| `src/element.ts` | The custom element. Renders controller state, maps gestures to controller calls, owns `ElementInternals`. |
| `src/parse.ts` | Lenient parsing of typed human input (`"9:30 pm"`, `"0930"`). |
| `src/format.ts` | All display formatting, via `Intl`. Nothing formatted here is ever stored. |
| `src/position.ts` | Floating UI wiring. One `autoUpdate` loop per open, always disposed. |
| `src/compat.ts` | v2 `new PickTime(input, options)` shim. |
| `src/index.ts` | Public exports, and registers `<pick-time>`. |
| `src/styles.css` | Shadow-root stylesheet, inlined into the bundle via `?inline`. |

### Invariants worth protecting

- **Time is one number.** The controller stores seconds since midnight, never a
  `{hours, minutes, meridiem}` triple. Most of the v2 bug class came from
  keeping several fields in sync by hand.
- **Never test a time value for truthiness.** Midnight is `0`. `value || default`
  is how v2 turned hour 0 into 12; the same trap applies to minutes and seconds.
- **Display is always derived.** If you find yourself storing a formatted
  string, that is a bug waiting to happen.
- **Every listener takes the instance `AbortSignal`.** `disconnectedCallback`
  aborts once and the component is fully detached. Do not add a listener that
  needs its own bespoke removal.
- **Fields step independently.** Incrementing 09:59 by a minute gives 09:00, not
  10:00, matching `<input type="time">` and the ARIA spinbutton role.
- **`#commit()` is the only write path.** It publishes the form value, refreshes
  validity, re-renders, and emits events, in that order. Do not call
  `setFormValue` or `#render` from anywhere else.

## Commands

```sh
npm run dev            # Vite dev server for demo/
npm test               # Vitest, real browser via Playwright
npm run typecheck      # tsc --noEmit
npm run lint           # Biome (lint + format check)
npm run lint:fix       # Biome autofix
npm run build          # Library build + .d.ts emit
npm run check:package  # publint + are-the-types-wrong
```

## Conventions

- **Relative imports must carry the `.js` extension.** Without it the emitted
  `.d.ts` files fail Node16 ESM resolution, which `attw` catches.
- **TypeScript 7** with `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, and `verbatimModuleSyntax`. Type-only imports
  need `import type`.
- **Biome**, not ESLint or Prettier. Non-null assertions (`!`) are an error;
  narrow properly instead.
- **CSS is plain modern CSS** compiled by Lightning CSS. No Sass. Use native
  nesting and `color-mix()`. Targets come from `browserslist` in
  `package.json` and must be passed to Lightning CSS explicitly, because Vite
  does not derive them.
- **Tests run in a real browser.** jsdom cannot do the Popover API, the top
  layer, or layout, so it is not an option here. Anything involving the popover
  must account for `toggle` being dispatched asynchronously.

## Release

Changesets drives versioning. Add one with `npx changeset`, then the release
workflow publishes with `--provenance`.
