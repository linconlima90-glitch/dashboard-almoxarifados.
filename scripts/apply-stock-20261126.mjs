import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// Replace only the physical ERP inventory. Withdrawals remain certified through
// 25 November, and approved managerial costs are still applied by the runtime.
export function applyStock20261126(root,out){
  const sha=s=>createHash('sha256').update(s).digest('hex');
  const encoded=fs.readFileSync(path.join(root,'data/stock-snapshot-20261126.b64'),'utf8').trim();
  assert.equal(sha(encoded),'eeb8ef2d8f0e6b378cef608a233ac7ede5397a8a1d4dae066ee7889713bab5ef',
    '26 November ERP stock package changed; review the source before importing');
  const snapshot=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
  const m=snapshot.meta;
  assert.equal(snapshot.schemaVersion,1);
  assert.deepEqual(snapshot.columns,['empresa','codigo_local','local','codigo','produto',
    'grupo','un','estoque','custo_estoque','valor_estoque']);
  assert.equal(m.date,'26/11/2026 10:04:55');
  assert.equal(m.source,'Estoques_analitico(20261126-131412).xlsx');
  assert.equal(m.sourceSHA256,'2bf5b629272579755311ba542da173431f0420ed57e28152065c9c6a192a6211');
  assert.equal(m.records,4450);
  assert.equal(m.cents,240027941);
  assert.equal(m.products,3683);
  assert.equal(m.warehouses,9);
  assert.equal(m.previous,'25/11/2026 15:59:16');
  assert.equal(m.previousRecords,4443);
  assert.equal(m.previousCents,239771283);
  assert.equal(snapshot.rows.length,m.records);
  for(const r of snapshot.rows){
    assert(Array.isArray(r)&&r.length===10,'Invalid ERP stock row schema');
    assert([0,1,2,3,4,5,6].every(i=>r[i]!==null&&r[i]!==undefined&&String(r[i]).trim()),
      'Missing ERP stock identity or description');
    assert([7,8,9].every(i=>typeof r[i]==='number'&&Number.isFinite(r[i])),
      'Non-numeric ERP stock quantity or value');
    assert(r[7]>0&&r[8]>=0&&r[9]>=0,'Invalid ERP stock quantity or value');
  }
  const key=r=>[r[0],r[1],r[3],r[6]].map(String).join('|');
  const cents=rows=>rows.reduce((total,r)=>total+Math.round(Number(r[9])*100),0);
  const current=new Map(snapshot.rows.map(r=>[key(r),r]));
  assert.equal(current.size,m.records,'Duplicate ERP fiscal stock position');
  assert.equal(cents(snapshot.rows),m.cents);
  assert.equal(new Set(snapshot.rows.map(r=>String(r[1]))).size,m.warehouses);
  assert.equal(new Set(snapshot.rows.map(r=>String(r[3]))).size,m.products);

  const partName=i=>'stock-current-20261103-1558-'+String(i+1).padStart(2,'0')+'.js';
  let previous64='';
  for(let i=0;i<12;i++){
    const filename=partName(i);
    const match=fs.readFileSync(path.join(out,filename),'utf8')
      .match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/);
    assert(match,'ERP stock fragment missing: '+filename);
    previous64+=match[1];
  }
  const prefix='window.CURRENT_STOCK_20260911=';
  const raw=gunzipSync(Buffer.from(previous64,'base64')).toString('utf8').trim();
  assert(raw.startsWith(prefix)&&raw.endsWith(';'),'Invalid current ERP stock payload');
  const stock=JSON.parse(raw.slice(prefix.length,-1));
  assert.equal(stock.meta.emissao,m.previous);
  assert.equal(stock.meta.sourceSHA256,'39e98fb8692360c5696c7b327f19fb80b1b8118cfab2290b0e27866d1e818416');
  assert.equal(stock.meta.registros,m.previousRecords);
  assert.equal(stock.meta.posicoes,m.previousRecords);
  assert.equal(Math.round(stock.meta.valor*100),m.previousCents);
  assert.equal(Math.round(stock.meta.valor_estoque*100),m.previousCents);
  assert.equal(stock.rows.length,m.previousRecords);
  assert.equal(cents(stock.rows),m.previousCents);
  const previous=new Map(stock.rows.map(r=>[key(r),r]));
  assert.equal(previous.size,m.previousRecords,'Duplicate previous ERP fiscal stock position');
  const added=[...current.keys()].filter(k=>!previous.has(k)).length;
  const removed=[...previous.keys()].filter(k=>!current.has(k)).length;
  const revised=[...current].filter(([k,r])=>previous.has(k)&&JSON.stringify(previous.get(k))!==JSON.stringify(r)).length;
  const renamed=[...current].filter(([k,r])=>previous.has(k)&&previous.get(k)[4]!==r[4]).length;
  const unchanged=m.records-added-revised;
  assert.equal(added,9);assert.equal(removed,2);assert.equal(revised,33);
  assert.equal(renamed,0);assert.equal(unchanged,4408);

  // Change only the balance date in the explanatory text. The withdrawal date,
  // records, amounts and all historical/purchase data files remain unchanged.
  const reconcileFile=path.join(out,'movement-reconcile-full-20261103.js');
  const reconcile=fs.readFileSync(reconcileFile,'utf8');
  const balanceText='saldo ERP de 25/11 sem desconto adicional.';
  assert.equal(reconcile.split(balanceText).length,2,'ERP balance summary changed');
  assert(reconcile.includes('Baixas ERP (data de negociação): 14/03/2024 a 25/11/2026'),
    'Withdrawal history must remain certified through 25 November');
  const nextReconcile=reconcile.replace(balanceText,'saldo ERP de 26/11 sem desconto adicional.');

  stock.rows=snapshot.rows;
  stock.meta={...stock.meta,emissao:m.date,registros:m.records,posicoes:m.records,
    valor:m.cents/100,valor_estoque:m.cents/100,locais:m.warehouses,warehouses:m.warehouses,
    products:m.products,sourceFile:m.source,sourceSHA256:m.sourceSHA256,sha256:sha(encoded),
    previousSnapshot:m.previous,previousRecords:m.previousRecords,previousValue:m.previousCents/100,
    newRows:added,updatedRows:revised,removedRows:removed,renamedRows:renamed,unchangedRows:unchanged,
    source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade'};
  const packed=gzipSync(Buffer.from(prefix+JSON.stringify(stock)+';\n'),{level:9,mtime:0}).toString('base64');
  const partSize=Math.ceil(packed.length/12);
  for(let i=0;i<12;i++)fs.writeFileSync(path.join(out,partName(i)),
    'window.CURRENT_STOCK_GZ'+(i===0?'':'+')+"='"+packed.slice(i*partSize,(i+1)*partSize)+"';\n");
  fs.writeFileSync(reconcileFile,nextReconcile);
  const result={date:m.date,source:m.source,sourceSHA256:m.sourceSHA256,sha256:sha(encoded),
    records:m.records,cents:m.cents,products:m.products,warehouses:m.warehouses,
    previousDate:m.previous,previousRecords:m.previousRecords,previousCents:m.previousCents,
    added,removed,revised,renamed,unchanged,historyUntouched:true,purchasesUntouched:true,
    withdrawalsThrough:'2026-11-25',physicalBalanceNotReducedByWithdrawals:true};
  fs.writeFileSync(path.join(root,'build-stock-20261126.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
