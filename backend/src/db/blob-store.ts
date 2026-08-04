import { query } from "./pool.js";

export async function readBlob<T>(key: string, fallback: T): Promise<T> {
  const result = await query<{ value: T }>(
    "SELECT value FROM app_blobs WHERE key = $1",
    [key],
  );
  if (!result.rows[0]) return fallback;
  return result.rows[0].value;
}

export async function writeBlob(key: string, value: unknown) {
  await query(
    `INSERT INTO app_blobs(key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)],
  );
}

export async function readSitePackFile(id: string): Promise<Buffer | null> {
  const result = await query<{ content: Buffer }>(
    "SELECT content FROM site_pack_file_blobs WHERE id = $1",
    [id],
  );
  return result.rows[0]?.content ?? null;
}

export async function writeSitePackFile(id: string, content: Buffer) {
  await query(
    `INSERT INTO site_pack_file_blobs(id, content, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id)
     DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
    [id, content],
  );
}

export async function deleteSitePackFile(id: string) {
  await query("DELETE FROM site_pack_file_blobs WHERE id = $1", [id]);
}
