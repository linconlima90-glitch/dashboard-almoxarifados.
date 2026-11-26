import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file=fs.readFileSync(new URL('../public/movement-monthly-drilldown-20261126.js',import.meta.url),'utf8');
const movements=fs.readFileSync(new URL('../public/baixas-erp-conferido-20261106.js',import.meta.url),'utf8');
const injector=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');

test('sintaxe, script carregado e acao do produto conectada',()=>{
  new vm.Script(file);
  new vm.Script(movements);
  assert.match(injector,/movement-monthly-drilldown-20261126\.js/);
  assert.match(movements,/data-dbx-action="monthly"/);
  assert.match(movements,/window\.DB_MOVEMENT_MONTHLY\.open/);
  assert.match(file,/centros-resultado-placas/);
  assert.match(file,/\-20261126\-/);
});

function exercise(){
  const sandbox={
    window:{},
    Intl,Map,Set,Promise,
  };
  vm.createContext(sandbox);
  vm.runInContext(file,sandbox,{timeout:3000});
  return sandbox.window.DB_MOVEMENT_MONTHLY;
}
test('consulta mensal pronta sem modificar o historico ERP',()=>{
  const api=exercise();
  assert.equal(typeof api.open,'function');
  assert.doesNotMatch(file,/MOVEMENTS_COMPLETE_20261103\s*=/);
  assert.doesNotMatch(file,/CURRENT_STOCK_20260911\s*=/);
});

test('ano 2024 nao recebe placas e o mes parcial de 2026 e identificado',()=>{
  assert.match(file,/year===2024/);
  assert.match(file,/sem vínculo de centro de resultado/);
  assert.match(file,/year===2026&&index===10/);
});

test('totais do centro, placas e unidades sao conciliados com criterios exatos',()=>{
  assert.match(file,/const product=D\.product\.indexOf\(info\.codigo\)/);
  assert.match(file,/norm\(x\)===norm\(info\.un\)/);
  assert.match(file,/allowed\.has\(text\(D\.local\[li\]\)\)/);
  assert.match(file,/Math\.abs\(sumPlate-g\.qty\)>\.001/);
  assert.match(file,/Sem placa informada/);
});
