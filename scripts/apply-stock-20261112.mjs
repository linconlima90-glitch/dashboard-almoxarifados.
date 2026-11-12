import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {applyStock20261110} from './apply-stock-20261110.mjs';

// Fotografia ERP de 12/11 substitui integralmente a posicao fisica de 10/11.
// Preserva consumo historico e nao desconta baixas novamente do saldo ERP.
export function applyStock20261112(root,out){
  const previous=applyStock20261110(root,out);
  assert.equal(previous.current.records,4381);
  assert.equal(previous.current.cents,229169005);
  const delta=JSON.parse(gunzipSync(Buffer.from(
    fs.readFileSync(path.join(root,'data/stock-mini-20261112.b64'),'utf8').trim(),'base64')).toString('utf8'));
  const meta=delta.meta;
  assert.equal(meta.sourceFile,'Estoques_analitico(6).xlsx');
  assert.equal(meta.emissao,'12/11/2026 09:35:54');
  assert.equal(meta.registros,4374);
  assert.equal(meta.valor,2281619.67);
  assert.equal(meta.sha256,'01f5ea24f1a108020a7c4e8e54d6ae0e1705df267a9fe24e206fc324036db989');
  assert.equal(meta.previousRecords,4381);
  assert.equal(meta.previousCents,229169005);
  assert.equal(meta.removed,17);
  assert.equal(meta.changed,125);
  assert.equal(meta.added,10);
  assert.equal(meta.unchanged,4239);
  assert.equal(delta.removed.length,meta.removed);
  assert.equal(delta.changed.length,meta.numericChanged);
  assert.equal(delta.renamed.length,meta.renamed);
  assert.equal(meta.numericChanged+meta.renamed,meta.changed);
  assert.equal(delta.added.length,meta.added);
  let b64='';
  for(let i=1;i<=12;i++){
    const name='stock-current-20261103-1558-'+String(i).padStart(2,'0')+'.js';
    const chunk=fs.readFileSync(path.join(out,name),'utf8');
    const match=chunk.match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/);
    assert(match,'Trecho de estoque anterior ausente: '+name);
    b64+=match[1];
  }
  const prefix='window.CURRENT_STOCK_20260911=';
  const previousText=gunzipSync(Buffer.from(b64,'base64')).toString('utf8').trim();
  assert(previousText.startsWith(prefix),'Formato do estoque anterior alterado');
  const stock=JSON.parse(previousText.slice(prefix.length).replace(/;$/,''));
  const id=r=>[String(r[0]),String(r[1]),String(r[3]),String(r[6])].join('|');
  const positions=new Map();
  for(const r of stock.rows){
    assert.equal(r.length,10);
    assert(!positions.has(id(r)),'Duplicidade de empresa/local/produto/unidade na base anterior');
    positions.set(id(r),r);
  }
  assert.equal(positions.size,4381);
  const {companies,locals,units}=delta.dict;
  const key=q=>{
    assert.equal(q.length,4);
    const co=companies[q[0]],lo=locals[q[1]],un=units[q[3]];
    assert(co&&lo&&un,'Indice invalido do dicionario de estoque');
    return [co,lo,String(q[2]),un].join('|');
  };
  for(const q of delta.removed)assert(positions.delete(key(q)),'Remocao sem saldo anterior: '+key(q));
  for(const q of delta.changed){
    assert.equal(q.length,7,'Mudanca de atributos precisa de revisao');
    const r=positions.get(key(q.slice(0,4)));
    assert(r,'Alteracao sem saldo anterior: '+key(q.slice(0,4)));
    assert(Number(q[4])>0 && Number(q[6])>=0);
    r.splice(7,3,q[4],q[5],q[6]);
  }
  for(const q of delta.renamed){
    assert.equal(q.length,5,'Mudanca de descricao precisa de revisao');
    const r=positions.get(key(q.slice(0,4)));
    assert(r,'Descricao sem saldo anterior: '+key(q.slice(0,4)));
    assert(typeof q[4]==='string' && q[4].trim());
    r[4]=q[4];
  }
  for(const r of delta.added){
    assert.equal(r.length,10);
    assert(Number(r[7])>0 && Number(r[9])>=0);
    assert(!positions.has(id(r)),'Posicao adicional duplicada: '+id(r));
    positions.set(id(r),r);
  }
  assert.equal(positions.size,meta.registros);
  const rows=[...positions.values()];
  assert(rows.every(r=>Number(r[7])>0));
  const cents=rows.reduce((sum,r)=>sum+Math.round(Number(r[9])*100),0);
  assert.equal(cents,228161967,'Valor total do estoque nao confere com o ERP');
  assert.equal(new Set(rows.map(r=>String(r[2]))).size,9);
  stock.rows=rows;
  stock.meta={...stock.meta,
    emissao:meta.emissao,registros:meta.registros,posicoes:meta.registros,valor:meta.valor,
    sha256:meta.sha256,sourceFile:meta.sourceFile,previousSnapshot:'10/11/2026 12:54:13',
    newRows:meta.added,updatedRows:meta.changed,renamedRows:meta.renamed,removedRows:meta.removed,warehouses:9,
    source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade'};
  const packed=gzipSync(Buffer.from(prefix+JSON.stringify(stock)+';\n','utf8'),{level:9,mtime:0}).toString('base64');
  const partSize=Math.ceil(packed.length/12);
  for(let i=0;i<12;i++){
    const segment=packed.slice(i*partSize,(i+1)*partSize);
    assert(segment.length);
    fs.writeFileSync(path.join(out,'stock-current-20261103-1558-'+String(i+1).padStart(2,'0')+'.js'),
      'window.CURRENT_STOCK_GZ'+(i===0?'':'+')+"='"+segment+"';\n",'utf8');
  }
  const audit={
    source:meta.sourceFile,sha256:meta.sha256,previous:previous.current,
    current:{date:meta.emissao,records:meta.registros,cents,warehouses:9},
    replaced:true,removed:meta.removed,added:meta.added,revised:meta.changed,unchanged:meta.unchanged,
    deltaCents:cents-previous.current.cents,physicalBalanceNotReducedByWithdrawals:true
  };
  fs.writeFileSync(path.join(root,'build-stock-audit.json'),JSON.stringify(audit,null,2)+'\n');
  return audit;
}
