# Initial-load optimization

The source datasets and original page remain in `public`. `src/index.js` remains the authoritative ordered list of patch files, so later stock and movement imports continue through that list.

Wrangler runs `node scripts/build-fast.mjs` before deployment. It writes `dist`, moves the large inline script into a content-addressed asset, packs homogeneous records with an exact deep-equality reconstruction check, and bundles the patch files in their existing order. The stock snapshot is decompressed at build time rather than downloading nine chunks and another dynamic application script in the browser.

`scripts/fast-runtime.js` batches repeated requests to render and only renders the active core tab. New tabs are rendered when visited. HTML is not cached; generated JS hashes change whenever their content changes and are cached privately by the browser. The existing Basic authentication is retained in `src/fast-worker.js` for all responses. No access-control separation or new credentials are introduced.

Use `node scripts/build-fast.mjs --test` then `python tests/test_fast_browser.py` with Playwright/Chromium installed to compare raw stock, movements, purchases, quotes and metadata, and exercise all core and Sao Joao tabs. Build output includes `build-report.json`; the browser test writes `browser-test-report.json`.

The approved two-month minimum is applied to the legacy annual/CDI selectors too; average consumption and historical data are unchanged. The two-month policy module and tire exclusions are retained.

Recovery: `/?legacy=1` or `/sao-joao?legacy=1` uses the original page/injector with the same authentication. To undo the build pipeline entirely, restore `main: src/index.js`, `assets.directory: ./public`, and remove `build.command` in `wrangler.jsonc`.
