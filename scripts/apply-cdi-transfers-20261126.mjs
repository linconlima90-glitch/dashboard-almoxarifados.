import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const START='2026-05-07';
const SOURCE_SHA='7ef100317ae3915d59784c5d7463ba19d35031bdc50366d0c8714a0a48aa52fb';
const PACK_SHA='1e702e1bf0e2fc65bc7bef059a0f4dc7e5bc34871ac31a6d5b80d41a707bffd8';
const key=r=>[r.erpUniqueNote,r.code,r.originCompany,r.originLocal,
  r.destinationCompany,r.destinationLocal,r.unit,r.control||''].map(String).join('|');
const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));

export function validateTransferUpdate(ledger,previous){
  assert.equal(ledger.schemaVersion,1);
  assert.equal(ledger.approvalDate,START);
  assert.equal(ledger.updatedAt,'2026-11-26');
  assert.equal(previous.transfers.length,184,'Revisar base anterior antes de importar');
  const rows=ledger.transfers,byId=new Map(rows.map(r=>[r.id,r]));
  assert.equal(rows.length,228);
  assert.equal(byId.size,rows.length,'ID de transferencia repetido');
  assert.equal(new Set(rows.map(key)).size,rows.length,'Chave documental repetida');
  const previousIds=new Set(previous.transfers.map(r=>r.id));
  for(const old of previous.transfers){
    const current=byId.get(old.id);
    assert(current,'Transferencia historica ausente: '+old.id);
    for(const field of Object.keys(old))same(current[field],old[field]);
    assert.equal(current.logicalKey,key(current));
  }
  let known=0,knownCents=0,missing=0;
  for(const row of rows){
    assert.equal(String(row.originCompany),'3');
    assert.equal(String(row.originLocal),'30115');
    assert(!['10551','20215','20220','30620','50215','50220','50315','50320'].includes(String(row.destinationLocal)),
      'Destino fora do escopo de distribuicao');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&row.date>=START&&row.date<='2026-11-25');
    assert(Number.isFinite(row.quantity)&&row.quantity>0);
    assert.equal(row.quantityOut,row.quantity);
    assert.equal(row.quantityIn,row.quantity);
    assert.equal(row.logicalKey,key(row));
    const evidence=row.provenance?.latestQuantitySource;
    assert.equal(evidence?.sha256,SOURCE_SHA);
    assert.equal(evidence.quantityOut,row.quantity);
    assert.equal(evidence.quantityIn,row.quantity);
    assert.equal(evidence.costProvided,false);
    if(row.sourceValueCents===null){
      missing++;
      assert(!previousIds.has(row.id));
      assert.equal(row.cdiUnitCost,null,'Custo historico ausente nao pode ser inferido');
      assert.equal(row.erpSequence,null,'A fonte nao informa sequencia ERP');
      assert.equal(row.estimatedSavingsCents,null);
      assert.equal(row.alternativePurchasePrice,null);
      assert.equal(row.transferCost,null);
    }else{
      assert(Number.isSafeInteger(row.sourceValueCents)&&row.sourceValueCents>=0);
      assert(previousIds.has(row.id),'Valor ERP novo sem evidencia na fonte');
      known++;knownCents+=row.sourceValueCents;
    }
  }
  same(ledger.losses,previous.losses);
  assert.equal(ledger.losses.transfers.length,54);
  assert.equal(ledger.losses.transfers.reduce((s,r)=>s+r.sourceValueCents,0),1667864);
  const a=ledger.audit;
  assert.equal(a.sourceRecords,338);
  assert.equal(a.importedRecords,rows.length);
  assert.equal(a.sourceValueCents,null);
  assert.equal(a.importedValueCents,knownCents);
  assert.equal(knownCents,6277990);
  assert.equal(a.pricedRecords,known);
  assert.equal(a.unpricedRecords,missing);
  assert.equal(known,184);assert.equal(missing,44);
  assert.equal(a.valueCoverage,'partial');
  assert.equal(a.latestTransferDate,'2026-11-25');
  assert.equal(new Set(rows.map(r=>r.erpUniqueNote)).size,a.distinctDocuments);
  assert.equal(new Set(rows.map(r=>r.code)).size,a.distinctProducts);
  assert.equal(new Set(rows.map(r=>r.destinationLocal)).size,a.destinationLocations);
  const excluded=ledger.latestSourceExclusions;
  assert.equal(excluded.sha256,SOURCE_SHA);
  assert.equal(excluded.items.length,110);
  assert.equal(excluded.records,110);
  for(const row of excluded.items){
    assert(row.date<START,'Exclusao anterior ao projeto invalida');
    assert(row.quantityOut>0&&row.quantityOut===row.quantityIn);
  }
  assert.equal(rows.length+excluded.items.length,338);
  assert.equal(new Set(rows.map(r=>r.logicalKey).concat(excluded.items.map(r=>r.logicalKey))).size,338);
  return {...a,sourceSha256:SOURCE_SHA,lossesPreserved:ledger.losses.transfers.length};
}

export function readCdiTransferUpdate(root){
  const raw=gunzipSync(Buffer.from(fs.readFileSync(path.join(root,'data/cdi-transfer-update-20261126.b64'),'utf8').trim(),'base64'));
  assert.equal(createHash('sha256').update(raw).digest('hex'),PACK_SHA,'Pacote de transferencias alterado');
  return JSON.parse(raw);
}

export function applyCdiTransfers20261126(root,out){
  const context=vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(root,'public/cdi-transfer-data.js'),'utf8'),context);
  const previous=JSON.parse(JSON.stringify(context.window.CDI_TRANSFER_LEDGER));
  const ledger=readCdiTransferUpdate(root),audit=validateTransferUpdate(ledger,previous);
  fs.writeFileSync(path.join(out,'cdi-transfer-data.js'),
    '// Transferencias Chua conciliadas em 26/11/2026; custo ERP parcial explicitado.\n'+
    'window.CDI_TRANSFER_LEDGER='+JSON.stringify(ledger)+';\n');
  return audit;
}
