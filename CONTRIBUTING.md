# Contributing

Thanks for taking a look.

## Setup

Requires Node `^20.19.0 || >=22.12.0`.

```sh
npm install
npx playwright install chromium
npm run dev
```

`npm run dev` serves the demo in `demo/`, which is the fastest way to see a
change. It imports the library from source, so edits hot-reload.

## Before opening a pull request

```sh
npm run typecheck
npm run lint
npm test
```

If you touched anything that ships, also run:

```sh
npm run build && npm run check:package
```

## Tests

Tests run in a real browser through Playwright, because the component depends on
the Popover API, the top layer, and real layout. jsdom cannot provide those.

- Pure logic (`controller`, `parse`, `format`) gets unit tests.
- Anything involving the element gets an integration test in
  `test/element.test.ts`.
- The popover `toggle` event is asynchronous. Let it settle before asserting on
  focus or position.

## Changesets

Every user-visible change needs a changeset:

```sh
npx changeset
```

Pick the bump type, write a sentence in the voice of a changelog entry, and
commit the generated file alongside your change.

## Style

Biome handles formatting and linting; run `npm run lint:fix` rather than
hand-formatting. See [AGENTS.md](AGENTS.md) for the architectural invariants
worth preserving.
