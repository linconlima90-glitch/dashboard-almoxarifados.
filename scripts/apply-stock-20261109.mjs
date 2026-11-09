import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {applyStock20261105} from './apply-stock-20261105.mjs';

// A posicao de 09/11 substitui integralmente a fotografia fisica de 05/11.
// Nao descontar baixas do saldo ERP e nao alterar os historicos de consumo.
export function applyStock20261109(root,out){
  const previous=applyStock20261105(root,out);
  assert.equal(previous.current.records,4405);
  assert.equal(previous.current.cents,230086650);
  const mini=JSON.parse(gunzipSync(Buffer.from(
    fs.readFileSync(path.join(root,'data/stock-mini-20261109.b64'),'utf8').trim(),'base64')).toString('utf8'));
  assert.equal(mini.meta.emissao,'09/11/2026 10:29:10');
  assert.equal(mini.meta.registros,4380);
  assert.equal(mini.meta.valor,2292215.23);
  assert.equal(mini.meta.sha256,'dfb9866297ac9653bde790f0255670c129fb1442878c4f031bb683eae2340f75');
  assert.equal(mini.removed.length,33);
  assert.equal(mini.changed.length,193);
  assert.equal(mini.added.length,8);
  let b64='';
  for(let i=1;i<=12;i++){
    const name='stock-current-20261103-1558-'+String(i).padStart(2,'0')+'.js';
    const chunk=fs.readFileSync(path.join(out,name),'utf8');
    const match=chunk.match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/);
    assert(match,'Parte anterior ausente: '+name);
    b64+=match[1];
  }
  const prefix='window.CURRENT_STOCK_20260911=';
  const old=gunzipSync(Buffer.from(b64,'base64')).toString('utf8').trim();
  assert(old.startsWith(prefix),'Formato anterior nao identificado');
  const stock=JSON.parse(old.slice(prefix.length).replace(/;$/,''));
  const id=x=>[String(x[0]),String(x[1]),String(x[3]),String(x[6])].join('|');
  const idx=new Map();
  for(const r of stock.rows){assert(!idx.has(id(r)),'Duplicata na base anterior');idx.set(id(r),r)}
  assert.equal(idx.size,4405);
  const {companies,locals,units}=mini.dict;
  const key=q=>[companies[q[0]],locals[q[1]],String(q[2]),units[q[3]]].join('|');
  for(const k of mini.removed)assert(idx.delete(key(k)),'Remocao inexistente: '+key(k));
  for(const q of mini.changed){
    const k=key(q),r=idx.get(k);
    assert(r,'Alteracao sem saldo anterior: '+k);
    assert.equal(q.length,7,'Alteracao de atributos exige revisao');
    r.splice(7,3,...q.slice(4,7));
  }
  for(const r of mini.added){
    assert.equal(r.length,10);
    assert(!idx.has(id(r)),'Posicao nova duplicada: '+id(r));
    idx.set(id(r),r);
  }
  const cents=rows=>rows.reduce((s,r)=>s+Math.round(Number(r[9]||0)*100),0);
  assert.equal(idx.size,4380);
  const rows=[...idx.values()];
  assert.equal(cents(rows),229221523,'Valor total da fotografia nao confere');
  assert.equal(new Set(rows.map(x=>String(x[2]))).size,9);
  stock.rows=rows;
  stock.meta={...stock.meta,emissao:mini.meta.emissao,
    registros:4380,posicoes:4380,valor:mini.meta.valor,
    sha256:mini.meta.sha256,sourceFile:'Estoques_analitico(4).xlsx',
    previousSnapshot:'05/11/2026 19:19:46',
    newRows:8,updatedRows:193,removedRows:33,warehouses:9,
    source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade'};
  const compressed=gzipSync(Buffer.from(prefix+JSON.stringify(stock)+';\n','utf8'),
    {level:9,mtime:0}).toString('base64');
  const size=Math.ceil(compressed.length/12);
  for(let i=0;i<12;i++){
    const segment=compressed.slice(i*size,(i+1)*size);
    assert(segment.length);
    const file='stock-current-20261103-1558-'+String(i+1).padStart(2,'0')+'.js';
    fs.writeFileSync(path.join(out,file),
      'window.CURRENT_STOCK_GZ'+(i===0?'':'+')+"='"+segment+"';\n",'utf8');
  }
  const audit={source:'Estoques_analitico(4).xlsx',sha256:mini.meta.sha256,
    previous:previous.current,
    current:{date:mini.meta.emissao,records:4380,cents:229221523,warehouses:9},
    replaced:true,removed:33,added:8,revised:193,unchanged:4179,
    deltaCents:-865127,physicalBalanceNotReducedByWithdrawals:true};
  fs.writeFileSync(path.join(root,'build-stock-audit.json'),JSON.stringify(audit,null,2)+'\n');
  return audit;
}
