import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export async function runMigrations(sql: postgres.Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     int PRIMARY KEY,
      filename    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql<{ version: number }[]>`SELECT version FROM schema_migrations`)
      .map((r) => r.version),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    const match = filename.match(/^(\d+)_/);
    if (!match) continue;
    const version = parseInt(match[1]!, 10);
    if (applied.has(version)) continue;

    const body = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
    console.log(`[migrate] applying ${filename}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`
        INSERT INTO schema_migrations (version, filename) VALUES (${version}, ${filename})
      `;
    });
    console.log(`[migrate] applied ${filename}`);
  }
}

// Allow running as a standalone script: node dist/src/storage/migrate.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is required'); process.exit(1); }
  const sql = postgres(url, { max: 1 });
  runMigrations(sql)
    .then(() => { console.log('[migrate] done'); sql.end(); })
    .catch((e) => { console.error('[migrate] failed:', e); process.exit(1); });
}
