# Michael's Gallery development notes

This fork contains the customized Immich source for PhotoStorage. The active production branch is `gallery-v3.2.2-custom`, based on Immich 3.2.2.

The companion deployment repository is `https://github.com/drmichaelnguyen/immich-app-deploy`. Its `build-branding.sh` compiles this repository, stages `server/dist` and `web/build`, builds the custom Docker image, and deploys the Compose stack.

## Remote-agent boundary

A remote agent working from this repository cannot automatically access the companion deployment checkout, ignored `.env`, Docker Desktop, `/Volumes/photostorage`, the PostgreSQL migration ledger, or uncommitted local files. It can validate source builds, but local Docker and database claims require a local agent or an explicitly provisioned equivalent environment.

Commit and push fixes needed by deployment. Do not tell a remote agent to infer local container or database state from this source tree.

## Required checks

Use Node 22 and the repository's pnpm version.

```bash
pnpm --filter @immich/sdk --filter immich-web build
pnpm --filter @immich/sdk --filter @immich/plugin-sdk --filter immich build
pnpm --filter immich migrations:verify-order
```

The deployment build cleans `web/build` and `server/dist` first. This is essential after migration renames because Nest compilation does not delete obsolete generated files.

## Custom migration history

Production already applied these custom migrations before the later upstream migration:

1. `1783960000000-AddSharedLinkUploadExpiresAt`
2. `1783961000000-AddSharedLinkUploadPassword`
3. `1783962000000-RestoreLivePhotoStillVisibility`

Keep this sequence in `server/src/schema/migrations/ORDER`. Never rename an applied migration. New migrations must sort after the last applied migration.

The featured-gallery migration is `1790000000000-AddAssetIsFeatured` and has been applied in production.

## Upgrade fixes

- `web/src/lib/utils.ts`: retain only the guarded, WebView-aware `downloadBlob` implementation.
- `server/src/repositories/media.repository.ts`: use `sharpen({ sigma, m1, m2 })` for Sharp 0.35 typings.
- `server/src/constants.ts`: every `ApiTag` enum member, including `Featured`, must have an `endpointTags` entry.
- Migration filenames, the `ORDER` file, compiled output, and the production ledger must remain consistent.
