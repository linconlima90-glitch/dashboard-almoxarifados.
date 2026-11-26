import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {readCdiTransferUpdate,validateTransferUpdate,applyCdiTransfers20261126} from '../scripts/apply-cdi-transfers-20261126.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function previous(){
  const context=vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(root,'public/cdi-transfer-data.js'),'utf8'),context);
  return JSON.parse(JSON.stringify(context.window.CDI_TRANSFER_LEDGER));
}

test('all 338 source transfers reconcile with historical ERP values and separate pre-project records',()=>{
  const next=readCdiTransferUpdate(root),old=previous(),summary=validateTransferUpdate(next,old);
  assert.equal(summary.importedRecords,228);
  assert.equal(summary.importedValueCents,6277990);
  assert.equal(summary.pricedRecords,184);assert.equal(summary.unpricedRecords,44);
  assert.equal(next.latestSourceExclusions.items.length,110);
  assert.deepEqual(next.losses,old.losses);
  const additions=next.transfers.filter(r=>r.sourceValueCents===null);
  assert.equal(new Set(additions.map(r=>r.erpUniqueNote)).size,8);
  assert.equal(new Set(additions.map(r=>r.code)).size,38);
  assert.deepEqual([...new Set(additions.map(r=>r.date))].sort().slice(-1),['2026-11-25']);
  for(const row of additions){
    assert.equal(row.cdiUnitCost,null);assert.equal(row.erpSequence,null);
    assert.equal(row.estimatedSavingsCents,null);
    assert.equal(row.provenance.groupSource.costsUsed,false);
  }
});

test('duplicates, changed historical amounts and invented costs stop the transfer import',()=>{
  const old=previous();
  const duplicate=readCdiTransferUpdate(root);duplicate.transfers[1]=duplicate.transfers[0];
  assert.throws(()=>validateTransferUpdate(duplicate,old),/repetido/);
  const changed=readCdiTransferUpdate(root);
  changed.transfers.find(r=>r.sourceValueCents!==null).sourceValueCents++;
  assert.throws(()=>validateTransferUpdate(changed,old));
  const invented=readCdiTransferUpdate(root);
  invented.transfers.find(r=>r.sourceValueCents===null).sourceValueCents=0;
  assert.throws(()=>validateTransferUpdate(invented,old),/Valor ERP novo sem evidencia/);
  const quantity=readCdiTransferUpdate(root);
  quantity.transfers[0].quantityIn++;
  assert.throws(()=>validateTransferUpdate(quantity,old));
});

test('building the same transfer source twice is idempotent',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cdi-transfer-test-'));
  try{
    const first=applyCdiTransfers20261126(root,dir);
    const bytes=fs.readFileSync(path.join(dir,'cdi-transfer-data.js'),'utf8');
    const second=applyCdiTransfers20261126(root,dir);
    assert.deepEqual(first,second);
    assert.equal(fs.readFileSync(path.join(dir,'cdi-transfer-data.js'),'utf8'),bytes);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
