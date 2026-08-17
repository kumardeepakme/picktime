import { createHighlighter, type Highlighter } from 'shiki';
import type { Plugin } from 'vite';

/**
 * Highlights `<pre data-lang="...">` blocks at build time with Shiki.
 *
 * Build time rather than runtime, so the page ships zero highlighting
 * JavaScript. Dual themes emit `--shiki-light` / `--shiki-dark` custom
 * properties per token, which demo.css maps onto the light and dark bands.
 */

const LANGS = [
  'html',
  'js',
  'jsx',
  'ts',
  'tsx',
  'vue',
  'svelte',
  'css',
  'bash',
];

const unescapeHtml = (input: string): string =>
  input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const BLOCK =
  /<pre([^>]*?)data-lang="([^"]+)"([^>]*)>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>/g;

export const shikiHighlight = (): Plugin => {
  let highlighter: Highlighter | undefined;

  return {
    name: 'demo-shiki',
    async transformIndexHtml(html) {
      highlighter ??= await createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: LANGS,
      });

      const replacements: [string, string][] = [];

      for (const match of html.matchAll(BLOCK)) {
        const [full, before, lang, after, body] = match;
        if (!full || !lang) continue;

        const rendered = highlighter.codeToHtml(
          unescapeHtml(body ?? '').trim(),
          {
            lang: LANGS.includes(lang) ? lang : 'text',
            themes: { light: 'github-light', dark: 'github-dark' },
            defaultColor: false,
          }
        );

        // Shiki emits its own <pre>; keep ours so the demo's classes survive,
        // but carry the `shiki` class across so the token styles still apply.
        const inner = rendered
          .replace(/^<pre[^>]*>/, '')
          .replace(/<\/pre>$/, '');
        const attrs = `${before}${after}`.trim();
        const withClass = attrs.includes('class="')
          ? attrs.replace('class="', 'class="shiki ')
          : `${attrs} class="shiki"`.trim();
        replacements.push([full, `<pre ${withClass}>${inner}</pre>`]);
      }

      let out = html;
      for (const [from, to] of replacements) out = out.replace(from, to);
      return out;
    },
  };
};
