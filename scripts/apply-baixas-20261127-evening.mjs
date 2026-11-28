import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';

export function applyBaixas20261127Evening(root,out){
  const source='data/baixas-20261127-evening.b64';
  const encoded=fs.readFileSync(path.join(root,source),'utf8').trim();
  const sha=createHash('sha256').update(encoded).digest('hex');
  assert.equal(sha,'5f929d3cfd8d2fce1a9a851add295709898de3b1265249dc3cb917667f2d4771');
  const pack=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
  const m=pack.meta,rows=pack.rows;
  assert.equal(pack.schema,1);
  assert.equal(m.sourceSHA256,'2fdd8b679a00b1bac53d93f9efefb345772f7ddc004b3ad4bc2d4e5d638183e7');
  assert.equal(m.dateBasis,'Dt.Neg.');assert.equal(m.costField,'Custo_Total');
  assert.equal(m.from,'2026-11-27');assert.equal(m.to,'2026-11-27');
  assert.equal(m.records,91);assert.equal(m.cents,1111701);assert.equal(m.valueCents,1111704);
  assert.equal(rows.length,91);
  assert.equal(rows.reduce((sum,r)=>sum+r[9],0),m.cents);
  assert.equal(rows.reduce((sum,r)=>sum+r[13],0),m.valueCents);
  assert.equal(rows.filter(r=>r[16]).length,47);
  assert.deepEqual(m.movementDates,{'2026-11-27':91});
  const key=r=>[r[10],r[11],r[1],r[2]].map(String).join('|');
  assert.equal(new Set(rows.map(key)).size,91,'Duplicate ERP sequence in incoming sheet');
  assert(rows.every(r=>r.length===19&&r[0]==='2026-11-27'&&r[8]>0&&
    Number.isInteger(r[9])&&r[9]>=0&&r[12]==='IGUAL'));
  const dest=p=>path.join(out,p),read=p=>fs.readFileSync(dest(p),'utf8');
  const write=(p,t)=>fs.writeFileSync(dest(p),t,'utf8');
  const names=['movement-full-base-20261103.js','movement-full-01-20261103.js',
    'movement-full-02-20261103.js','movement-full-03-20261103.js','movement-full-04-20261103.js'];
  const c=vm.createContext({window:{}});
  for(const p of names)vm.runInContext(read(p),c,{timeout:4000});
  const P=c.window.MOVEMENTS_COMPLETE_20261103,D=P.dict;
  assert.equal(P.meta.to,'2026-11-26');assert.equal(P.meta.records,23010);
  assert.equal(Math.round(P.meta.value*100),261554111);
  assert.equal(P.rows.reduce((s,r)=>s+r[7],0),23010);
  assert.equal(P.rows.reduce((s,r)=>s+r[6],0),261554111);
  const historical=new Set(P.meta.importedDocumentKeys||[]);
  assert(rows.every(r=>!historical.has(key(r))),'Sequence was imported previously');
  const completed=JSON.stringify(P.rows.filter(r=>D.month[r[0]]>='2025-01'&&D.month[r[0]]<='2026-10'));
  const idx=(array,value)=>{let i=array.findIndex(x=>String(x)===String(value));if(i<0){i=array.length;array.push(value)}return i;};
  const productIndex=new Map(D.product.map((r,i)=>[String(r[0]),i]));
  const monthly=new Map(P.rows.map(r=>[r.slice(0,5).join('|'),r]));
  const daily=new Map();
  for(const r of rows){
    const [date,company,localCode,localName,code,product,group,unit,qty,cents]=r;
    const li=D.local.findIndex(x=>String(x[0])===String(localCode));
    assert(li>=0&&String(D.local[li][1])===String(localName),'Unknown warehouse '+localCode);
    const fi=idx(D.company,r[14]),gr=idx(D.group,group),ui=idx(D.unit,unit),mi=idx(D.month,date.slice(0,7));
    let pi=productIndex.get(String(code));
    if(pi===undefined){pi=D.product.length;D.product.push([String(code),String(product),gr]);productIndex.set(String(code),pi);}
    const mk=[mi,li,fi,pi,ui].join('|'),mm=monthly.get(mk)||[mi,li,fi,pi,ui,0,0,0,0];
    mm[5]+=qty;mm[6]+=cents;mm[7]++;monthly.set(mk,mm);
    const dk=[date,li,fi,pi,ui].join('|'),dd=daily.get(dk)||[date,li,fi,pi,ui,0,0,0,0];
    dd[5]+=qty;dd[6]+=cents;dd[7]++;daily.set(dk,dd);
  }
  const all=[...monthly.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3]-b[3]);
  const count=all.reduce((s,r)=>s+r[7],0),cents=all.reduce((s,r)=>s+r[6],0);
  assert.equal(count,23101);assert.equal(cents,262665812);
  assert.equal(JSON.stringify(all.filter(r=>D.month[r[0]]>='2025-01'&&D.month[r[0]]<='2026-10')),completed,
    'Do not alter closed months for minimum-stock calculations');
  const years={},months={};
  for(const r of all){
    const ym=D.month[r[0]],y=ym.slice(0,4);
    years[y]??={records:0,cents:0};months[ym]??={records:0,cents:0};
    for(const target of [years[y],months[ym]]){target.records+=r[7];target.cents+=r[6];}
  }
  assert.equal(years['2026'].records,13526);assert.equal(years['2026'].cents,140588869);
  P.rows=all;
  P.meta={...P.meta,to:m.to,records:count,cents,value:cents/100,dateBasis:'Dt.Neg.',costField:'Custo_Total',
    sha256:P.meta.sha256+'+'+sha,sourceSHA256:P.meta.sourceSHA256+'+'+m.sourceSHA256,
    sourceFile:P.meta.sourceFile+' + '+m.source,
    status:{IGUAL:(P.meta.status?.IGUAL||0)+91,DIFERENTE:P.meta.status?.DIFERENTE||0},
    importedDocumentKeys:[...(P.meta.importedDocumentKeys||[]),...rows.map(key)],
    years:Object.fromEntries(Object.entries(years).map(([k,v])=>[k,{records:v.records,value:v.cents/100}])),
    months:Object.fromEntries(Object.entries(months).map(([k,v])=>[k,{records:v.records,value:v.cents/100}]))};
  write(names[0],'window.MOVEMENTS_COMPLETE_20261103='+JSON.stringify({...P,rows:[]})+';\n');
  const piece=Math.ceil(all.length/4);
  for(let i=0;i<4;i++)write(names[i+1],
    'window.MOVEMENTS_COMPLETE_20261103.rows.push(...'+JSON.stringify(all.slice(i*piece,(i+1)*piece))+');\n');

  const detailFile=dest('baixas-detalhe-2026.json.gz');
  const detail=JSON.parse(gunzipSync(fs.readFileSync(detailFile)).toString('utf8'));
  assert.equal(detail.meta.to,'2026-11-26');assert(detail.rows.every(r=>r[0]<m.from));
  detail.rows.push(...daily.values());
  detail.meta={...detail.meta,to:m.to,records:years['2026'].records,value:years['2026'].cents/100,
    dateBasis:'Dt.Neg.',costField:'Custo_Total',sourceFile:detail.meta.sourceFile+' + '+m.source};
  assert.equal(detail.rows.reduce((s,r)=>s+r[7],0),detail.meta.records);
  assert.equal(detail.rows.reduce((s,r)=>s+r[6],0),years['2026'].cents);
  fs.writeFileSync(detailFile,gzipSync(Buffer.from(JSON.stringify(detail)),{level:9,mtime:0}));

  let history=read('movement-history-ui-20261103.js');
  const cache=/\/baixas-detalhe-'\+year\+'\.json\.gz\?v=[^']+/;
  assert(cache.test(history));
  history=history.replace(cache,"/baixas-detalhe-'+year+'.json.gz?v=20261127evening");
  write('movement-history-ui-20261103.js',history);
  let reconcile=read('movement-reconcile-full-20261103.js');
  const replace=(pattern,next)=>{assert(pattern.test(reconcile));reconcile=reconcile.replace(pattern,next);};
  replace(/if\(meta\.records!==\d+\|\|[\s\S]*?throw Error\('Baixas ERP 2024-2026: fonte nao confere'\);/,
    'if(meta.records!=='+count+'||Math.round(meta.value*100)!=='+cents+
    '||meta.sha256!=='+JSON.stringify(P.meta.sha256)+'||P.rows.length!=='+P.rows.length+
    '||D.month.length!=='+D.month.length+'||D.product.length!=='+D.product.length+
    ")throw Error('Baixas ERP 2024-2026: fonte nao confere');");
  replace(/const expectedByYear=\{[^;]+;/,
    'const expectedByYear='+JSON.stringify(Object.fromEntries(Object.entries(years).map(([k,v])=>[k,[v.records,v.cents]])))+';');
  replace(/if\(monthActual\.get\('2026-10'\)[\s\S]*?throw Error\('Baixas mensais do ERP inconsistentes'\);/,
    "if(monthActual.get('2026-10')?.records!=="+months['2026-10'].records+
    "||monthActual.get('2026-10')?.cents!=="+months['2026-10'].cents+
    "||monthActual.get('2026-11')?.records!=="+months['2026-11'].records+
    "||monthActual.get('2026-11')?.cents!=="+months['2026-11'].cents+
    "||monthActual.get('2025-01')?.records!=="+months['2025-01'].records+
    ")throw Error('Baixas mensais do ERP inconsistentes');");
  replace(/window\.MOVEMENTS_NOVEMBER_META=\{[^;]+;/,
    "window.MOVEMENTS_NOVEMBER_META={from:'01/11/2026',to:'27/11/2026',records:"+months['2026-11'].records+
    ',value:'+(months['2026-11'].cents/100)+',partial:true};');
  const minRecords=years['2025'].records+years['2026'].records-months['2026-11'].records;
  replace(/minMonths:2,records:\d+/,'minMonths:2,records:'+minRecords);
  reconcile=reconcile.replaceAll('ate 26/11','ate 27/11').replaceAll('26/11/2026','27/11/2026');
  const money=x=>(x/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const summary='Baixas ERP (data de negociação): 14/03/2024 a 27/11/2026 · '+count.toLocaleString('pt-BR')+
    ' lançamentos · R$ '+money(cents)+'. Novembro parcial fora da média de mínimo; saldo ERP de 27/11 sem desconto adicional.';
  replace(/box\.innerHTML=[\s\S]*?;\s*summary\.prepend\(box\);/,
    'box.innerHTML='+JSON.stringify(summary)+';summary.prepend(box);');
  write('movement-reconcile-full-20261103.js',reconcile);

  const localKeys=new Set(),networkKeys=new Set();
  for(const r of all){
    if(Number(r[5])<=0)continue;
    const loc=D.local[r[1]],product=D.product[r[3]];
    if(!loc||!product)continue;
    localKeys.add(String(loc[0])+'|'+String(product[0]));networkKeys.add(String(product[0]));
  }
  const prelude='window.DB_WITHDRAWAL_HISTORY_2024_2026='+JSON.stringify({
    localCodes:[...localKeys],networkCodes:[...networkKeys],from:'14/03/2024',to:'27/11/2026',
    dateBasis:'Dt.Neg.',records:count,includes2024:true,excludedFromMinimum:['2024']})+';\n';
  for(const name of ['stock-no-withdrawals-tab-20261015.js','sao-joao-no-withdrawals.js','chua-no-withdrawals.js']){
    const original=read(name);
    assert(original.startsWith('window.DB_WITHDRAWAL_HISTORY_2024_2026='));
    write(name,prelude+original.replace(/^window\.DB_WITHDRAWAL_HISTORY_2024_2026=[^\n]+\n/,'')
      .replaceAll('26/11/2026','27/11/2026').replaceAll('26/11','27/11'));
  }
  for(const p of [names[0],names[1],'movement-reconcile-full-20261103.js','movement-history-ui-20261103.js'])
    new vm.Script(read(p),{filename:p});
  return {date:m.to,recordsAdded:91,addedCents:m.cents,totalRecords:count,totalCents:cents,
    duplicateSequences:0,detailRows:daily.size,physicalStockUnchanged:true,minimumClosedMonthsUnchanged:true,
    source:m.source,sourceSHA256:m.sourceSHA256,platesInSource:39};
}
