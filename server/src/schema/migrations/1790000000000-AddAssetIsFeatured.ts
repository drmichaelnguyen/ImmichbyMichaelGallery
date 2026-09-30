import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "asset" ADD "isFeatured" boolean NOT NULL DEFAULT false`.execute(db);
  await sql`CREATE INDEX "asset_isFeatured_idx" ON "asset" ("isFeatured") WHERE "isFeatured" = true AND "deletedAt" IS NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS "asset_isFeatured_idx"`.execute(db);
  await sql`ALTER TABLE "asset" DROP COLUMN "isFeatured"`.execute(db);
}
