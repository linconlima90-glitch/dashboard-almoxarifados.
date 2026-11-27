import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';

const checksum=s=>createHash('sha256').update(s).digest('hex');
const unpack=text=>JSON.parse(gunzipSync(Buffer.from(text.trim(),'base64')).toString('utf8'));
const read=(root,p)=>fs.readFileSync(path.join(root,p),'utf8');
const file=(out,p)=>path.join(out,p);
const write=(out,p,text)=>fs.writeFileSync(file(out,p),text,'utf8');
const key=r=>[r[0],r[1],r[3],r[6]].map(String).join('|');
const stockPart=i=>'stock-current-20261103-1558-'+String(i).padStart(2,'0')+'.js';

export function applyStock20261127(root,out){
  const encoded=read(root,'data/stock-delta-20261127.b64').trim();
  assert.equal(checksum(encoded),'a975137e26265975770ea4c84ffd093b958dfe4bef17918219305558636edf0c');
  const delta=unpack(encoded),m=delta.meta;
  assert.equal(delta.schemaVersion,1);
  assert.equal(m.date,'27/11/2026 14:12:32');
  assert.equal(m.sourceSHA256,'017440c36903404e0b57a32362ebe797373d1bec30274f48dbe6ed15407fcd85');
  assert.equal(m.records,4440);assert.equal(m.cents,238925248);
  assert.deepEqual([delta.added.length,delta.removed.length,delta.changed.length],
    [m.added,m.removed,m.changed]);
  assert.deepEqual([m.added,m.removed,m.changed,m.unchanged],[2,12,101,4337]);

  let packed='';
  for(let i=1;i<=12;i++){
    const match=fs.readFileSync(file(out,stockPart(i)),'utf8').match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/);
    assert(match,'Missing current stock fragment '+i);
    packed+=match[1];
  }
  const prefix='window.CURRENT_STOCK_20260911=';
  const plaintext=gunzipSync(Buffer.from(packed,'base64')).toString('utf8').trim();
  assert(plaintext.startsWith(prefix)&&plaintext.endsWith(';'));
  const stock=JSON.parse(plaintext.slice(prefix.length,-1));
  assert.equal(stock.meta.emissao,m.previous);
  assert.equal(stock.meta.registros,m.previousRecords);
  assert.equal(Math.round(stock.meta.valor*100),m.previousCents);
  assert.equal(stock.rows.length,m.previousRecords);
  const previous=new Map(stock.rows.map(r=>[key(r),r]));
  assert.equal(previous.size,m.previousRecords,'Repeated baseline position');
  for(const k of delta.removed)assert(previous.delete(k),'Missing removed position: '+k);
  for(const r of delta.changed){
    assert(previous.has(key(r)),'Missing modified position: '+key(r));
    assert.notDeepEqual(previous.get(key(r)),r,'Unmodified position in delta: '+key(r));
    previous.set(key(r),r);
  }
  for(const r of delta.added){assert(!previous.has(key(r)),'Existing new position: '+key(r));previous.set(key(r),r);}
  stock.rows=[...previous.values()];
  assert.equal(stock.rows.length,m.records);
  assert.equal(new Set(stock.rows.map(r=>String(r[3]))).size,m.products);
  assert.equal(new Set(stock.rows.map(r=>String(r[1]))).size,m.warehouses);
  assert.equal(stock.rows.reduce((s,r)=>s+Math.round(Number(r[9])*100),0),m.cents);
  stock.meta={...stock.meta,emissao:m.date,registros:m.records,posicoes:m.records,
    valor:m.cents/100,valor_estoque:m.cents/100,locais:m.warehouses,warehouses:m.warehouses,
    products:m.products,sourceFile:m.source,sourceSHA256:m.sourceSHA256,
    sha256:checksum(encoded),previousSnapshot:m.previous,
    previousRecords:m.previousRecords,previousValue:m.previousCents/100,
    newRows:m.added,updatedRows:m.changed,removedRows:m.removed,
    unchangedRows:m.unchanged,source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade'};
  const replacement=gzipSync(Buffer.from(prefix+JSON.stringify(stock)+';\n'),{level:9,mtime:0}).toString('base64');
  const chunk=Math.ceil(replacement.length/12);
  for(let i=1;i<=12;i++)write(out,stockPart(i),'window.CURRENT_STOCK_GZ'+(i===1?'':'+')+
    "='"+replacement.slice((i-1)*chunk,i*chunk)+"';\n");
  let reconcile=fs.readFileSync(file(out,'movement-reconcile-full-20261103.js'),'utf8');
  assert(reconcile.includes('saldo ERP de 26/11 sem desconto adicional.'));
  reconcile=reconcile.replace('saldo ERP de 26/11 sem desconto adicional.',
    'saldo ERP de 27/11 sem desconto adicional.');
  write(out,'movement-reconcile-full-20261103.js',reconcile);
  return {date:m.date,records:m.records,cents:m.cents,products:m.products,warehouses:m.warehouses,
    added:m.added,removed:m.removed,changed:m.changed,unchanged:m.unchanged,
    currentBalanceAuthoritative:true,withdrawalsNotSubtracted:true};
}
