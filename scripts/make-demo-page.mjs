// Packs a web build into ONE self-contained HTML page (code, styles, icon font and images inlined),
// for sharing a clickable demo where only a single page can be hosted.
//   EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir dist-demo
//   node scripts/make-demo-page.mjs dist-demo demo.html
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dist = 'dist-demo', out = 'demo.html'] = process.argv.slice(2);
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
const reset = html.match(/<style id="expo-reset">([\s\S]*?)<\/style>/)?.[1] ?? '';

const MIME = { png: 'image/png', ttf: 'font/ttf', jpg: 'image/jpeg' };
const keep = (path) => /\.(png|jpg)$/.test(path) || /Ionicons\.[a-f0-9]+\.ttf$/.test(path); // only the icon font the app uses
let embedded = 0;
const inlineAssets = (code) =>
  code.replace(/"(\/assets\/[^"]+)"/g, (whole, path) => {
    if (!keep(path)) return whole;
    embedded++;
    const ext = path.split('.').pop();
    return `"data:${MIME[ext]};base64,${readFileSync(join(dist, path)).toString('base64')}"`;
  });

const js = scripts.map((s) => inlineAssets(readFileSync(join(dist, s), 'utf8')).replace(/<\/script/gi, '<\\/script')).join('\n;\n');
const css = styles.map((s) => readFileSync(join(dist, s), 'utf8')).join('\n');

const page = `<title>VV inc. Demo</title>
<style>
${reset}
html, body { background: #f6f4fa; }
${css}
.leaflet-container { background: #e4e8ee; }
</style>
<div id="root"></div>
<script>
  // The app's navigation reads the page path; start it at "/" wherever this page is hosted.
  try { history.replaceState(null, '', '/' + location.hash); } catch (e) {}
</script>
<script>
${js}
</script>
`;
writeFileSync(out, page);
console.log(`Wrote ${out}: ${(page.length / 1e6).toFixed(1)} MB, ${scripts.length} script(s), ${styles.length} stylesheet(s), ${embedded} embedded asset(s)`);
