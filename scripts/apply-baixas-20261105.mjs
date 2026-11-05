import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';

export function applyBaixas20261105(root,out) {
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const write=(p,value)=>fs.writeFileSync(path.join(out,p),value);
  const patch=JSON.parse(read('data/baixas-retificadas-20261105.json'));
  const sum=(a,i)=>a.reduce((s,x)=>s+Number(x[i]||0),0);
  assert.equal(patch.records,366);
  assert.equal(patch.cents,2030672);
  assert.equal(patch.rows.length,366);
  assert.equal(sum(patch.rows,6),2030672);
  assert.equal(patch.correction.document,2715257);
  assert.equal(patch.correction.cents,132);
  const ctx=vm.createContext({window:{}});
  for(const p of ['base','01','02','03','04']){
    const f=p==='base'?'public/movement-full-base-20261103.js':'public/movement-full-'+p+'-20261103.js';
    vm.runInContext(read(f),ctx,{timeout:10000});
  }
  const P=ctx.window.MOVEMENTS_COMPLETE_20261103,D=P.dict;
  const base=JSON.parse(JSON.stringify(P.meta));
  assert.equal(base.records,19387);
  const detail=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'public/baixas-detalhe-2026.json.gz'))));
  assert.equal(sum(detail.rows,7),base.years['2026'].records);
  assert.equal(sum(detail.rows,6),Math.round(base.years['2026'].value*100));
  function ix(collection,value,signature) {
    const target=D[collection],s=signature(value);
    let i=target.findIndex(x=>signature(x)===s);
    if(i<0){i=target.length;target.push(value)}
    return i;
  }
  const rows=patch.rows.map(row=>{
    const [di,fi,li,pi,ui,qty,cents,different]=row;
    const loc=patch.dict.local[li],product=patch.dict.product[pi],unit=patch.dict.unit[ui];
    const il=ix('local',loc,x=>JSON.stringify(x));
    const ic=ix('company',patch.dict.company[fi],String);
    const ig=ix('group',product[2],String);
    const ip=ix('product',[product[0],product[1],ig],x=>JSON.stringify(x));
    const iu=ix('unit',unit,String);
    return [patch.dict.date[di],il,ic,ip,iu,Number(qty),Number(cents),1,Number(different)];
  });
  assert.equal(sum(rows,7),366);
  const start='2026-10-29',end='2026-11-05';
  const removed=detail.rows.filter(x=>x[0]>=start&&x[0]<=end);
  assert(sum(removed,7)>0,'Sem baixas antigas para substituir');
  const unmodified=detail.rows.filter(x=>x[0]<start||x[0]>end);
  const aggregate=(entries,indexedMonth)=>{
    const byKey=new Map();
    for(const x of entries){
      const k=x.slice(0,5).join('|');let a=byKey.get(k);
      if(!a){a=x.slice();byKey.set(k,a)}
      else for(const i of [5,6,7,8])a[i]+=x[i];
    }
    return [...byKey.values()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))||a[1]-b[1]||a[3]-b[3]);
  };
  const daily=aggregate([...unmodified,...rows]);
  const monthlyInput=daily.filter(x=>x[0].startsWith('2026-10')||x[0].startsWith('2026-11')).map(x=>{
    const mi=D.month.indexOf(x[0].slice(0,7));
    assert(mi>=0,'Mes ausente: '+x[0]);
    return [mi,...x.slice(1)];
  });
  const monthly=aggregate(monthlyInput);
  P.rows=[...P.rows.filter(x=>!['2026-10','2026-11'].includes(D.month[x[0]])),...monthly]
    .sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3]-b[3]);
  const byMonth={},byYear={};
  for(const row of P.rows){
    const month=D.month[row[0]],year=month.slice(0,4);
    const m=byMonth[month]||(byMonth[month]={records:0,cents:0});
    const y=byYear[year]||(byYear[year]={records:0,cents:0});
    m.records+=row[7];m.cents+=row[6];y.records+=row[7];y.cents+=row[6];
  }
  const totalCount=Object.values(byYear).reduce((s,x)=>s+x.records,0);
  const totalCents=Object.values(byYear).reduce((s,x)=>s+x.cents,0);
  for(const year of ['2024','2025']){
    assert.equal(byYear[year].records,base.years[year].records);
    assert.equal(byYear[year].cents,Math.round(base.years[year].value*100));
  }
  assert.equal(byYear['2026'].records,sum(daily,7));
  assert.equal(byYear['2026'].cents,sum(daily,6));
  const money=cents=>Math.round(cents)/100;
  const formatted=cents=>money(cents).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  P.meta={...base,sourceFile:'Historico 03/11/2026 + retificacao 05/11/2026',
    baseSourceSHA256:base.sha256,sha256:patch.sourceSHA256,
    issuedAt:patch.issuedAt,to:'05/11/2026',records:totalCount,value:money(totalCents),
    years:Object.fromEntries(Object.entries(byYear).map(([k,v])=>[k,{records:v.records,value:money(v.cents)}])),
    months:Object.fromEntries(Object.entries(byMonth).map(([k,v])=>[k,{records:v.records,value:money(v.cents)}])),
    status:{IGUAL:366,DIFERENTE:0,NAO_INFORMADO:totalCount-366},
    retification:{sourceFile:patch.sourceFile,sourceSHA256:patch.sourceSHA256,
      periodStart:'29/10/2026',periodEnd:'05/11/2026',
      removedRecords:sum(removed,7),addedRecords:366,
      duplicateExcluded:{document:2715257,product:147008,date:'04/11/2026',count:1,cents:132}}};
  detail.rows=daily;
  if(detail.meta)detail.meta={...detail.meta,records:byYear['2026'].records,
    value:money(byYear['2026'].cents),sourceFile:P.meta.sourceFile};
  write('baixas-detalhe-2026.json.gz',gzipSync(Buffer.from(JSON.stringify(detail)),{level:9,mtime:0}));
  const countPerPart=Math.ceil(P.rows.length/4);
  write('movement-full-base-20261103.js','window.MOVEMENTS_COMPLETE_20261103='+JSON.stringify({...P,rows:[]})+';\n');
  for(let i=0;i<4;i++)write('movement-full-'+String(i+1).padStart(2,'0')+'-20261103.js',
    'window.MOVEMENTS_COMPLETE_20261103.rows.push(...'+
    JSON.stringify(P.rows.slice(i*countPerPart,(i+1)*countPerPart))+');\n');
  let reconcile=read('public/movement-reconcile-full-20261103.js');
  const replace=(label,regex,value)=>{assert(regex.test(reconcile),'Marcador ausente: '+label);reconcile=reconcile.replace(regex,value)};
  replace('totais de origem',/if\(meta\.records!==19387\|\|[\s\S]*?throw Error\('Baixas ERP 2024-2026: fonte nao confere'\);/,
    "if(meta.records!=="+totalCount+"||Math.round(meta.value*100)!=="+totalCents+"||"+
    "meta.sha256!=='"+P.meta.sha256+"'||P.rows.length!=="+P.rows.length+
    "||D.month.length!==33||D.product.length!=="+D.product.length+
    ")throw Error('Baixas ERP 2024-2026: fonte nao confere');");
  replace('anuais',/const expectedByYear=\{[^;]+;/,
    'const expectedByYear='+JSON.stringify(Object.fromEntries(Object.entries(byYear).map(([k,v])=>[k,[v.records,v.cents]])))+';');
  replace('mensais',/if\(monthActual\.get\('2026-10'\)[\s\S]*?throw Error\('Baixas mensais do ERP inconsistentes'\);/,
    "if(monthActual.get('2026-10')?.records!=="+byMonth['2026-10'].records+
    "||monthActual.get('2026-10')?.cents!=="+byMonth['2026-10'].cents+
    "||monthActual.get('2026-11')?.records!=="+byMonth['2026-11'].records+
    "||monthActual.get('2026-11')?.cents!=="+byMonth['2026-11'].cents+
    "||monthActual.get('2025-01')?.records!==336)throw Error('Baixas mensais do ERP inconsistentes');");
  replace('outubro',/window\.MOVEMENTS_OCTOBER_META=\{[^;]+;/,
    "window.MOVEMENTS_OCTOBER_META={from:'01/10/2026',to:'31/10/2026',records:"+byMonth['2026-10'].records+
    ",value:"+money(byMonth['2026-10'].cents)+"};");
  replace('novembro',/window\.MOVEMENTS_NOVEMBER_META=\{[^;]+;/,
    "window.MOVEMENTS_NOVEMBER_META={from:'01/11/2026',to:'05/11/2026',records:"+byMonth['2026-11'].records+
    ",value:"+money(byMonth['2026-11'].cents)+",partial:true};");
  replace('quantidade minima',/minMonths:2,records:17026/,
    'minMonths:2,records:'+(byYear['2025'].records+byYear['2026'].records-byMonth['2026-11'].records));
  replace('resumo',/box\.innerHTML=[\s\S]*?;\s*summary\.prepend\(box\);/,
    "box.innerHTML='<b>Baixas ERP detalhadas: 14/03/2024 a 05/11/2026</b> · "+
    totalCount.toLocaleString('pt-BR')+" lancamentos · <b>R$ "+formatted(totalCents)+
    "</b>.'+'<div style=\"color:#657366;font-size:11px\">"+
    "2024: "+byYear['2024'].records+" baixas (somente consulta). 2025: "+byYear['2025'].records+
    " baixas. 2026: "+byYear['2026'].records+
    " baixas ate 05/11. Dados de 29/10 a 05/11 substituidos, sem duplicacao. "+
    "Estoque minimo: 22 meses completos (2025 e janeiro-outubro/2026), cobertura de 2 meses; "+
    "novembro parcial fora da media. Estoque fisico 03/11/2026 15:58:21, sem subtracao adicional.</div>';summary.prepend(box);");
  write('movement-reconcile-full-20261103.js',reconcile);
  let history=read('public/movement-history-ui-20261103.js')
    .replace('19.387 lançamentos',totalCount.toLocaleString('pt-BR')+' lançamentos')
    .replace('10.869</b>',byYear['2026'].records.toLocaleString('pt-BR')+'</b>')
    .replace('R$ 1.077.223,73','R$ '+formatted(byYear['2026'].cents))
    .replaceAll('?v=20261103-1525','?v=20261105-retificado');
  assert(history.includes('20261105-retificado'));
  write('movement-history-ui-20261103.js',history);
  const noBaixas=read('public/stock-no-withdrawals-tab-20261015.js')
    .replace('window.MOVEMENTS_REVISED_META?.records === 19387','window.MOVEMENTS_REVISED_META?.records === '+totalCount)
    .replaceAll('14/03/2024 a 03/11/2026','14/03/2024 a 05/11/2026')
    .replace("historyEnd:'03/11/2026'","historyEnd:'05/11/2026'");
  assert(noBaixas!==read('public/stock-no-withdrawals-tab-20261015.js'));
  write('stock-no-withdrawals-tab-20261015.js',noBaixas);
  const audit={sourceSHA256:patch.sourceSHA256,baselineSHA256:base.sha256,
    receivedRecords:366,removedOldRecords:sum(removed,7),
    revisedRecords:totalCount,totalValue:money(totalCents),
    annual:P.meta.years,october:P.meta.months['2026-10'],november:P.meta.months['2026-11'],
    monthlyPositions:P.rows.length,physicalStockUnchanged:true};
  fs.writeFileSync(path.join(root,'build-baixas-audit.json'),JSON.stringify(audit,null,2)+'\n');
  return audit;
}