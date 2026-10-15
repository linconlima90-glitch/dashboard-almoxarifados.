// Authoritative stock and retrospective movements supplied on 15 October 2026.
// Replaces July onward, never appends overlapping totals. Runs before the fast build.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync,brotliDecompressSync} from 'node:zlib';
const root=process.cwd(),archive=path.join(root,'.refresh-source-20261015');
fs.mkdirSync(archive,{recursive:true});
function original(file){const backup=path.join(archive,file);if(!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(file,backup)}return fs.readFileSync(backup,'utf8')}
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v)};
const cents=v=>Math.round(Number(v)*100),clean=v=>Math.round(v*1e6)/1e6;
const key=x=>String(x.codigo_local)+'|'+String(x.codigo);
const encoded=[1,2,3].map(i=>fs.readFileSync(`data/refresh-20261015.0${i}.br.b64`,'utf8').trim()).join('');
const raw=brotliDecompressSync(Buffer.from(encoded,'base64'));
assert.equal(createHash('sha256').update(raw).digest('hex'),'d32a20805cb0de6d809ec744eddc17bb665723e8beb02f37d1786287715ce9f7','Snapshot checksum mismatch');
const D=JSON.parse(raw);
let html=original('public/index.html'),index=original('src/index.js');
function get(name){const found=html.match(new RegExp('^const '+name+'=(\\[.*\\]);','m'));assert(found,'Missing '+name);return JSON.parse(found[1])}
function set(name,data){const pattern=new RegExp('^const '+name+'=\\[.*\\];','m');assert(pattern.test(html));html=html.replace(pattern,()=>`const ${name}=${JSON.stringify(data)};`)}
const base=get('MOVEMENTS'),baseYears=get('MOVEMENTS_YEARLY'),pending=get('MOVEMENT_YEAR_PENDING');
const oldSources=index.match(/<script src="\/stock-current-[^"]+\.js\?[^\"]+"><\/script>/g)||[];
const ctx=vm.createContext({window:{}});
for(const tag of oldSources){const file=tag.match(/src="\/([^?]+)\?/)[1];const code=original('public/'+file);if(/window\.CURRENT_STOCK_GZ\s*(?:\+)?=/.test(code))vm.runInContext(code,ctx)}
assert(ctx.window.CURRENT_STOCK_GZ,'Original stock not found');
const decoded=gunzipSync(Buffer.from(ctx.window.CURRENT_STOCK_GZ,'base64')).toString();
const prefix='window.CURRENT_STOCK_20260911=';
const P=JSON.parse(decoded.slice(decoded.indexOf(prefix)+prefix.length).trim().replace(/;$/,''));
assert.equal(P.rows.length,3714);assert.equal(P.rows.reduce((s,r)=>s+cents(r[9]),0),226373043,'Unexpected starting stock');
const stock=new Map(P.rows.map(r=>[r[1]+'|'+r[3],r.slice()]));assert.equal(stock.size,P.rows.length);
for(const [lc,c] of D.rm)assert(stock.delete(lc+'|'+c),'Removal missing');
for(const [lc,c,q,unit,value] of D.patch){const row=stock.get(lc+'|'+c);assert(row,'Patch missing');row[7]=q;row[8]=unit;row[9]=value}
for(const [lc,c,name,group,un,q,unit,value] of D.add){assert(!stock.has(lc+'|'+c),'Duplicate stock');const [company,local]=D.stockLocals[lc];stock.set(lc+'|'+c,[company,lc,local,c,name,group,un,q,unit,value])}
for(const [k,[company,name,un,group]] of Object.entries(D.stockMetadata)){const row=stock.get(k);assert(row);row[0]=company;row[4]=name;row[6]=un;row[5]=group}
const rawStock=[...stock.values()];assert.equal(rawStock.length,4104);assert.equal(rawStock.reduce((s,r)=>s+cents(r[9]),0),228098947);
// Construction cement was explicitly excluded. Vulcanizing cement remains a parts item.
const excludedCode=c=>String(c)==='100234';
P.rows=rawStock.filter(r=>!excludedCode(r[3]));
P.meta={emissao:'15/10/2026 09:53:59',registros:P.rows.length,arquivo:'Estoques_analitico(8).xls',registros_fonte:4104,excluidos:1};
const cols=['empresa','codigo_local','local','codigo','produto','grupo','un','estoque','custo_estoque','valor_estoque'];
const stockObjects=P.rows.map(r=>Object.fromEntries(cols.map((n,i)=>[n,r[i]]))),sm=new Map(stockObjects.map(r=>[key(r),r]));
const productMap=new Map(get('PRODUCTS').map(p=>[String(p.codigo),p]));
for(const p of base)if(!productMap.has(String(p.codigo)))productMap.set(String(p.codigo),p);
for(const p of stockObjects)productMap.set(String(p.codigo),p);
for(const [c,[produto,grupo,un]] of Object.entries(D.products))productMap.set(c,{codigo:Number(c),produto,grupo,un});
// Preserve the last published undated records in an archive, not in the revised totals.
const previous=vm.createContext({window:{dispatchEvent(){}},MOVEMENTS:structuredClone(base),STOCK:stockObjects,CustomEvent:class{},console,MINIMUM_CONTINUOUS_UNITS:new Set(['KG','LT','ML','MT','M2','M3','CM','GR'])});
for(const name of ['public/movement-update-20260930.js','public/movement-update-20261008.js'])vm.runInContext(original(name),previous,{timeout:10000});
const previousBy=new Map(previous.MOVEMENTS.map(x=>[key(x),x])),pendingKeys=new Set(pending.map(key)),incoming=new Map();
assert.equal(pendingKeys.size,353);
for(const [lc,c,month,q,value,records] of D.monthly){
 assert(month>=7&&month<=10&&Number.isFinite(q)&&q>=0);const k=lc+'|'+c;
 if(!incoming.has(k))incoming.set(k,{codigo_local:String(lc),codigo:c,months:Array(12).fill(0),costs:Array(12).fill(0),counts:Array(12).fill(0)});
 const a=incoming.get(k);assert.equal(a.counts[month-1],0,'Duplicate monthly bucket');a.months[month-1]=q;a.costs[month-1]=value;a.counts[month-1]=records;
}
assert.equal([...incoming.values()].reduce((n,a)=>n+a.counts.reduce((x,y)=>x+y,0),0),4227);
assert.equal([...incoming.values()].reduce((n,a)=>n+a.costs.reduce((x,y)=>x+cents(y),0),0),41647759);
const byYear=new Map(baseYears.map(x=>[x.year+'|'+key(x),x])),originalBy=new Map(base.map(x=>[key(x),x]));
const allKeys=new Set([...base.map(key),...sm.keys(),...incoming.keys()]),merged=[];
const monthlyReport=Array.from({length:4},(_,i)=>({month:`${String(i+7).padStart(2,'0')}/2026`,records:0,value:0,excludedRecords:0,excludedValue:0}));
for(const a of incoming.values())for(let j=6;j<=9;j++){const r=monthlyReport[j-6];if(excludedCode(a.codigo)){r.excludedRecords+=a.counts[j];r.excludedValue+=cents(a.costs[j])}else{r.records+=a.counts[j];r.value+=cents(a.costs[j])}}
for(const k of allKeys){
 const [lc,c]=k.split('|');if(excludedCode(c))continue;
 const old=originalBy.get(k),oldLatest=previousBy.get(k)||old,s=sm.get(k),p=productMap.get(c)||old||{};
 const a=incoming.get(k)||{months:Array(12).fill(0),costs:Array(12).fill(0),counts:Array(12).fill(0)};
 const old2025=byYear.get('2025|'+k),old2026=byYear.get('2026|'+k);
 const revised2026=(old2026?.months||Array(12).fill(0)).map((q,i)=>i<6?Number(q)||0:a.months[i]);
 const months=revised2026.map((q,i)=>clean(q+(Number(old2025?.months?.[i])||0)));
 const knownHistory=!!(old2025||old2026),historicPending=pendingKeys.has(k);
 assert(!(historicPending&&knownHistory),'Ambiguous row unexpectedly has dated history');
 const total=clean(months.reduce((x,y)=>x+y,0)),complete=clean((old2025?.total||0)+revised2026.slice(0,9).reduce((x,y)=>x+y,0));
 const completeMonths=knownHistory?21:3,periodQty=a.months.reduce((x,y)=>x+y,0),periodValue=a.costs.reduce((x,y)=>x+y,0);
 const cost=s?.custo_estoque||oldLatest?.cost||(periodQty>0?periodValue/periodQty:0);
 const m={...(old||{}),empresa:s?.empresa||old?.empresa||D.stockLocals[lc]?.[0]||'',codigo_local:lc,local:s?.local||old?.local||D.locals[lc]||'',codigo:Number(c),produto:s?.produto||p.produto||'',grupo:s?.grupo||p.grupo||'',un:s?.un||p.un||'',months,total,complete_total:complete,complete_months:completeMonths,avg:complete/completeMonths,minimum:0,stock:s?.estoque||0,cost,stock_value:s?.valor_estoque||0,coverage:null,need:0,need_value:0,excess:0,active_month_buckets:months.filter(q=>q>0).length,consumption_value:0,status:'',source:historicPending?'DESDE JUL/2026 EXATO; HISTORICO SEM ANO ARQUIVADO':knownHistory?'HISTORICO DATADO + REVISAO 01/07 A 15/10/2026':'HISTORICO DISPONIVEL DESDE 01/07/2026',history_before_july:historicPending?'PENDING':knownHistory?'DATED':'UNAVAILABLE',legacy_unassigned_total:historicPending?Number(oldLatest.total)||0:0,revision_months:a.months,revision_costs:a.costs,revision_counts:a.counts,revision_total:clean(periodQty),revision_value:a.costs.reduce((x,y)=>x+cents(y),0)/100,qtd_set_20261008:a.months[9],valor_set_20261008:a.costs[9]};
 m.minimum=m.avg*2;m.coverage=m.avg>0?m.stock/m.avg:null;merged.push(m);
 if(knownHistory||incoming.has(k))byYear.set('2026|'+k,{empresa:m.empresa,codigo_local:lc,local:m.local,grupo:m.grupo,codigo:m.codigo,produto:m.produto,un:m.un,year:'2026',months:revised2026,total:clean(revised2026.reduce((x,y)=>x+y,0)),cost,value:clean(revised2026.reduce((x,y)=>x+y,0))*cost,active_months:revised2026.filter(q=>q>0).length,source:m.source,cost_source:'CUSTO ATUAL',history_before_july:m.history_before_july,quality:historicPending?'JULHO EM DIANTE EXATO; ANTERIOR PENDENTE':knownHistory?'EXATO':'EXATO DESDE JULHO; ANTERIOR NAO DISPONIVEL'});
}
const keys=[...new Set(merged.flatMap(x=>Object.keys(x)))];
const normalized=merged.map(x=>Object.fromEntries(keys.map(k=>[k,x[k]===undefined?null:x[k]])));
set('MOVEMENTS',normalized);set('MOVEMENTS_YEARLY',[...byYear.values()].filter(x=>!excludedCode(x.codigo)));
const network=get('CDI_NETWORK_YEARLY'),netMap=new Map(network.map(x=>[x.year+'|'+x.k,x])),perCode=new Map();
for(const a of incoming.values()){if(excludedCode(a.codigo))continue;const c=String(a.codigo);if(!perCode.has(c))perCode.set(c,Array(12).fill(0));for(let j=6;j<=9;j++)perCode.get(c)[j]+=a.months[j]}
for(const c of new Set([...network.filter(x=>x.year==='2026').map(x=>String(x.k)),...perCode.keys()])){
 if(excludedCode(c)){netMap.delete('2026|'+c);continue}const old=netMap.get('2026|'+c),p=productMap.get(c)||{},mn=(old?.months||Array(12).fill(0)).map((q,j)=>j<6?q:clean(perCode.get(c)?.[j]||0));
 netMap.set('2026|'+c,{k:c,year:'2026',produto:p.produto||old?.produto||'',grupo:p.grupo||old?.grupo||'',un:p.un||old?.un||'',months:mn,total:clean(mn.reduce((a,b)=>a+b,0)),legacy_complete_total:clean(mn.slice(0,9).reduce((a,b)=>a+b,0))});
}
for(const n of netMap.values())if(n.year==='2025')n.legacy_complete_total=n.total;
set('CDI_NETWORK_YEARLY',[...netMap.values()].filter(x=>!excludedCode(x.k)));
html=html.replaceAll("completeMonths=y==='2026'?8:12","completeMonths=y==='2026'?9:12").replaceAll('avg=complete/19','avg=complete/21').replaceAll('complete_months:19,avg','complete_months:21,avg');
html=html.replace("const y=String(year),completeMonths=y==='2026'?9:12,out=[];for(const x of baseRows){let months,a,quality='EXATO',source=x.source;","const y=String(year),out=[];for(const x of baseRows){let completeMonths=y==='2026'?9:12,months,a,quality='EXATO',source=x.source;");
html=html.replace("if(MINIMUM_YEAR_PENDING_KEYS.has(key))continue;a=MINIMUM_YEAR_MAP.get(`${y}|${key}`);","if(MINIMUM_YEAR_PENDING_KEYS.has(key)&&y!=='2026')continue;a=MINIMUM_YEAR_MAP.get(`${y}|${key}`);if(y==='2026'&&a?.history_before_july&&a.history_before_july!=='DATED')completeMonths=3;");
html=html.replace("source=a?.source||x.source}const total","source=a?.source||x.source;quality=a?.quality||quality}const total");
html=html.replaceAll('Mínimo 4M','Mínimo 2M').replaceAll('mínimo de 4 meses','mínimo de 2 meses').replaceAll('cobertura de 4 meses','cobertura de 2 meses');
html=html.replaceAll('Todos os anos · média com 19 observações completas','Histórico validado · até 21 meses completos; sem histórico datado anterior: jul–set/2026');
html=html.replaceAll('2026 · média com jan–ago (8 meses completos); setembro parcial só entra na quantidade total','2026 · meses completos até setembro; outubro parcial só entra na quantidade total');
html=html.replaceAll('month-partial">Set*</th><th class="num">Out','">Set</th><th class="num month-partial">Out*').replaceAll("const sep=String(year)==='2026'?'Set*':'Set'","const sep='Set'");
html=html.replaceAll('Setembro parcial','Outubro parcial').replaceAll('setembro parcial','outubro parcial');
const afterMap=new Map(get('MOVEMENTS_YEARLY').map(x=>[x.year+'|'+key(x),x]));
for(const old of baseYears){if(excludedCode(old.codigo))continue;const now=afterMap.get(old.year+'|'+key(old));assert(now);assert.deepEqual(now.months.slice(0,old.year==='2025'?12:6),old.months.slice(0,old.year==='2025'?12:6),'Earlier history changed')}
for(const p of pending){const a=normalized.find(x=>key(x)===key(p)),b=previousBy.get(key(p));if(!a||!b)continue;assert.equal(a.legacy_unassigned_total,Number(b.total)||0);assert.equal(a.total,a.revision_total);assert.equal(a.complete_months,3)}
for(const m of normalized){const a=incoming.get(key(m));assert.deepEqual(m.revision_months,a?.months||Array(12).fill(0));assert.equal(m.avg,m.complete_total/m.complete_months)}
write('public/index.html',html);
write('public/stock-current-refresh-20261015.js','window.CURRENT_STOCK_GZ='+JSON.stringify(gzipSync(prefix+JSON.stringify(P)+';',{level:9}).toString('base64'))+';\n');
index=index.replace(/<script src="\/stock-current-[^"]+"><\/script>/g,'').replace(/<script src="\/movement-update-2026(?:0930|1008)\.js[^\"]*"><\/script>/g,'');
const loaderTag=index.match(/<script src="\/current-stock-loader-[^"]+"><\/script>/)?.[0];assert(loaderTag);
index=index.replace(loaderTag,'<script src="/stock-current-refresh-20261015.js?v=20261015-1"></script>'+loaderTag);
index=index.replace("'<script src=\"/minimum-policy-2months-20261008.js","'<script src=\"/revision-meta-20261015.js?v=1\"></script><script src=\"/minimum-policy-2months-20261008.js");
const end=index.indexOf('      { html: true }\n    );');assert(end>=0);index=index.slice(0,end).replace(/,\s*$/," +\n      '<script src=\"/revision-summary-20261015.js?v=1\"></script>',\n")+index.slice(end);
write('src/index.js',index);
for(const file of ['public/current-stock-apply-20260911.js','public/current-stock-loader-20260911.js','public/layout-clean-v2.js','public/sao-joao-pilot.js']){let text=original(file).replaceAll('08/10/2026','15/10/2026').replaceAll('01 a 08/10','01 a 15/10').replaceAll('01/10 a 08/10','01/10 a 15/10');write(file,text)}
const summary={from:'01/07/2026',to:'15/10/2026',stockDate:P.meta.emissao,sourceStockRows:4104,stockRows:P.rows.length,stockValue:P.rows.reduce((s,r)=>s+cents(r[9]),0)/100,sourceMovementRecords:4227,sourceMovementCost:416477.59,excludedMovementRecords:48,excludedMovementCost:103639.28,movementRecords:4179,movementCost:312838.31,minimumMonths:2,pendingHistory:pending.length,datedHistoryPreserved:true,monthly:monthlyReport.map(r=>({...r,value:r.value/100,excludedValue:r.excludedValue/100})),locations:Object.entries(D.locals),rows:normalized.filter(r=>r.revision_counts.some(n=>n>0)).map(x=>[x.local,x.codigo,x.produto,x.grupo,x.un,x.revision_months.slice(6,10),x.revision_costs.slice(6,10),x.revision_counts.slice(6,10),x.history_before_july])};
assert.equal(summary.stockRows,4103);assert.equal(cents(summary.stockValue),226824236);assert.equal(summary.monthly.reduce((s,m)=>s+m.records,0),4179);assert.equal(summary.monthly.reduce((s,m)=>s+cents(m.value),0),31283831);
const october=summary.monthly[3];
write('public/revision-meta-20261015.js','window.DB_REFRESH_META='+JSON.stringify(summary)+';\nwindow.MOVEMENTS_OCTOBER_META='+JSON.stringify({from:'01/10/2026',to:'15/10/2026',records:october.records,value:october.value,locations:new Set(summary.rows.filter(x=>x[7][3]>0).map(x=>x[0])).size})+';\n');
write('public/movement-history-unresolved-20261015.json',JSON.stringify(previous.MOVEMENTS.filter(x=>pendingKeys.has(key(x)))));
write('refresh-report.json',JSON.stringify({...summary,rows:undefined},null,2));
console.log('REFRESH_REPORT',JSON.stringify({...summary,rows:undefined}));
