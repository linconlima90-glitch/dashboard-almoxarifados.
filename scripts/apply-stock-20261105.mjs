import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';

// Fotografia do estoque e independente das baixas. Nunca descontar saidas do saldo ERP.
export function applyStock20261105(root,out){
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const patch=JSON.parse(read('data/stock-delta-20261105.json'));
  assert.equal(patch.meta.emissao,'05/11/2026 19:19:46');
  assert.equal(patch.meta.registros,4405);
  assert.equal(patch.meta.valor,2300866.5);
  assert.equal(patch.meta.sha256,'5d6695c2eb527ced6993e33ce2049ff1a1b188b1e6f6878677b480ee6640a4d1');
  assert.equal(patch.removed.length,9);
  assert.equal(patch.updated.length,231);
  let b64='';
  for(let i=1;i<=12;i++){
    const name='public/stock-current-20261103-1558-'+String(i).padStart(2,'0')+'.js';
    const part=read(name).match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/);
    assert(part,'Parte antiga de estoque ausente '+name);
    b64+=part[1];
  }
  const marker='window.CURRENT_STOCK_20260911=';
  const unpacked=gunzipSync(Buffer.from(b64,'base64')).toString('utf8').trim();
  assert(unpacked.startsWith(marker),'Formato de saldo ERP nao reconhecido');
  const original=JSON.parse(unpacked.slice(marker.length).replace(/;$/,''));
  const valCents=rows=>rows.reduce((s,x)=>s+Math.round(Number(x[9]||0)*100),0);
  const id=x=>[String(x[0]),String(x[1]),String(x[3]),String(x[6])].join('|');
  assert.equal(original.rows.length,4304);
  assert.equal(valCents(original.rows),224908715);
  assert.equal(original.meta.emissao,'03/11/2026 15:58:21');
  const indexed=new Map();
  for(const row of original.rows){
    assert.equal(row.length,10);
    const k=id(row);
    assert(!indexed.has(k),'Chave fiscal anterior duplicada '+k);
    indexed.set(k,row);
  }
  for(const key of patch.removed){
    const k=id([key[0],key[1],null,key[2],null,null,key[3]]);
    assert(indexed.delete(k),'Remocao inexistente '+k);
  }
  let revised=0,added=0;
  const updatedKeys=new Set();
  for(const row of patch.updated){
    assert.equal(row.length,10);
    const k=id(row);
    assert(!updatedKeys.has(k),'Delta de estoque duplicado '+k);
    updatedKeys.add(k);
    assert(Number(row[7])>0);
    assert(Number(row[9])>=0);
    if(indexed.has(k)){
      assert.notDeepEqual(indexed.get(k),row,'Delta sem alteracao '+k);
      revised++;
    }else added++;
    indexed.set(k,row);
  }
  assert.equal(added,110);
  assert.equal(revised,121);
  const next=[...indexed.values()];
  assert.equal(next.length,4405);
  assert.equal(valCents(next),230086650);
  assert.equal(new Set(next.map(x=>String(x[2]))).size,9);
  assert.equal(next.filter(x=>String(x[1])==='50115'&&String(x[3])==='106763').length,2,
    'Nao unificar as duas posicoes fiscais do pneu 106763');
  original.rows=next;
  original.meta={...original.meta,...patch.meta,
    source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade',
    newRows:added,updatedRows:revised,removedRows:patch.removed.length,
    warehouses:9};
  const text='window.CURRENT_STOCK_20260911='+JSON.stringify(original)+';\n';
  const compressed=gzipSync(Buffer.from(text,'utf8'),{level:9,mtime:0}).toString('base64');
  const each=Math.ceil(compressed.length/12);
  for(let i=0;i<12;i++){
    const name='stock-current-20261103-1558-'+String(i+1).padStart(2,'0')+'.js';
    const segment=compressed.slice(i*each,(i+1)*each);
    assert(segment.length,'Pacote de saldo vazio');
    const code='window.CURRENT_STOCK_GZ'+(i===0?'':' +')+"='"+segment+"';\n";
    // Remove whitespace from assignment before testing/compiling legacy source.
    fs.writeFileSync(path.join(out,name),code.replace('GZ +=','GZ+='),'utf8');
  }
  const audit={source:patch.meta.sourceFile,sha256:patch.meta.sha256,
    previous:{date:patch.meta.previousSnapshot,records:4304,cents:224908715},
    current:{date:patch.meta.emissao,records:4405,cents:230086650,warehouses:9},
    replaced:true,removed:9,added,revised,unchanged:4174,
    deltaCents:230086650-224908715,physicalBalanceNotReducedByWithdrawals:true};
  fs.writeFileSync(path.join(root,'build-stock-audit.json'),JSON.stringify(audit,null,2)+'\n');
  return audit;
}
