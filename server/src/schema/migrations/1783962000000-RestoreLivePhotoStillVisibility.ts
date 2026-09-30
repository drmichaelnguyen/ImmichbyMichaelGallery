import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // (#29836) Reset the visibility of any still images that are hidden and have a motion part.
  // This migration follows Michael's Gallery shared-link migrations in existing installations.
  await sql`
    UPDATE "asset"
    SET "visibility" = 'timeline'
    WHERE "type" = 'IMAGE'
      AND "visibility" = 'hidden'
      AND "livePhotoVideoId" IS NOT NULL
  `.execute(db);
}

export async function down(): Promise<void> {
  // Not implemented: the previous 'hidden' value was itself the bug.
}
