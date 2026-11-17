import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// ERP 17/11/2026: saldo fisico substitutivo e baixas incrementais por Dt.Neg.
export function applyRemessa20261117(root,out) {
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const dest=p=>path.join(out,p);
  const write=(p,s)=>fs.writeFileSync(dest(p),s,'utf8');
  const sha=x=>createHash('sha256').update(x).digest('hex');
  const stockData=JSON.parse(read('data/stock-snapshot-20261117.json'));
  const movementData=JSON.parse(read('data/baixas-20261113-a-17.json'));
  const st=stockData.meta,mt=movementData.meta;
  assert.equal(st.records,4428);
  assert.equal(st.cents,243256770);
  assert.equal(mt.records,288);
  assert.equal(mt.cents,1534995);
  assert.equal(mt.dateBasis,'Dt.Neg.');
  assert.equal(mt.from,'2026-11-13');
  assert.equal(mt.to,'2026-11-17');

  // Rebuild the exact existing 12-part stock payload after previous ERP snapshots.
  let stockBase64='';
  for(let i=1;i<=12;i++){
    const file='stock-current-20261103-1558-'+String(i).padStart(2,'0')+'.js';
    const script=fs.readFileSync(dest(file),'utf8');
    const match=script.match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/);
    assert(match,'Arquivo de estoque anterior ausente: '+file);
    stockBase64+=match[1];
  }
  const stockPrefix='window.CURRENT_STOCK_20260911=';
  const stockSource=gunzipSync(Buffer.from(stockBase64,'base64')).toString('utf8').trim();
  assert(stockSource.startsWith(stockPrefix),'Formato de estoque anterior desconhecido');
  const stock=JSON.parse(stockSource.slice(stockPrefix.length).replace(/;$/,''));
  assert.equal(stock.rows.length,4374,'Estoque anterior deveria corresponder a 12/11');
  assert.equal(stock.meta.emissao,'12/11/2026 09:35:54');
  const currentRows=stockData.rows;
  assert.equal(currentRows.length,st.records);
  const key=r=>[String(r[0]),String(r[1]),String(r[3]),String(r[6])].join('|');
  assert.equal(new Set(currentRows.map(key)).size,currentRows.length,'Duplicidade de chave fiscal de estoque');
  assert.equal(new Set(currentRows.map(r=>String(r[1]))).size,9);
  assert(currentRows.every(r=>r.length===10 && Number(r[7])>0 && Number(r[9])>=0));
  assert.equal(currentRows.reduce((n,r)=>n+Math.round(Number(r[9])*100),0),st.cents);
  const oldKeys=new Map(stock.rows.map(r=>[key(r),r]));
  const newKeys=new Map(currentRows.map(r=>[key(r),r]));
  let added=0,removed=0,updated=0;
  for(const [k,v] of newKeys){if(!oldKeys.has(k))added++;else if(JSON.stringify(v)!==JSON.stringify(oldKeys.get(k)))updated++;}
  for(const k of oldKeys.keys())if(!newKeys.has(k))removed++;
  stock.rows=currentRows;
  stock.meta={...stock.meta,emissao:st.date,registros:st.records,posicoes:st.records,
    valor:st.cents/100,sourceFile:st.source,sha256:sha(read('data/stock-snapshot-20261117.json')),
    previousSnapshot:'12/11/2026 09:35:54',newRows:added,updatedRows:updated,
    removedRows:removed,warehouses:9,source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade'};
  const compressed=gzipSync(Buffer.from(stockPrefix+JSON.stringify(stock)+';\n'),{level:9,mtime:0}).toString('base64');
  const partSize=Math.ceil(compressed.length/12);
  for(let i=0;i<12;i++){
    const segment=compressed.slice(i*partSize,(i+1)*partSize);
    write('stock-current-20261103-1558-'+String(i+1).padStart(2,'0')+'.js',
      'window.CURRENT_STOCK_GZ'+(i===0?'':'+')+"='"+segment+"';\n");
  }

  // Expand the already-audited 2024-2026 ERP movement dataset; never alter old dates.
  const ctx=vm.createContext({window:{}});
  for(const name of ['movement-full-base-20261103.js',
    'movement-full-01-20261103.js','movement-full-02-20261103.js',
    'movement-full-03-20261103.js','movement-full-04-20261103.js']){
    vm.runInContext(fs.readFileSync(dest(name),'utf8'),ctx,{timeout:4000});
  }
  const P=ctx.window.MOVEMENTS_COMPLETE_20261103,D=P.dict;
  assert.equal(P.meta.to,'2026-11-12');
  assert.equal(P.meta.records,22180);
  assert.equal(Math.round(P.meta.value*100),257566037);
  assert.equal(P.meta.dateBasis,'Dt.Neg.');
  const dkeys=new Set(movementData.rows.map(x=>String(x[10])+'|'+String(x[11])));
  assert.equal(dkeys.size,mt.records,'Nro.Unico + Seq. duplicados');
  const gidx=(arr,v)=>{let i=arr.findIndex(x=>String(x)===String(v));if(i<0){i=arr.length;arr.push(v)}return i;};
  const products=new Map(D.product.map((x,i)=>[String(x[0]),i]));
  const months=new Map(),daily=new Map();
  for(const r of P.rows)months.set(r.slice(0,5).join('|'),r);
  const groupIndices=new Map(D.group.map((s,i)=>[String(s),i]));
  for(const r of movementData.rows){
    const [date,company,localCode,localName,code,product,group,unit,qty,cents,document,seq,status]=r;
    assert(date>='2026-11-13' && date<='2026-11-17');
    assert(Number(qty)>0 && Number.isInteger(cents) && cents>=0);
    const li=D.local.findIndex(x=>String(x[0])===String(localCode));
    assert(li>=0&&String(D.local[li][1])===String(localName),'Local de baixa inconsistente: '+localCode);
    const fi=D.company.findIndex(x=>Number(x)===Number(company));
    assert(fi>=0,'Empresa fiscal desconhecida: '+company);
    const gi=gidx(D.group,group);
    let pi=products.get(String(code));
    if(pi===undefined){pi=D.product.length;D.product.push([String(code),String(product),gi]);products.set(String(code),pi);}
    const ui=gidx(D.unit,unit);
    const mi=gidx(D.month,date.slice(0,7));
    const mkey=[mi,li,fi,pi,ui].join('|');
    const monthly=months.get(mkey)||[mi,li,fi,pi,ui,0,0,0,0];
    monthly[5]+=Number(qty);monthly[6]+=cents;monthly[7]++;
    if(status!=='IGUAL')monthly[8]++;
    months.set(mkey,monthly);
    const dkey=[date,li,fi,pi,ui].join('|');
    const d=daily.get(dkey)||[date,li,fi,pi,ui,0,0,0,0];
    d[5]+=Number(qty);d[6]+=cents;d[7]++;if(status!=='IGUAL')d[8]++;
    daily.set(dkey,d);
  }
  assert.equal([...daily.values()].reduce((n,r)=>n+r[7],0),288);
  const all=[...months.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3]-b[3]);
  const records=all.reduce((n,r)=>n+r[7],0);
  const cents=all.reduce((n,r)=>n+r[6],0);
  assert.equal(records,22468);
  assert.equal(cents,259101032);
  const years={},perMonth={};
  for(const r of all){
    const ym=D.month[r[0]],year=ym.slice(0,4);
    if(!perMonth[ym])perMonth[ym]={records:0,cents:0};
    if(!years[year])years[year]={records:0,cents:0};
    for(const o of [perMonth[ym],years[year]]){o.records+=r[7];o.cents+=r[6];}
  }
  const money=x=>(x/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  P.rows=all;
  P.meta={...P.meta,to:'2026-11-17',records,cents,value:cents/100,
    sha256:P.meta.sha256+'+'+sha(read('data/baixas-20261113-a-17.json')),
    sourceSHA256:P.meta.sourceSHA256+'+'+sha(read('data/baixas-20261113-a-17.json')),
    sourceFile:P.meta.sourceFile+' + '+mt.source,
    status:{IGUAL:(P.meta.status?.IGUAL||0)+282,DIFERENTE:(P.meta.status?.DIFERENTE||0)+6},
    years:Object.fromEntries(Object.entries(years).map(([k,v])=>[k,{records:v.records,value:v.cents/100}])),
    months:Object.fromEntries(Object.entries(perMonth).map(([k,v])=>[k,{records:v.records,value:v.cents/100}]))};
  const countPerPart=Math.ceil(P.rows.length/4);
  write('movement-full-base-20261103.js','window.MOVEMENTS_COMPLETE_20261103='+JSON.stringify({...P,rows:[]})+';\n');
  for(let i=0;i<4;i++)write('movement-full-'+String(i+1).padStart(2,'0')+'-20261103.js',
    'window.MOVEMENTS_COMPLETE_20261103.rows.push(...'+
    JSON.stringify(P.rows.slice(i*countPerPart,(i+1)*countPerPart))+');\n');
  const gzFile=dest('baixas-detalhe-2026.json.gz');
  const detail=JSON.parse(gunzipSync(fs.readFileSync(gzFile)).toString('utf8'));
  assert.equal(detail.rows.reduce((n,r)=>n+r[7],0),detail.meta.records,'Historico diario anterior inconsistente');
  assert(detail.rows.every(x=>x[0]<'2026-11-13'));
  detail.rows.push(...daily.values());
  detail.meta.records+=288;
  detail.meta.value=Math.round((detail.meta.value+mt.cents/100)*100)/100;
  detail.meta.sourceFile+=' + '+mt.source;
  detail.meta.dateBasis='Dt.Neg.';
  assert.equal(detail.rows.reduce((n,r)=>n+r[7],0),years['2026'].records);
  fs.writeFileSync(gzFile,gzipSync(Buffer.from(JSON.stringify(detail)),{level:9,mtime:0}));

  // Update ERP reconciliation's strict validation to the newly published totals.
  let reconcile=fs.readFileSync(dest('movement-reconcile-full-20261103.js'),'utf8');
  const replace=(label,re,value)=>{assert(re.test(reconcile),'Revisar marcador ERP: '+label);reconcile=reconcile.replace(re,value);};
  replace('origem',/if\(meta\.records!==\d+\|\|[\s\S]*?throw Error\('Baixas ERP 2024-2026: fonte nao confere'\);/,
    "if(meta.records!=="+records+"||Math.round(meta.value*100)!=="+cents+
    "||meta.sha256!=="+JSON.stringify(P.meta.sha256)+"||P.rows.length!=="+P.rows.length+
    "||D.month.length!=="+D.month.length+"||D.product.length!=="+D.product.length+
    ")throw Error('Baixas ERP 2024-2026: fonte nao confere');");
  replace('anos',/const expectedByYear=\{[^;]+;/,
    'const expectedByYear='+JSON.stringify(Object.fromEntries(Object.entries(years).map(([k,v])=>[k,[v.records,v.cents]])))+';');
  replace('meses',/if\(monthActual\.get\('2026-10'\)[\s\S]*?throw Error\('Baixas mensais do ERP inconsistentes'\);/,
    "if(monthActual.get('2026-10')?.records!=="+perMonth['2026-10'].records+
    "||monthActual.get('2026-10')?.cents!=="+perMonth['2026-10'].cents+
    "||monthActual.get('2026-11')?.records!=="+perMonth['2026-11'].records+
    "||monthActual.get('2026-11')?.cents!=="+perMonth['2026-11'].cents+
    "||monthActual.get('2025-01')?.records!=="+perMonth['2025-01'].records+")throw Error('Baixas mensais do ERP inconsistentes');");
  replace('novembro',/window\.MOVEMENTS_NOVEMBER_META=\{[^;]+;/,
    "window.MOVEMENTS_NOVEMBER_META={from:'01/11/2026',to:'17/11/2026',records:"+perMonth['2026-11'].records+
    ",value:"+(perMonth['2026-11'].cents/100)+",partial:true};");
  replace('estoque minimo',/minMonths:2,records:\d+/,
    'minMonths:2,records:'+(years['2025'].records+years['2026'].records-perMonth['2026-11'].records));
  reconcile=reconcile.replace('12/11/2026','17/11/2026').replaceAll('ate 12/11','ate 17/11');
  const summary='Baixas ERP (data de negociação): 14/03/2024 a 17/11/2026 · '+records.toLocaleString('pt-BR')+
    ' lançamentos · R$ '+money(cents)+'. Novembro parcial fora da média de mínimo; saldo ERP de 17/11 não recebe desconto adicional.';
  replace('resumo',/box\.innerHTML=[\s\S]*?;\s*summary\.prepend\(box\);/,
    'box.innerHTML='+JSON.stringify(summary)+';summary.prepend(box);');
  write('movement-reconcile-full-20261103.js',reconcile);

  // Keep 2024-2026 no-withdrawal historical sets aligned with the new ERP history.
  const historical=new Set(),network=new Set();
  for(const row of all){
    if(Number(row[5])<=0)continue;
    const loc=D.local[row[1]],prod=D.product[row[3]];
    if(!loc||!prod)continue;
    historical.add(String(loc[0])+'|'+String(prod[0]));
    network.add(String(prod[0]));
  }
  const prelude='window.DB_WITHDRAWAL_HISTORY_2024_2026='+JSON.stringify({
    localCodes:[...historical],networkCodes:[...network],
    from:'14/03/2024',to:'17/11/2026',dateBasis:'Dt.Neg.',
    records,includes2024:true,excludedFromMinimum:['2024']})+';\n';
  for(const file of ['stock-no-withdrawals-tab-20261015.js','sao-joao-no-withdrawals.js','chua-no-withdrawals.js']){
    let script=fs.readFileSync(dest(file),'utf8');
    assert(script.startsWith('window.DB_WITHDRAWAL_HISTORY_2024_2026='));
    script=prelude+script.replace(/^window\.DB_WITHDRAWAL_HISTORY_2024_2026=[^\n]+\n/,'')
      .replaceAll('12/11/2026','17/11/2026').replaceAll('12/11','17/11')
      .replaceAll('22180',String(records));
    write(file,script);
  }
  const result={stock:{records:currentRows.length,cents:st.cents,added,removed,updated,
    previousRecords:4374,previousCents:228161967,date:st.date},
    withdrawals:{added:288,addedCents:mt.cents,totalRecords:records,totalCents:cents,
      from:mt.from,to:mt.to,dateBasis:'Dt.Neg.',exceptions:6},
    physicalBalanceNotReducedByWithdrawals:true,
    minimumMonths:2,novemberExcludedFromMonthlyAverage:true};
  fs.writeFileSync(path.join(root,'build-remessa-20261117.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
