// Copies the shared rules (src/logic) into the server's Edge Functions so app and server use the
// exact same code. Deno needs explicit ".ts" on relative imports, so this adds them.
// Run after editing anything in src/logic:  npm run sync:server
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const from = 'src/logic';
const to = 'supabase/functions/_shared/logic';
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from)) {
  if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
  const code = readFileSync(join(from, f), 'utf8').replace(/from '(\.\/[^']+)'/g, (_, p) => `from '${p}.ts'`);
  writeFileSync(join(to, f), `// GENERATED from src/logic/${f} by scripts/sync-server-logic.mjs. Edit the original, not this copy.\n${code}`);
}
console.log(`Synced ${from} -> ${to}`);
