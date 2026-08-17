# picktime

## 3.0.1

### Patch Changes

- [#3](https://github.com/kumardeepakme/picktime/pull/3) [`33c60d6`](https://github.com/kumardeepakme/picktime/commit/33c60d64370810d101577a7b233bf32a974378f1) Thanks [@kumardeepakme](https://github.com/kumardeepakme)! - README images now use absolute `raw.githubusercontent.com` URLs, so the cover
  and theming screenshots render on npm as well as on GitHub. Relative paths only
  resolved against the repository, leaving the npm page with broken images.

## 3.0.0

A rewrite. PickTime is now a form-associated custom element rather than a class
that decorates a text input.

### Breaking changes

- **New API.** The component is `<pick-time>`. `new PickTime(input, options)`
  still works through a compatibility shim that mounts the element and mirrors
  the value back to your input, but it logs a deprecation warning. See the
  migration table in the README.
- **`value` is the machine format** (`HH:mm` / `HH:mm:ss`), not a display
  string. Formatted output is derived from the locale on demand.
- **Segments step independently.** Incrementing 09:59 by one minute now gives
  09:00 rather than 10:00, matching `<input type="time">` and the ARIA
  spinbutton role.
- **`min` and `max` mark the value invalid rather than clamping it**, matching
  the platform. A `max` earlier than `min` describes a range crossing midnight.
- **Theming is not a breaking change.** Every `--pt-*` custom property from v2
  keeps its name and meaning; only the selector moves from
  `.picktime--theme-*` onto the element.
- **The stylesheet import is gone.** Styles ship inside the component's shadow
  root; `import 'picktime/dist/picktime.min.css'` no longer exists. Theming
  moves to CSS custom properties on the element and `::part()`.
- **Removed options:** `upDownKeys` and `wheelSpin` (both always on now, since
  disabling them was an accessibility regression), `animation` (use
  `--pt-duration` / `--pt-easing`), and `arrow` (hide via `::part(arrow)`).
- **ESM only**, with a proper `exports` map and published type declarations.
- **Browser support floor** is now Chrome 114, Edge 114, Firefox 125, Safari 17,
  set by the Popover API and `ElementInternals`.

### Added

- Real form participation through `ElementInternals`: `FormData`,
  `form.reset()`, `labels`, `checkValidity()`, `reportValidity()`, and the
  `user-invalid` custom state.
- Constraint validation with `valueMissing`, `rangeUnderflow`, `rangeOverflow`,
  and `badInput`.
- `min` and `max`, including reversed ranges that cross midnight.
- Typed keyboard entry with lenient parsing (`9:30 pm`, `0930`, `21:30`, `9.30`).
  v2 forced `readonly` on the input, so typing was impossible.
- Full ARIA spinbutton semantics on each segment, plus a live region announcing
  the committed time.
- <kbd>Home</kbd>, <kbd>End</kbd>, <kbd>Page Up</kbd>, and <kbd>Page Down</kbd>
  keyboard support.
- A focus trap: <kbd>Tab</kbd> cycles the visible segments while the panel is
  open, skips hidden ones, and focus returns to the field on close.
- `hour-cycle` accepts the plain aliases `12` and `24` alongside the CLDR names.
- `animation` attribute (`drop`, `fade`, `none`).
- `--pt-field-padding`, `--pt-field-border-radius`, `--pt-field-border-color`,
  `--pt-field-background` and `--pt-field-color`, so the trigger can be
  restyled independently of the panel.
- Localisation through `Intl`: locale-driven hour cycle, day-period labels,
  separators, and RTL.
- Optional seconds segment via the `seconds` attribute.
- `hour-cycle` supporting `h11`, `h12`, `h23`, and `h24`.
- `valueAsNumber` and `valueAsObject` accessors.
- `picktime/element` subpath for registering under a custom tag name.

### Fixed

- `autoUpdate` was started on every focus and never disposed, leaking a scroll
  and resize loop per open.
- The instance ID came from a static counter that `destroy()` decremented, so
  creating a picker after destroying one produced colliding radio names and two
  pickers fighting over meridiem state.
- Clicking the arrow threw, because `className.startsWith` was called on an
  `SVGAnimatedString`.
- `hours: 0` was silently coerced to `12`, and `minutes: 0` skipped validation,
  both from truthiness checks on values where `0` is meaningful.
- `setTime()` without a `meridiem` threw on a 12-hour clock.
- Minute stepping skipped reachable values when the step did not divide 60.
- The panel only dismissed on `mousedown`, so touch never closed it, and there
  was no Escape handling.
- The panel could be clipped by an `overflow: hidden` ancestor. It now renders
  in the top layer.
- Hardcoded `tabindex="1"` through `"4"` hijacked the page's tab order and
  collided between pickers.
- Clicking the field did not open the panel. Opening on `pointerdown` meant the
  popover's own light dismiss fired on the matching `pointerup` and closed it
  again; only a long press appeared to work.
- The field stopped reflecting the value once the panel was open, because
  `document.activeElement` retargets to the host whenever anything in the shadow
  root has focus.
- Closing the panel returned focus to the field, which immediately reopened it,
  so <kbd>Esc</kbd> and `hidePicker()` appeared to do nothing.
- The seconds segment rendered even when disabled, because a class rule setting
  `display` outbids the UA's `[hidden]` rule.
- Day-period labels wider than two ASCII characters overflowed the panel and
  wrapped, which broke ja-JP (午前/午後). The buttons now grow past the 28px
  square when the locale needs it.
- `disabled` was styled but never enforced: segment keys, the wheel and the
  meridiem buttons all still changed the value, and neither `aria-disabled` nor
  the buttons' `disabled` reflected it.
- A disabled ancestor (`<fieldset disabled>`) did not disable the control, and
  any later attribute change re-enabled a form-disabled one.
- Assigning an unparseable string to `value` silently kept the previous value
  instead of clearing it, and never reported `badInput`.
- A single typed edit emitted two or three `change` events, because the commit
  path runs from the field's `change`, its `blur` and Enter. Committing is now
  idempotent and emits only when the value actually moves.
- The inner field's native `input` event is composed, so it crossed the shadow
  boundary and reached consumers retargeted onto the host, indistinguishable
  from the one emitted on commit. One edit now emits exactly one `input`.
- `placement` and `offset` were read once at the first open and cached, so
  changing either afterwards had no effect.
- `placeholder` was not observed, so setting it after connection did nothing.
- Focusing the editable field immediately moved focus into the picker, making
  the advertised typed-input path unusable with a real keyboard or touch
  keyboard. A normal click now keeps focus in the field; Arrow Down and
  `showPicker()` move into the segments explicitly.
- Associated labels exposed through `ElementInternals.labels` did not focus or
  name the shadow input. Label activation now focuses it, and its accessible
  name, required state, expanded state and invalid state are exposed directly.
- Assigning `value` or `valueAsNumber` did not set the live-value dirty flag, so
  a later `min`, `max`, locale, placement or other observed attribute change
  silently restored the default value. Pre-connection assignments were lost
  for the same reason.
- Empty optional controls were omitted from `FormData` instead of contributing
  an empty string like `<input type="time">`.
- An invalid typed value lost `badInput` after any unrelated attribute change.
- Left and right placements positioned the arrow correctly but left its glyph
  pointing vertically. Placement and offset changes now also reposition an
  already-open panel.
- The documented `secondStep`, `placement`, `offset`, `placeholder`, `theme`
  and `animation` reflected properties were missing.
- `valueAsNumber = NaN` corrupted controller state and crashed formatting, an
  invalid locale crashed the custom-element reaction, and hidden seconds made
  `value` disagree with `valueAsNumber`.
- The v2 compatibility shim reset live values after option changes and did not
  restore the original input's hidden, disabled and value state on destroy.
- The demo overflowed tablet and mobile viewports, its clock selector could
  disagree with the browser locale, and placement choices were hard to inspect
  because selecting one dismissed the panel.
- Rotating the arrow's rectangular layout box distorted it and pulled it inside
  the panel for left and right placements. A square positioning box keeps the
  triangle undistorted, while side-aware overlap hides the panel border beneath
  its base on every edge. Light/dark themes also gain a muted
  `--pt-accent-color` for subtle panel and control borders.

### Changed

- Toolchain: TypeScript 7, Vite 8 (Rolldown), Vitest 4 in real browsers, Biome,
  and Lightning CSS. Sass, Babel, PostCSS, ESLint, Prettier, and stylelint are
  gone.
- Packaging is validated in CI by `publint` and `@arethetypeswrong/cli`.

### Docs

- Added `TODO.md` covering remaining work, publishing steps and versioning
  rules.

## 2.0.1

See the [release notes](https://github.com/kumardeepakme/picktime/releases).
