import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// 22/11/2026: stock snapshot replacing 19/11 + new 20-21/11 withdrawals (Dt.Neg.).
// Stock rows are replaced by product code; physical quantities are not deducted twice.
export function applyRemessa20261122(root,out){
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const dest=p=>path.join(out,p);
  const write=(p,s)=>fs.writeFileSync(dest(p),s,'utf8');
  const sha=s=>createHash('sha256').update(s).digest('hex');
  const encoded=read('data/remessa-delta-20261122.b64').trim();
  const delta=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
  const m=delta.meta,wd=delta.withdrawals;
  assert.equal(m.date,'22/11/2026 14:52:02');
  assert.equal(m.records,4459);
  assert.equal(m.cents,243592356);
  assert.equal(m.productCount,208);
  assert.equal(m.replacementRows,357);
  assert.equal(delta.productCodes.length,m.productCount);
  assert.equal(delta.rows.length,m.replacementRows);
  assert.equal(wd.dateBasis,'Dt.Neg.');
  assert.equal(wd.records,55);
  assert.equal(wd.cents,252928);
  assert.equal(wd.rows.length,wd.records);
  assert.equal(wd.rows.reduce((n,r)=>n+r[9],0),wd.cents);
  assert(wd.rows.every(r=>r[12]==='IGUAL'));
  // Full ERP stock at 22/11 supersedes the 19/11 snapshot; never subtract
  // movements again from the already reconciled physical stock balance.
  let stock64='';
  for(let i=1;i<=12;i++){
    const filename='stock-current-20261103-1558-'+String(i).padStart(2,'0')+'.js';
    const code=fs.readFileSync(dest(filename),'utf8');
    const match=code.match(/window\\.CURRENT_STOCK_GZ(?:\\+)?='([^']+)';/);
    assert(match,'ERP stock fragment missing: '+filename);
    stock64+=match[1];
  }
  const prefix='window.CURRENT_STOCK_20260911=';
  const raw=gunzipSync(Buffer.from(stock64,'base64')).toString('utf8').trim();
  assert(raw.startsWith(prefix),'Unexpected ERP stock schema');
  const stock=JSON.parse(raw.slice(prefix.length).replace(/;$/,''));
  assert.equal(stock.rows.length,4454);
  assert.equal(stock.meta.emissao,'19/11/2026 12:53:55');
  assert.equal(stock.rows.reduce((n,r)=>n+Math.round(Number(r[9])*100),0),244198352);
  const products=new Set(delta.productCodes.map(String));
  assert.equal(products.size,m.productCount);
  assert(delta.rows.every(r=>products.has(String(r[3]))&&r.length===10));
  const key=r=>[String(r[0]),String(r[1]),String(r[3]),String(r[6])].join('|');
  const oldByKey=new Map(stock.rows.map(r=>[key(r),r]));
  assert.equal(oldByKey.size,stock.rows.length,'Duplicate previous stock fiscal key');
  const untouched=stock.rows.filter(r=>!products.has(String(r[3])));
  stock.rows=untouched.concat(delta.rows);
  const newByKey=new Map(stock.rows.map(r=>[key(r),r]));
  assert.equal(newByKey.size,m.records,'Duplicate current stock fiscal key');
  const added=[...newByKey.keys()].filter(k=>!oldByKey.has(k)).length;
  const removed=[...oldByKey.keys()].filter(k=>!newByKey.has(k)).length;
  const updated=[...newByKey].filter(([k,r])=>oldByKey.has(k)&&JSON.stringify(oldByKey.get(k))!==JSON.stringify(r)).length;
  assert.equal(stock.rows.length,m.records);
  assert.equal(stock.rows.reduce((n,r)=>n+Math.round(Number(r[9])*100),0),m.cents);
  assert.equal(new Set(stock.rows.map(r=>String(r[1]))).size,9);
  assert(stock.rows.every(r=>r.length===10&&Number(r[7])>0&&Number(r[9])>=0));
  stock.meta={...stock.meta,emissao:m.date,registros:m.records,posicoes:m.records,
    valor:m.cents/100,sourceFile:m.source,sha256:sha(encoded),previousSnapshot:m.previous,
    newRows:added,updatedRows:updated,removedRows:removed,warehouses:9,
    source:'ERP · fotografia integral substitutiva',
    fiscalKey:'empresa + codigo_local + codigo_produto + unidade'};
  const compressed=gzipSync(Buffer.from(prefix+JSON.stringify(stock)+';\\n'),{level:9,mtime:0}).toString('base64');
  const partSize=Math.ceil(compressed.length/12);
  for(let i=0;i<12;i++)write('stock-current-20261103-1558-'+String(i+1).padStart(2,'0')+'.js',
    'window.CURRENT_STOCK_GZ'+(i===0?'':'+')+"='"+compressed.slice(i*partSize,(i+1)*partSize)+"';\\n");

  // 20 and 21 November occur strictly after the prior certified history.
  const ids=wd.rows.map(r=>String(r[10])+'|'+String(r[11]));
  assert.equal(new Set(ids).size,wd.records,'Duplicate document+sequence in 22 November feed');
  assert.equal(wd.rows.filter(r=>r[0]==='2026-11-20').length,34);
  assert.equal(wd.rows.filter(r=>r[0]==='2026-11-21').length,21);
  assert(wd.rows.every(r=>r[0]>='2026-11-20'&&r[0]<='2026-11-21'));

  const ctx=vm.createContext({window:{}});
  for(const name of ['movement-full-base-20261103.js',
    'movement-full-01-20261103.js','movement-full-02-20261103.js',
    'movement-full-03-20261103.js','movement-full-04-20261103.js'])
    vm.runInContext(fs.readFileSync(dest(name),'utf8'),ctx,{timeout:4000});
  const P=ctx.window.MOVEMENTS_COMPLETE_20261103,D=P.dict;
  assert.equal(P.meta.to,'2026-11-19');
  assert.equal(P.meta.records,22585);
  assert.equal(Math.round(P.meta.value*100),259849836);
  const gi=(arr,v)=>{let i=arr.findIndex(x=>String(x)===String(v));if(i<0){i=arr.length;arr.push(v)}return i;};
  const prodIdx=new Map(D.product.map((r,i)=>[String(r[0]),i]));
  const prior=new Map();
  for(const r of P.rows){const o=prior.get(r[1])||new Map();o.set(r[2],(o.get(r[2])||0)+r[7]);prior.set(r[1],o);}
  const monthly=new Map(P.rows.map(r=>[r.slice(0,5).join('|'),r]));
  const daily=new Map();
  for(const r of wd.rows){
    const [date,company,localCode,localName,code,product,group,unit,qty,cents,document,seq,status]=r;
    assert(date>='2026-11-20'&&date<='2026-11-21');
    assert(Number(qty)>0&&Number.isInteger(cents)&&cents>=0);
    const li=D.local.findIndex(x=>String(x[0])===String(localCode));
    assert(li>=0&&String(D.local[li][1])===String(localName),'Local nao reconhecido: '+localCode);
    const directFi=D.company.findIndex(x=>Number(x)===Number(company));
    const existing=P.rows.find(x=>x[1]===li&&String(D.product[x[3]]?.[0])===String(code));
    const candidates=prior.get(li)||new Map();
    const fi=directFi>=0?directFi:(existing?existing[2]:[...candidates].sort((a,b)=>b[1]-a[1])[0]?.[0]);
    assert(fi!==undefined&&fi>=0,'Empresa fiscal sem referencia: '+company+'/'+localCode);
    const groupIndex=gi(D.group,group);
    let pi=prodIdx.get(String(code));
    if(pi===undefined){pi=D.product.length;D.product.push([String(code),String(product),groupIndex]);prodIdx.set(String(code),pi);}
    const ui=gi(D.unit,unit),mi=gi(D.month,date.slice(0,7));
    const mk=[mi,li,fi,pi,ui].join('|');
    const mm=monthly.get(mk)||[mi,li,fi,pi,ui,0,0,0,0];
    mm[5]+=Number(qty);mm[6]+=cents;mm[7]++;if(status!=='IGUAL')mm[8]++;
    monthly.set(mk,mm);
    const dk=[date,li,fi,pi,ui].join('|');
    const dd=daily.get(dk)||[date,li,fi,pi,ui,0,0,0,0];
    dd[5]+=Number(qty);dd[6]+=cents;dd[7]++;if(status!=='IGUAL')dd[8]++;
    daily.set(dk,dd);
  }
  assert.equal([...daily.values()].reduce((n,r)=>n+r[7],0),55);
  const all=[...monthly.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3]-b[3]);
  const records=all.reduce((n,r)=>n+r[7],0);
  const cents=all.reduce((n,r)=>n+r[6],0);
  assert.equal(records,22640);
  assert.equal(cents,260102764);
  const years={},months={};
  for(const r of all){
    const ym=D.month[r[0]],year=ym.slice(0,4);
    if(!months[ym])months[ym]={records:0,cents:0};
    if(!years[year])years[year]={records:0,cents:0};
    for(const o of [months[ym],years[year]]){o.records+=r[7];o.cents+=r[6];}
  }
  P.rows=all;
  P.meta={...P.meta,to:'2026-11-21',records,cents,value:cents/100,
    sha256:P.meta.sha256+'+'+sha(encoded),
    sourceSHA256:P.meta.sourceSHA256+'+'+sha(encoded),
    sourceFile:P.meta.sourceFile+' + '+wd.source,
    status:{IGUAL:(P.meta.status?.IGUAL||0)+55,DIFERENTE:(P.meta.status?.DIFERENTE||0)},
    years:Object.fromEntries(Object.entries(years).map(([k,v])=>[k,{records:v.records,value:v.cents/100}])),
    months:Object.fromEntries(Object.entries(months).map(([k,v])=>[k,{records:v.records,value:v.cents/100}]))};
  const countPerPart=Math.ceil(P.rows.length/4);
  write('movement-full-base-20261103.js','window.MOVEMENTS_COMPLETE_20261103='+JSON.stringify({...P,rows:[]})+';\n');
  for(let i=0;i<4;i++)write('movement-full-'+String(i+1).padStart(2,'0')+'-20261103.js',
    'window.MOVEMENTS_COMPLETE_20261103.rows.push(...'+JSON.stringify(P.rows.slice(i*countPerPart,(i+1)*countPerPart))+');\n');

  const gzFile=dest('baixas-detalhe-2026.json.gz');
  const detail=JSON.parse(gunzipSync(fs.readFileSync(gzFile)).toString('utf8'));
  assert.equal(detail.rows.reduce((n,r)=>n+r[7],0),detail.meta.records);
  assert(detail.rows.every(r=>r[0]<='2026-11-19'));
  detail.rows.push(...daily.values());
  detail.meta.records+=55;
  detail.meta.value=Math.round((detail.meta.value+wd.cents/100)*100)/100;
  detail.meta.to='2026-11-21';
  detail.meta.sourceFile+=' + '+wd.source;
  detail.meta.dateBasis='Dt.Neg.';
  assert.equal(detail.rows.reduce((n,r)=>n+r[7],0),years['2026'].records);
  fs.writeFileSync(gzFile,gzipSync(Buffer.from(JSON.stringify(detail)),{level:9,mtime:0}));

  let reconcile=fs.readFileSync(dest('movement-reconcile-full-20261103.js'),'utf8');
  const replace=(label,re,value)=>{assert(re.test(reconcile),'Marcador ERP alterado: '+label);reconcile=reconcile.replace(re,value);};
  replace('origem',/if\(meta\.records!==\d+\|\|[\s\S]*?throw Error\('Baixas ERP 2024-2026: fonte nao confere'\);/,
    "if(meta.records!=="+records+"||Math.round(meta.value*100)!=="+cents+
    "||meta.sha256!=="+JSON.stringify(P.meta.sha256)+"||P.rows.length!=="+P.rows.length+
    "||D.month.length!=="+D.month.length+"||D.product.length!=="+D.product.length+
    ")throw Error('Baixas ERP 2024-2026: fonte nao confere');");
  replace('anos',/const expectedByYear=\{[^;]+;/,
    'const expectedByYear='+JSON.stringify(Object.fromEntries(Object.entries(years).map(([k,v])=>[k,[v.records,v.cents]])))+';');
  replace('meses',/if\(monthActual\.get\('2026-10'\)[\s\S]*?throw Error\('Baixas mensais do ERP inconsistentes'\);/,
    "if(monthActual.get('2026-10')?.records!=="+months['2026-10'].records+
    "||monthActual.get('2026-10')?.cents!=="+months['2026-10'].cents+
    "||monthActual.get('2026-11')?.records!=="+months['2026-11'].records+
    "||monthActual.get('2026-11')?.cents!=="+months['2026-11'].cents+
    "||monthActual.get('2025-01')?.records!=="+months['2025-01'].records+
    ")throw Error('Baixas mensais do ERP inconsistentes');");
  replace('novembro',/window\.MOVEMENTS_NOVEMBER_META=\{[^;]+;/,
    "window.MOVEMENTS_NOVEMBER_META={from:'01/11/2026',to:'21/11/2026',records:"+months['2026-11'].records+
    ',value:'+(months['2026-11'].cents/100)+',partial:true};');
  replace('estoque minimo',/minMonths:2,records:\d+/,
    'minMonths:2,records:'+(years['2025'].records+years['2026'].records-months['2026-11'].records));
  reconcile=reconcile.replaceAll('19/11/2026','21/11/2026').replaceAll('ate 19/11','ate 21/11');
  const money=x=>(x/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const summary='Baixas ERP (data de negociação): 14/03/2024 a 21/11/2026 · '+records.toLocaleString('pt-BR')+
    ' lançamentos · R$ '+money(cents)+'. Novembro parcial fora da média de mínimo; saldo ERP de 22/11 sem desconto adicional.';
  replace('resumo',/box\.innerHTML=[\s\S]*?;\s*summary\.prepend\(box\);/,
    'box.innerHTML='+JSON.stringify(summary)+';summary.prepend(box);');
  write('movement-reconcile-full-20261103.js',reconcile);

  const localKeys=new Set(),networkKeys=new Set();
  for(const r of all){
    if(Number(r[5])<=0)continue;
    const loc=D.local[r[1]],prod=D.product[r[3]];
    if(!loc||!prod)continue;
    localKeys.add(String(loc[0])+'|'+String(prod[0]));
    networkKeys.add(String(prod[0]));
  }
  const prelude='window.DB_WITHDRAWAL_HISTORY_2024_2026='+JSON.stringify({
    localCodes:[...localKeys],networkCodes:[...networkKeys],from:'14/03/2024',to:'21/11/2026',
    dateBasis:'Dt.Neg.',records,includes2024:true,excludedFromMinimum:['2024']})+';\n';
  for(const file of ['stock-no-withdrawals-tab-20261015.js','sao-joao-no-withdrawals.js','chua-no-withdrawals.js']){
    let js=fs.readFileSync(dest(file),'utf8');
    assert(js.startsWith('window.DB_WITHDRAWAL_HISTORY_2024_2026='));
    js=prelude+js.replace(/^window\.DB_WITHDRAWAL_HISTORY_2024_2026=[^\n]+\n/,'')
      .replaceAll('19/11/2026','21/11/2026').replaceAll('19/11','21/11')
      .replaceAll('22585',String(records));
    write(file,js);
  }
  const result={stock:{records:m.records,cents:m.cents,added,removed,updated,date:m.date,patchedProducts:products.size,patchedRows:delta.rows.length},
    withdrawals:{added:wd.records,addedCents:wd.cents,
      totalRecords:records,totalCents:cents,from:wd.from,to:wd.to,dateBasis:'Dt.Neg.'},
    physicalBalanceNotReducedByWithdrawals:true,minimumMonths:2,novemberExcludedFromMonthlyAverage:true};
  fs.writeFileSync(path.join(root,'build-remessa-20261122.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}