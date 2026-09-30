# Agent instructions

Read `MICHAELS_GALLERY.md` before making changes.

This is a customized Immich 3.2.2 fork, not a stock upstream checkout. Preserve Michael's Gallery features and the documented migration order. The companion Docker deployment lives in `drmichaelnguyen/immich-app-deploy`; do not claim to have validated local Docker, storage, or database state unless that separate environment is actually available.

Use Node 22. Build both web and server, verify migration order for migration changes, and commit source fixes to `gallery-v3.2.2-custom` so local and remote agents see the same code.
