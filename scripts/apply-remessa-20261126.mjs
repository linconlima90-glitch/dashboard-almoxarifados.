import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// ERP snapshot of 25 November plus the pending withdrawals of 23–25 November.
// The snapshot is authoritative: never subtract these withdrawals from it again.
export function applyRemessa20261126(root,out){
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const dest=p=>path.join(out,p);
  const write=(p,s)=>fs.writeFileSync(dest(p),s,'utf8');
  const sha=s=>createHash('sha256').update(s).digest('hex');
  const unpack=p=>JSON.parse(gunzipSync(Buffer.from(read(p).trim(),'base64')).toString('utf8'));
  const encoded=read('data/remessa-delta-20261126.b64').trim();
  const delta=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
  const m=delta.meta,wd=delta.withdrawals;
  assert.equal(delta.schemaVersion,1);
  assert.equal(sha(encoded),'4974867e08ed343ca58a9bf70bb6ee210221e947b583ec41e2ca933e922a4329');
  assert.equal(m.date,'25/11/2026 15:59:16');
  assert.equal(m.sourceSHA256,'39e98fb8692360c5696c7b327f19fb80b1b8118cfab2290b0e27866d1e818416');
  assert.equal(m.records,4443);
  assert.equal(m.cents,239771283);
  assert.equal(delta.rows.length,m.records);
  assert.equal(wd.dateBasis,'Dt.Neg.');
  assert.equal(wd.costField,'Custo_Total');
  assert.equal(wd.records,279);
  assert.equal(wd.cents,914769);
  assert.equal(wd.valueCents,914772);
  assert.equal(wd.rows.length,wd.records);
  assert.equal(wd.rows.reduce((n,r)=>n+r[9],0),wd.cents);
  assert.equal(wd.rows.reduce((n,r)=>n+r[13],0),wd.valueCents);
  assert.deepEqual(wd.byDate,{
    '2026-11-23':{records:100,cents:345237,valueCents:345238},
    '2026-11-24':{records:82,cents:289010,valueCents:289011},
    '2026-11-25':{records:97,cents:280522,valueCents:280523}
  });
  assert.equal(wd.sources.length,2);
  assert.equal(wd.sources.reduce((n,s)=>n+s.records,0),wd.records);
  assert.equal(wd.sources.reduce((n,s)=>n+s.cents,0),wd.cents);
  for(let i=0;i<wd.sources.length;i++){
    const rows=wd.rows.filter(r=>r[18]===i),source=wd.sources[i];
    assert.equal(rows.length,source.records);
    assert.equal(rows.reduce((n,r)=>n+r[9],0),source.cents);
    assert.equal(rows.reduce((n,r)=>n+r[13],0),source.valueCents);
  }

  // Preserve document identity in addition to the historical monthly aggregates.
  // Earlier base history is certified through 21/11; all incoming dates are later.
  const documentKey=r=>[r[10],r[11],r[1],r[2]].map(String).join('|');
  const documentSignature=r=>JSON.stringify([String(r[0]),String(r[1]),String(r[2]),
    String(r[4]),String(r[7]),Number(r[8]),Number(r[9]),String(r[10]),String(r[11]),String(r[12])]);
  const priorDocuments=new Map();
  const remember=r=>{
    const key=documentKey(r),signature=documentSignature(r);
    if(priorDocuments.has(key))assert.equal(priorDocuments.get(key),signature,'Conflicting historical document: '+key);
    else priorDocuments.set(key,signature);
  };
  for(const file of ['data/baixas-complemento-20261107.b64','data/baixas-dia-20261109.b64',
    'data/baixas-dia-20261111.b64'])for(const r of unpack(file).rows)remember(r);
  for(const r of JSON.parse(read('data/baixas-20261113-a-17.json')).rows)remember(r);
  for(const file of ['data/remessa-delta-20261119.b64','data/remessa-delta-20261122.b64'])
    for(const r of unpack(file).withdrawals.rows)remember(r);
  // The existing 12/11 source is embedded in the earlier importer.
  const day12Match=read('scripts/apply-baixas-negociacao-20261106.mjs')
    .match(/const day12=JSON\.parse\(gunzipSync\(Buffer\.from\('([A-Za-z0-9+/=]+)','base64'\)/);
  assert(day12Match,'Previous 12 November source changed; review document coverage');
  const day12=JSON.parse(gunzipSync(Buffer.from(day12Match[1],'base64')).toString('utf8'));
  for(const r of day12.rows)remember(r);
  const imported=new Map(),incoming=[];
  let duplicatesSkipped=0;
  for(const r of wd.rows){
    assert.equal(r.length,wd.rowColumns.length);
    assert(r[0]>=wd.from&&r[0]<=wd.to&&r[0]>'2026-11-21');
    assert(Number(r[8])>0&&Number.isInteger(r[9])&&r[9]>=0);
    assert(Number.isInteger(r[13])&&r[13]>=0);
    assert(r[10]!==null&&r[11]!==null&&r[1]!==null&&r[2]!==null);
    assert.equal(r[12],'IGUAL');
    const key=documentKey(r),signature=documentSignature(r);
    const previous=imported.get(key)??priorDocuments.get(key);
    if(previous!==undefined){
      assert.equal(previous,signature,'Conflicting incoming document: '+key);
      duplicatesSkipped++;
      continue;
    }
    imported.set(key,signature);
    incoming.push(r);
  }
  assert.equal(duplicatesSkipped,wd.duplicatesSkipped);
  assert.equal(duplicatesSkipped,0);
  assert.equal(incoming.length,279);

  const ctx=vm.createContext({window:{}});
  for(const name of ['movement-full-base-20261103.js','movement-full-01-20261103.js',
    'movement-full-02-20261103.js','movement-full-03-20261103.js','movement-full-04-20261103.js'])
    vm.runInContext(fs.readFileSync(dest(name),'utf8'),ctx,{timeout:4000});
  const P=ctx.window.MOVEMENTS_COMPLETE_20261103,D=P.dict;
  assert.equal(P.meta.to,'2026-11-21');
  assert.equal(P.meta.records,22640);
  assert.equal(Math.round(P.meta.value*100),260102764);
  assert.equal(P.rows.reduce((n,r)=>n+r[7],0),22640);
  assert.equal(P.rows.reduce((n,r)=>n+r[6],0),260102764);
  const minimumRowsBefore=JSON.stringify(P.rows.filter(r=>D.month[r[0]]>='2025-01'&&D.month[r[0]]<='2026-10'));

  // Replace the entire physical ERP inventory while leaving approved managerial
  // cost overrides to the existing runtime, which retains the original ERP values.
  let stock64='';
  for(let i=1;i<=12;i++){
    const filename='stock-current-20261103-1558-'+String(i).padStart(2,'0')+'.js';
    const match=fs.readFileSync(dest(filename),'utf8').match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/);
    assert(match,'ERP stock fragment missing: '+filename);
    stock64+=match[1];
  }
  const prefix='window.CURRENT_STOCK_20260911=';
  const raw=gunzipSync(Buffer.from(stock64,'base64')).toString('utf8').trim();
  assert(raw.startsWith(prefix));
  const stock=JSON.parse(raw.slice(prefix.length).replace(/;$/,''));
  assert.equal(stock.meta.emissao,m.previous);
  assert.equal(stock.rows.length,m.previousRecords);
  assert.equal(stock.rows.reduce((n,r)=>n+Math.round(Number(r[9])*100),0),m.previousCents);
  const stockKey=r=>[r[0],r[1],r[3],r[6]].map(String).join('|');
  const oldStock=new Map(stock.rows.map(r=>[stockKey(r),r]));
  const newStock=new Map(delta.rows.map(r=>[stockKey(r),r]));
  assert.equal(oldStock.size,m.previousRecords);
  assert.equal(newStock.size,m.records,'Duplicate ERP fiscal stock position');
  assert(delta.rows.every(r=>r.length===10&&Number(r[7])>0&&Number(r[9])>=0));
  assert.equal(delta.rows.reduce((n,r)=>n+Math.round(Number(r[9])*100),0),m.cents);
  assert.equal(new Set(delta.rows.map(r=>String(r[1]))).size,m.warehouses);
  assert.equal(new Set(delta.rows.map(r=>String(r[3]))).size,m.products);
  const added=[...newStock.keys()].filter(k=>!oldStock.has(k)).length;
  const removed=[...oldStock.keys()].filter(k=>!newStock.has(k)).length;
  const updated=[...newStock].filter(([k,r])=>oldStock.has(k)&&JSON.stringify(oldStock.get(k))!==JSON.stringify(r)).length;
  const renamed=[...newStock].filter(([k,r])=>oldStock.has(k)&&oldStock.get(k)[4]!==r[4]).length;
  assert.equal(added,19);assert.equal(removed,11);assert.equal(updated,193);
  stock.rows=delta.rows;
  stock.meta={...stock.meta,emissao:m.date,registros:m.records,posicoes:m.records,
    valor:m.cents/100,valor_estoque:m.cents/100,locais:m.warehouses,warehouses:m.warehouses,
    sourceFile:m.source,sourceSHA256:m.sourceSHA256,sha256:sha(encoded),
    previousSnapshot:m.previous,previousRecords:m.previousRecords,previousValue:m.previousCents/100,
    newRows:added,updatedRows:updated,removedRows:removed,renamedRows:renamed,
    unchangedRows:m.records-added-updated,
    source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade'};
  const compressed=gzipSync(Buffer.from(prefix+JSON.stringify(stock)+';\n'),{level:9,mtime:0}).toString('base64');
  const partSize=Math.ceil(compressed.length/12);
  for(let i=0;i<12;i++)write('stock-current-20261103-1558-'+String(i+1).padStart(2,'0')+'.js',
    'window.CURRENT_STOCK_GZ'+(i===0?'':'+')+"='"+compressed.slice(i*partSize,(i+1)*partSize)+"';\n");

  const gi=(arr,v)=>{let i=arr.findIndex(x=>String(x)===String(v));if(i<0){i=arr.length;arr.push(v)}return i;};
  const productIndex=new Map(D.product.map((r,i)=>[String(r[0]),i]));
  const monthly=new Map(P.rows.map(r=>[r.slice(0,5).join('|'),r]));
  const daily=new Map();
  for(const r of incoming){
    const [date,company,localCode,localName,code,product,group,unit,quantity,cents,document,sequence,status]=r;
    const li=D.local.findIndex(x=>String(x[0])===String(localCode));
    assert(li>=0&&String(D.local[li][1])===String(localName),'Unrecognized ERP location: '+localCode);
    // Despite its name, dict.company stores the source's Unidade labels, not
    // fiscal Cod.Emp. Use the supplied label exactly, never an inferred majority.
    // The fiscal company remains preserved in the raw row and document key.
    assert(typeof r[21]==='string'&&r[21].trim(),'Missing source Unidade: '+document+'/'+sequence);
    const fi=gi(D.company,r[21]);
    const groupIndex=gi(D.group,group);
    let pi=productIndex.get(String(code));
    if(pi===undefined){pi=D.product.length;D.product.push([String(code),String(product),groupIndex]);productIndex.set(String(code),pi);}
    const ui=gi(D.unit,unit),mi=gi(D.month,date.slice(0,7));
    const mk=[mi,li,fi,pi,ui].join('|');
    const mm=monthly.get(mk)||[mi,li,fi,pi,ui,0,0,0,0];
    mm[5]+=Number(quantity);mm[6]+=cents;mm[7]++;if(status!=='IGUAL')mm[8]++;
    monthly.set(mk,mm);
    const dk=[date,li,fi,pi,ui].join('|');
    const dd=daily.get(dk)||[date,li,fi,pi,ui,0,0,0,0];
    dd[5]+=Number(quantity);dd[6]+=cents;dd[7]++;if(status!=='IGUAL')dd[8]++;
    daily.set(dk,dd);
  }
  const all=[...monthly.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3]-b[3]);
  const records=all.reduce((n,r)=>n+r[7],0),cents=all.reduce((n,r)=>n+r[6],0);
  assert.equal(records,22919);assert.equal(cents,261017533);
  assert.equal(JSON.stringify(all.filter(r=>D.month[r[0]]>='2025-01'&&D.month[r[0]]<='2026-10')),minimumRowsBefore,
    'Completed 2025–2026 months must not change when importing November withdrawals');
  const years={},months={};
  for(const r of all){
    const ym=D.month[r[0]],year=ym.slice(0,4);
    if(!months[ym])months[ym]={records:0,cents:0};
    if(!years[year])years[year]={records:0,cents:0};
    for(const object of [months[ym],years[year]]){object.records+=r[7];object.cents+=r[6];}
  }
  assert.equal(years['2026'].records,13344);
  assert.equal(years['2026'].cents,138940590);
  P.rows=all;
  P.meta={...P.meta,to:wd.to,records,cents,value:cents/100,dateBasis:'Dt.Neg.',costField:'Custo_Total',
    sha256:P.meta.sha256+'+'+sha(encoded),
    sourceSHA256:P.meta.sourceSHA256+'+'+wd.sources.map(s=>s.sha256).join('+'),
    sourceFile:P.meta.sourceFile+' + '+wd.source,
    status:{IGUAL:(P.meta.status?.IGUAL||0)+incoming.length,DIFERENTE:(P.meta.status?.DIFERENTE||0)},
    documentKeyBasis:'Nro.Unico + Seq. + Cod.Emp. + Cod.Local',
    importedDocumentKeys:[...(P.meta.importedDocumentKeys||[]),...imported.keys()],
    importedDocumentKeysFrom:P.meta.importedDocumentKeysFrom||wd.from,
    years:Object.fromEntries(Object.entries(years).map(([k,v])=>[k,{records:v.records,value:v.cents/100}])),
    months:Object.fromEntries(Object.entries(months).map(([k,v])=>[k,{records:v.records,value:v.cents/100}]))};
  const countPerPart=Math.ceil(P.rows.length/4);
  write('movement-full-base-20261103.js','window.MOVEMENTS_COMPLETE_20261103='+JSON.stringify({...P,rows:[]})+';\n');
  for(let i=0;i<4;i++)write('movement-full-'+String(i+1).padStart(2,'0')+'-20261103.js',
    'window.MOVEMENTS_COMPLETE_20261103.rows.push(...'+JSON.stringify(P.rows.slice(i*countPerPart,(i+1)*countPerPart))+');\n');

  const gzFile=dest('baixas-detalhe-2026.json.gz');
  const detail=JSON.parse(gunzipSync(fs.readFileSync(gzFile)).toString('utf8'));
  assert.equal(detail.meta.to,'2026-11-21');
  assert.equal(detail.rows.reduce((n,r)=>n+r[7],0),detail.meta.records);
  assert(detail.rows.every(r=>r[0]<wd.from));
  for(const [date,expected] of Object.entries(wd.byDate)){
    const rows=[...daily.values()].filter(r=>r[0]===date);
    assert.equal(rows.reduce((n,r)=>n+r[7],0),expected.records);
    assert.equal(rows.reduce((n,r)=>n+r[6],0),expected.cents);
  }
  detail.rows.push(...daily.values());
  detail.meta={...detail.meta,records:years['2026'].records,value:years['2026'].cents/100,
    to:wd.to,sourceFile:detail.meta.sourceFile+' + '+wd.source,dateBasis:'Dt.Neg.',costField:'Custo_Total'};
  assert.equal(detail.rows.reduce((n,r)=>n+r[7],0),detail.meta.records);
  assert.equal(detail.rows.reduce((n,r)=>n+r[6],0),years['2026'].cents);
  fs.writeFileSync(gzFile,gzipSync(Buffer.from(JSON.stringify(detail)),{level:9,mtime:0}));
  let historyUi=fs.readFileSync(dest('movement-history-ui-20261103.js'),'utf8');
  const cachePattern=/\/baixas-detalhe-'\+year\+'\.json\.gz\?v=[^']+/;
  assert(cachePattern.test(historyUi),'Daily history asset URL changed');
  historyUi=historyUi.replace(cachePattern,"/baixas-detalhe-'+year+'.json.gz?v=20261126");
  const historyHeading=/<b>[\d.]+ lançamentos<\/b><\/summary>/;
  assert(historyHeading.test(historyUi),'Detailed history heading changed');
  historyUi=historyUi.replace(historyHeading,'<b>${integer(meta.records)} lançamentos</b></summary>');
  for(const year of ['2024','2025','2026']){
    const card=new RegExp('(<small>'+year+' · [^<]+</small><b>)[^<]*(</b><span>)[^<]*(</span>)');
    assert(card.test(historyUi),'Detailed history year card changed: '+year);
    historyUi=historyUi.replace(card,(_,before,middle,after)=>before+
      '${integer(meta.years["'+year+'"].records)}'+middle+
      '${money(meta.years["'+year+'"].value)}'+after);
  }
  // The dictionary's company labels come from Unidade, not fiscal Cod.Emp.
  // Correct the description/export header without rewriting historical values.
  assert(historyUi.includes('dia, almoxarifado, empresa fiscal, produto e unidade'));
  assert(historyUi.includes("['Data','Empresa fiscal','Codigo local'"));
  historyUi=historyUi
    .replace('dia, almoxarifado, empresa fiscal, produto e unidade',
      'dia, almoxarifado, unidade de origem, produto e unidade de medida')
    .replace("['Data','Empresa fiscal','Codigo local'","['Data','Unidade de origem','Codigo local'");
  write('movement-history-ui-20261103.js',historyUi);

  let reconcile=fs.readFileSync(dest('movement-reconcile-full-20261103.js'),'utf8');
  const replace=(label,re,value)=>{assert(re.test(reconcile),'ERP marker changed: '+label);reconcile=reconcile.replace(re,value);};
  replace('source',/if\(meta\.records!==\d+\|\|[\s\S]*?throw Error\('Baixas ERP 2024-2026: fonte nao confere'\);/,
    'if(meta.records!=='+records+'||Math.round(meta.value*100)!=='+cents+
    '||meta.sha256!=='+JSON.stringify(P.meta.sha256)+'||P.rows.length!=='+P.rows.length+
    '||D.month.length!=='+D.month.length+'||D.product.length!=='+D.product.length+
    ")throw Error('Baixas ERP 2024-2026: fonte nao confere');");
  replace('years',/const expectedByYear=\{[^;]+;/,
    'const expectedByYear='+JSON.stringify(Object.fromEntries(Object.entries(years).map(([k,v])=>[k,[v.records,v.cents]])))+';');
  replace('months',/if\(monthActual\.get\('2026-10'\)[\s\S]*?throw Error\('Baixas mensais do ERP inconsistentes'\);/,
    "if(monthActual.get('2026-10')?.records!=="+months['2026-10'].records+
    "||monthActual.get('2026-10')?.cents!=="+months['2026-10'].cents+
    "||monthActual.get('2026-11')?.records!=="+months['2026-11'].records+
    "||monthActual.get('2026-11')?.cents!=="+months['2026-11'].cents+
    "||monthActual.get('2025-01')?.records!=="+months['2025-01'].records+
    ")throw Error('Baixas mensais do ERP inconsistentes');");
  replace('November',/window\.MOVEMENTS_NOVEMBER_META=\{[^;]+;/,
    "window.MOVEMENTS_NOVEMBER_META={from:'01/11/2026',to:'25/11/2026',records:"+months['2026-11'].records+
    ',value:'+(months['2026-11'].cents/100)+',partial:true};');
  const minimumRecords=years['2025'].records+years['2026'].records-months['2026-11'].records;
  replace('minimum',/minMonths:2,records:\d+/,'minMonths:2,records:'+minimumRecords);
  reconcile=reconcile.replaceAll('21/11/2026','25/11/2026').replaceAll('ate 21/11','ate 25/11');
  const money=x=>(x/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const summary='Baixas ERP (data de negociação): 14/03/2024 a 25/11/2026 · '+records.toLocaleString('pt-BR')+
    ' lançamentos · R$ '+money(cents)+'. Novembro parcial fora da média de mínimo; saldo ERP de 25/11 sem desconto adicional.';
  replace('summary',/box\.innerHTML=[\s\S]*?;\s*summary\.prepend\(box\);/,
    'box.innerHTML='+JSON.stringify(summary)+';summary.prepend(box);');
  write('movement-reconcile-full-20261103.js',reconcile);

  const localKeys=new Set(),networkKeys=new Set();
  for(const r of all){
    if(Number(r[5])<=0)continue;
    const location=D.local[r[1]],product=D.product[r[3]];
    if(!location||!product)continue;
    localKeys.add(String(location[0])+'|'+String(product[0]));networkKeys.add(String(product[0]));
  }
  const prelude='window.DB_WITHDRAWAL_HISTORY_2024_2026='+JSON.stringify({
    localCodes:[...localKeys],networkCodes:[...networkKeys],from:'14/03/2024',to:'25/11/2026',
    dateBasis:'Dt.Neg.',records,includes2024:true,excludedFromMinimum:['2024']})+';\n';
  for(const file of ['stock-no-withdrawals-tab-20261015.js','sao-joao-no-withdrawals.js','chua-no-withdrawals.js']){
    let js=fs.readFileSync(dest(file),'utf8');
    assert(js.startsWith('window.DB_WITHDRAWAL_HISTORY_2024_2026='));
    js=prelude+js.replace(/^window\.DB_WITHDRAWAL_HISTORY_2024_2026=[^\n]+\n/,'')
      .replaceAll('21/11/2026','25/11/2026').replaceAll('21/11','25/11').replaceAll('22640',String(records));
    write(file,js);
  }
  const result={stock:{records:m.records,cents:m.cents,date:m.date,source:m.source,
      previousRecords:m.previousRecords,previousCents:m.previousCents,added,removed,updated,
      renamed,unchanged:m.records-added-updated,zeroCostRows:stock.rows.filter(r=>Number(r[9])===0).length},
    withdrawals:{added:incoming.length,addedCents:wd.cents,originalValueCents:wd.valueCents,duplicatesSkipped,
      previousRecords:22640,previousCents:260102764,totalRecords:records,totalCents:cents,
      from:wd.from,to:wd.to,dateBasis:'Dt.Neg.',costField:'Custo_Total',byDate:wd.byDate,
      historicalDocumentKeysChecked:priorDocuments.size,importedDocumentKeys:imported.size},
    physicalBalanceNotReducedByWithdrawals:true,minimumMonths:2,minimumCompleteMonths:22,
    minimumPeriod:{from:'2025-01',to:'2026-10',records:minimumRecords},
    novemberExcludedFromMonthlyAverage:true,purchasesUntouched:true};
  fs.writeFileSync(path.join(root,'build-remessa-20261126.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
