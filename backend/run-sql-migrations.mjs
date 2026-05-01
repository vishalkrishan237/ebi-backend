import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const migrationsDir = path.resolve(process.cwd(), "migrations");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run SQL migrations.");
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL.includes("sslmode=require") ||
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

async function ensureMigrationsTable() {
  await client.query(`
    create table if not exists schema_migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    )
  `);
}

async function appliedFilenames() {
  const result = await client.query("select filename from schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

async function run() {
  await client.connect();
  await ensureMigrationsTable();

  const files = (await fs.readdir(migrationsDir))
    .filter((filename) => filename.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const applied = await appliedFilenames();

  for (const filename of files) {
    if (applied.has(filename)) {
      console.log(`skip ${filename}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
    console.log(`apply ${filename}`);

    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

run()
  .then(async () => {
    await client.end();
  })
  .catch(async (error) => {
    console.error(error);
    await client.end();
    process.exit(1);
  });
