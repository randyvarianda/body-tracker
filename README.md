https://randyvarianda.github.io/body-tracker/

Use the **+** circle to add a profile, then click a person's initials to switch. The active profile is highlighted in green. Each profile has its own measurements, charts, history, and CSV imports and exports. New profiles start empty. Existing browser records are preserved under Randy, and the selected profile is remembered after refresh.

**Remove profile** deletes the selected profile and its measurements after confirmation. Export its CSV first if you want a backup. At least one profile must remain.

Data is stored in this browser only. Profiles are not password-protected accounts and do not sync across devices. Export a CSV for each profile to keep a backup. Importing a CSV updates matching dates in the profile selected when the import started.

## Development

Serve the repository with `python3 -m http.server 4173`, then open `http://localhost:4173`.

Run `npm ci` and `npm test` for storage, migration, and isolation tests. Run `npm run test:browser` for the browser flows (requires Google Chrome and Python 3).
