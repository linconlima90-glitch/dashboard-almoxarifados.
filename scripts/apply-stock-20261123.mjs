import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// Entire ERP physical inventory snapshot, without altering withdrawals or purchases.
export function applyStock20261123(root,out){
  const snap=JSON.parse(fs.readFileSync(path.join(root,'data/stock-snapshot-20261123.json'),'utf8'));
  const meta=snap.meta;
  assert.equal(meta.date,'23/11/2026 08:56:02');
  assert.equal(meta.records,4435);
  assert.equal(meta.cents,238539315);
  assert.equal(snap.rows.length,meta.records);
  const key=r=>[String(r[0]),String(r[1]),String(r[3]),String(r[6])].join('|');
  const byKey=new Map(snap.rows.map(r=>[key(r),r]));
  assert.equal(byKey.size,snap.rows.length,'Duplicate ERP fiscal stock position');
  assert.equal(new Set(snap.rows.map(r=>String(r[1]))).size,9);
  assert(snap.rows.every(r=>r.length===10&&Number(r[7])>0&&Number(r[9])>=0));
  assert.equal(snap.rows.reduce((n,r)=>n+Math.round(Number(r[9])*100),0),meta.cents);
  let compressed='';
  for(let i=1;i<=12;i++){
    const name='stock-current-20261103-1558-'+String(i).padStart(2,'0')+'.js';
    const s=fs.readFileSync(path.join(out,name),'utf8');
    const m=s.match(/window\\.CURRENT_STOCK_GZ(?:\\+)?='([^']+)';/);
    assert(m,'Missing stock part '+name);
    compressed+=m[1];
  }
  const prefix='window.CURRENT_STOCK_20260911=';
  const original=gunzipSync(Buffer.from(compressed,'base64')).toString('utf8').trim();
  assert(original.startsWith(prefix));
  const old=JSON.parse(original.slice(prefix.length).replace(/;$/,''));
  assert.equal(old.rows.length,4459);
  assert.equal(old.meta.emissao,'22/11/2026 14:52:02');
  assert.equal(old.rows.reduce((n,r)=>n+Math.round(Number(r[9])*100),0),243592356);
  const prev=new Map(old.rows.map(r=>[key(r),r]));
  assert.equal(prev.size,old.rows.length);
  const added=[...byKey.keys()].filter(k=>!prev.has(k)).length;
  const removed=[...prev.keys()].filter(k=>!byKey.has(k)).length;
  const revised=[...byKey].filter(([k,r])=>prev.has(k)&&JSON.stringify(prev.get(k))!==JSON.stringify(r)).length;
  const unchanged=meta.records-added-revised;
  old.rows=snap.rows;
  old.meta={...old.meta,emissao:meta.date,registros:meta.records,posicoes:meta.records,
    valor:meta.cents/100,sourceFile:meta.source,previousSnapshot:'22/11/2026 14:52:02',
    sha256:createHash('sha256').update(JSON.stringify(snap)).digest('hex'),
    newRows:added,updatedRows:revised,removedRows:removed,unchangedRows:unchanged,warehouses:9,
    source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade'};
  const packed=gzipSync(Buffer.from(prefix+JSON.stringify(old)+';\\n'),{level:9,mtime:0}).toString('base64');
  const n=Math.ceil(packed.length/12);
  for(let i=0;i<12;i++){
    const name='stock-current-20261103-1558-'+String(i+1).padStart(2,'0')+'.js';
    fs.writeFileSync(path.join(out,name),
      'window.CURRENT_STOCK_GZ'+(i===0?'':'+')+"='"+packed.slice(i*n,(i+1)*n)+"';\\n");
  }
  const result={date:meta.date,source:meta.source,records:meta.records,cents:meta.cents,
    previousRecords:prev.size,previousCents:243592356,added,removed,revised,unchanged,
    historyUntouched:true,purchasesUntouched:true,physicalBalanceNotReducedByWithdrawals:true};
  fs.writeFileSync(path.join(root,'build-stock-20261123.json'),JSON.stringify(result,null,2)+'\\n');
  return result;
}
