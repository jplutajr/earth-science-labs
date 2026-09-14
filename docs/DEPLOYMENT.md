# Deployment and development

## GitHub Pages

The frontend is a static site with no build command. Optional classroom accounts use a separate Supabase backend; see [Classroom setup](CLASSROOM_SETUP.md).

1. In this repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/ (root)**, then save.
4. Open the Pages deployment from the Actions tab and wait for success.
5. Visit [the lab](https://jplutajr.github.io/earth-science-labs/). Refresh after a deployment if an older version is cached.

The root `.nojekyll` file tells Pages to serve the files directly. Asset paths are relative, so this project works under a repository subpath. The `Lab checks` workflow validates the site; GitHub's separate Pages deployment publishes it when branch publishing is enabled.

If the Pages settings are already configured this way, pushing to main publishes updates automatically. No API token or account credential belongs in these files.

## Local use

Download the repository and open `index.html` in a current desktop or mobile browser. For development and consistent browser storage behavior, serve the directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. Once downloaded, the lab itself works without external scripts or images. Source links require an internet connection.

## Checks

The developer-only test dependency is Playwright. Node 22 and Python 3 are used in the workflow.

```sh
npm install --ignore-scripts --no-audit --no-fund
npx playwright install --with-deps chromium
npm run test:model
npm run test:auth
npm run test:browser
```

Model tests check geodesic measurements, scaling, rounding, calculations, and safe state restoration. Browser tests complete the lab, reject incomplete entries, exercise downloads and reopening work, confirm math edits invalidate saved results, and check keyboard access and mobile overflow. Pushes to main also verify the deployed HTML, scripts, and styles against the current commit and complete a measurement on the live site. Screenshots are saved as test artifacts. Browser test logs also include small visual-review images without student information.

The GitHub workflow also runs the migration and access checks against a disposable PostgreSQL service. To run those checks locally, apply the files in backend/tests/bootstrap.sql, backend/001_classroom.sql, then backend/tests/access.sql to a dedicated disposable database; never run the test bootstrap against production.

Before classroom use, open the site on the school's actual browser and try a measurement, work-file download, reopen, and print. Storage or downloads may be restricted by school settings.

## Files

- `index.html`: accessible lab layout and directions.
- `assets/styles.css`: responsive styles and print layout.
- `assets/model.js`: pure geometry, calculations, state schema.
- `assets/app.js`: interactions, SVG drawing, local save, reports.
- `tests/`: model and browser checks.
- `docs/`: adult guidance and extension plan.

## Changes and recovery

Use a branch and pull request for future changes. Require successful checks before merging when repository settings permit. Review any change to measurements or formulas with the teacher and update the answer key.

If a release introduces a problem, revert its commit through GitHub. Do not rewrite branch history. A change to the measurement protocol should use a new protocol identifier and storage key, with an explicit import migration or a clear incompatible-file message.
