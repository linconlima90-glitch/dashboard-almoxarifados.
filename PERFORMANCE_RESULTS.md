# Performance verification - 08 October 2026

Tested application commit: `274c86cbe53970b8bab4f73f30a0513fe8c8260d`.
Baseline application commit: `e0c8d6c257a16c0bc35acccc1f631dbfd32ecb54`.
Successful GitHub Actions run: https://github.com/linconlima90-glitch/dashboard-almoxarifados./actions/runs/37795331873
Browser job and source logs: https://github.com/linconlima90-glitch/dashboard-almoxarifados./actions/runs/37795331873/job/113373183610

## Controlled browser measurements

Chromium running on the same GitHub-hosted Ubuntu runner, with each page served by a local HTTP server. Navigation timing is `performance.getEntriesByType('navigation')[0].loadEventEnd`. These are single-run regression measurements, not live Cloudflare or end-user connection measurements.

| Page | Original navigation (ms) | Optimized navigation (ms) | Original requests | Optimized requests |
| --- | ---: | ---: | ---: | ---: |
| Management | 4457.7 | 713.0 | 50 | 5 |
| Sao Joao | 4542.6 | 843.9 | 51 | 5 |

All four tested pages reported no uncaught JavaScript errors. Core tabs and filters in management, and all four Sao Joao tabs, passed interaction checks.

## Data preservation

Exact before/after equality passed for the tested raw stock fields, movement totals and monthly averages, October movement fields, purchase history, quotations, and stock metadata in both routes.

Final stock in both versions: 3,714 rows; total value R$ 2,263,730.43.
Minimum-policy checks passed for two months in local, annual and CDI calculations. The existing tire exclusions and partial-October monthly-average policy remain in the application.

## Build results

The original HTML was 10,408,345 bytes including its inline data and application code. Optimized HTML is 65,308 bytes for management and 65,306 bytes for Sao Joao. Data and application code are not removed: they are in three deferred, content-addressed JavaScript assets.

Management JavaScript: 6,105,690 uncompressed bytes, 817,009 bytes when gzip-compressed in the build measurement. Sao Joao: 6,130,550 uncompressed bytes, 822,748 gzip bytes. Eight homogeneous datasets passed lossless reconstruction checks during compilation.

Only generated content-addressed assets are eligible for long-lived private browser caching. HTML remains private/no-store and references new asset hashes when source content changes. The existing authentication is retained on all routes.

These results do not establish that the Cloudflare production deployment has completed. Verify the deployment separately; successful responses from the optimized worker include `X-Dashboard-Build: fast-20261008`.
