import { resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import browserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;
const targets = browserslistToTargets(browserslist());

type Engine = 'chromium' | 'firefox' | 'webkit';
const ENGINES: Engine[] = ['chromium', 'firefox', 'webkit'];
const isEngine = (value: string): value is Engine =>
  (ENGINES as string[]).includes(value);

const browsers = (process.env.BROWSERS ?? 'chromium')
  .split(',')
  .map(name => name.trim())
  .filter(isEngine);

/**
 * Kept separate from vite.config.ts on purpose: that config sets `build.lib`,
 * which Vitest would otherwise inherit.
 */
export default defineConfig({
  css: {
    transformer: 'lightningcss',
    lightningcss: { targets },
  },
  resolve: {
    alias: { picktime: resolve(root, 'src/index.ts') },
  },
  test: {
    include: ['test/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // BROWSERS=chromium,firefox,webkit to widen the run. Defaults to
      // chromium locally for speed; CI sets all three.
      instances: browsers.map(browser => ({ browser })),
    },
  },
});
