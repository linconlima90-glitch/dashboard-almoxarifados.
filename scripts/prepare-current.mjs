// Build entrypoint: reconcile sources, then align annual views with the valid period.
import './refresh-data-20261015.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
let html=fs.readFileSync('public/index.html','utf8');
const lines=html.split('\n'),i=lines.findIndex(l=>l.startsWith('function minimumRowsForYear('));
assert(i>=0,'Annual minimum function missing');
const before='completeTotal=months.slice(0,completeMonths)';
assert(lines[i].includes(before),'Annual sum source changed');
// A three-month denominator means July-September, not January-March.
lines[i]=lines[i].replace(before,"completeTotal=months.slice(0,y==='2026'?9:completeMonths)");
html=lines.join('\n');
fs.writeFileSync('public/index.html',html);
console.log('Annual periods aligned: 2026 totals through September; denominator 9 or 3 according to history availability.');
