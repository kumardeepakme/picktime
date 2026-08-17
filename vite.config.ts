import { resolve } from 'node:path';
import browserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';
import { defineConfig } from 'vite';
import { shikiHighlight } from './demo/shiki-plugin.js';

const root = import.meta.dirname;

/**
 * Lightning CSS targets must be passed explicitly. Vite's `resolveCSSOptions`
 * defaults them to a hardcoded baseline and never reads `browserslist` or
 * `build.target`, so omitting this silently compiles for the wrong browsers.
 */
const targets = browserslistToTargets(browserslist());

export default defineConfig(({ command, mode }) => {
  const isDemo = command === 'serve' || mode === 'demo';

  return {
    plugins: isDemo ? [shikiHighlight()] : [],
    root: isDemo ? resolve(root, 'demo') : root,
    base: mode === 'demo' ? '/picktime/' : '/',

    css: {
      transformer: 'lightningcss',
      lightningcss: { targets },
    },

    resolve: {
      alias: { picktime: resolve(root, 'src/index.ts') },
    },

    build: isDemo
      ? { outDir: resolve(root, 'demo-dist'), emptyOutDir: true }
      : {
          outDir: 'dist',
          emptyOutDir: true,
          sourcemap: true,
          lib: {
            entry: {
              index: resolve(root, 'src/index.ts'),
              element: resolve(root, 'src/element.ts'),
            },
            formats: ['es'],
          },
          rolldownOptions: {
            external: [/^@floating-ui\//],
          },
        },
  };
});
