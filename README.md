https://randyvarianda.github.io/body-tracker/

Use **Add profile** to create a separate tracker, then select a name from **Profile** to switch. Each profile has its own measurements, charts, history, and CSV imports and exports. New profiles start empty. Existing browser records are preserved under Randy, and the selected profile is remembered after refresh.

Data is stored in this browser only. Profiles are not password-protected accounts and do not sync across devices. Export a CSV for each profile to keep a backup. Importing a CSV updates matching dates in the profile selected when the import started.

## Development

Serve the repository with `python3 -m http.server 4173`, then open `http://localhost:4173`.

Run `npm ci` and `npm test` for storage, migration, and isolation tests. Run `npm run test:browser` for the browser flows (requires Google Chrome and Python 3).
