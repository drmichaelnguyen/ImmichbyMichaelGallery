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

Source builds do not prove that the production JavaScript bundle initializes correctly. The local deployment owner must also complete the production-browser checks documented in the companion deployment repository.

## Production web bundle incident (2026-09-30)

The public app previously failed during module initialization with minified errors including:

- `No is not a function`
- `Is is not a constructor`
- `W is not a constructor`
- `st is not a constructor`

Vite 8/Rolldown had split `@immich/ui`, Bits UI, and their module-level state across circular chunks. A first workaround rewrote one `svelte-toolbelt` initializer, but that only moved the failure to the next early class constructor. The durable fix is the `immich-ui` code-splitting group in `web/vite.config.ts`. Rolldown includes that group's dependencies recursively, keeping the UI initialization graph together instead of emitting circular app chunks.

Do not remove or narrow that group based only on a successful `vite build`. If the dependency layout or bundler configuration changes, rebuild and verify a clean production bundle in a real browser. A minified symbol changing names does not indicate a new root cause when the stack still fails during module initialization.

Acceptance criteria for a deployed web change:

1. `https://gallery.drmichael.me/` returns HTTP 200 and renders the gallery heading.
2. `/auth/login` returns HTTP 200 and renders the login form.
3. A clean browser context reports no `pageerror`, error-level console message, failed request, or response with status 400 or greater during either page load.
4. `/api/server/version`, `/api/server/ping`, and `/api/featured/assets` succeed through the public hostname.
5. The public HTML references the current bundle, not a chunk name from an earlier failing report.

The empty featured-gallery state is valid when `/api/featured/assets` returns `[]`; it is not a JavaScript failure.

## External-agent handoff

Give an external agent all of the following before asking it to change this fork:

- source repository, branch, and current commit;
- companion deployment repository, branch, and relevant deployment files;
- pinned Immich version and Node version;
- the exact source build command and the local `./build-branding.sh` deployment command;
- the public hostname and production-browser acceptance criteria above;
- complete browser errors and the asset filenames that produced them;
- an explicit list of unavailable local resources such as `.env`, Docker, database, and `/Volumes/photostorage`.

The external agent should commit and push source-only fixes, state which runtime checks it could not perform, and provide the commit for handoff. The local agent must then pull that commit, build both source targets, deploy through the companion repository, verify Docker/API state, and run the public-browser checks. Do not exchange uncommitted patches between agents or treat a remote source build as deployment proof.

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
