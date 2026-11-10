import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';

export function applyBaixasNegociacao20261106(root,out) {
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const write=(p,value)=>fs.writeFileSync(path.join(out,p),value);

  const pack=JSON.parse(gunzipSync(Buffer.from(read('data/baixas-negociacao-20261106.b64').trim(),'base64')).toString('utf8'));
  // A fotografia de 06/11 foi retificada pelo ERP em 09/11. Substitui
  // integralmente as 28 linhas antigas de 06/11 pelas 147 novas e soma as 16 de 07/11.
  const supplement=JSON.parse(gunzipSync(Buffer.from(read('data/baixas-complemento-20261107.b64').trim(),'base64')).toString('utf8'));
  assert.equal(supplement.sourceSHA256,'be6e48626874e88b97c16bd9590b60e7b065cf532d6ef0c62bb19780c6210b15');
  assert.equal(supplement.records,163);
  assert.equal(supplement.cents,1637624);
  assert.equal(supplement.byDate['2026-11-06'].records,147);
  assert.equal(supplement.byDate['2026-11-07'].records,16);
  const old06=pack.dailyRows.filter(x=>x[0]==='2026-11-06');
  assert.equal(old06.reduce((n,r)=>n+r[7],0),28);
  assert.equal(old06.reduce((n,r)=>n+r[6],0),404091);
  pack.dailyRows=pack.dailyRows.filter(x=>x[0]!=='2026-11-06');
  const dict=pack.dict;
  const indexOrAppend=(list,value)=>{let i=list.findIndex(x=>String(x)===String(value));if(i<0){i=list.length;list.push(value)}return i};
  const getLocalIndex=code=>{
    const index=dict.local.findIndex(x=>String(x[0])===String(code));
    assert(index>=0,'Local de baixa novo nao existe no cadastro: '+code);
    return index;
  };
  const majorityCompany=new Map();
  for(const row of pack.dailyRows){
    const id=row[1], companies=majorityCompany.get(id)||new Map();
    companies.set(row[2],(companies.get(row[2])||0)+row[7]);
    majorityCompany.set(id,companies);
  }
  const productIndex=new Map(dict.product.map((r,i)=>[String(r[0]),i]));
  const extra=new Map();
  for(const row of supplement.rows){
    const [date,company,codeLocal,local,code,product,group,unit,qty,cents,document,seq,comparison]=row;
    assert(date==='2026-11-06'||date==='2026-11-07');
    assert(Number(qty)>0 && Number.isInteger(cents) && cents>=0);
    const li=getLocalIndex(codeLocal);
    const existing=pack.dailyRows.find(x=>x[1]===li&&String(dict.product[x[3]]?.[0])===String(code));
    const companies=majorityCompany.get(li)||new Map();
    const fi=existing?existing[2]:[...companies].sort((a,b)=>b[1]-a[1])[0]?.[0];
    assert(fi!==undefined,'Empresa de baixa sem referencia para '+codeLocal);
    const gi=indexOrAppend(dict.group,group);
    let pi=productIndex.get(String(code));
    if(pi===undefined){pi=dict.product.length;dict.product.push([String(code),String(product),gi]);productIndex.set(String(code),pi)}
    const ui=indexOrAppend(dict.unit,unit);
    const key=[date,li,fi,pi,ui].join('|');
    const value=extra.get(key)||[date,li,fi,pi,ui,0,0,0,0];
    value[5]+=Number(qty);value[6]+=Number(cents);value[7]++;
    if(comparison!=='IGUAL')value[8]++;
    extra.set(key,value);
  }
  pack.dailyRows.push(...extra.values());
  const originalMeta=pack.meta;
  assert.equal(originalMeta.records,21792);
  assert.equal(originalMeta.cents,254684892);
  originalMeta.records=21927;
  originalMeta.cents=255918425;
  originalMeta.value=2559184.25;
  originalMeta.to='2026-11-07';
  originalMeta.sourceFile=originalMeta.sourceFile+' + '+supplement.sourceFile;
  originalMeta.sourceSHA256=originalMeta.sourceSHA256+'+'+supplement.sourceSHA256;
  originalMeta.years['2026'].records=12352;
  originalMeta.years['2026'].value=1338414.82;

  // Baixas de 09/11/2026: adicionar apenas documentos novos, usando Dt.Neg. e
  // empresa fiscal real do ERP. A base anterior encerra em 07/11, sem dia 09.
  const day09=JSON.parse(gunzipSync(Buffer.from(read('data/baixas-dia-20261109.b64').trim(),'base64')).toString('utf8'));
  assert.equal(day09.sourceSHA256,'bd5a9c5f048ae4c1774a87f5c8351c88b91875e63b6e4b3b4b5f2f7d40fc4305');
  assert.equal(day09.dateBasis,'Dt.Neg.');
  assert.equal(day09.records,92);
  assert.equal(day09.cents,553278);
  assert.equal(day09.byDate?.['2026-11-09']?.records,92);
  assert.equal(day09.byDate?.['2026-11-09']?.cents,553278);
  assert.equal(day09.rows.length,92);
  assert.equal(pack.dailyRows.filter(x=>x[0]==='2026-11-09').length,0,'Dia 09 ja existe na base; impedir duplicidade');
  const seenDay09=new Set(),groupedDay09=new Map();
  let checkedDay09Cents=0;
  for(const item of day09.rows){
    const [date,company,codeLocal,local,code,product,group,unit,qty,cents,document,seq,comparison]=item;
    assert.equal(date,'2026-11-09');
    assert(Number(qty)>0 && Number.isInteger(cents) && cents>=0);
    assert.equal(comparison,'IGUAL');
    const documentKey=String(document)+'|'+String(seq);
    assert(!seenDay09.has(documentKey),'Duplicidade Nro.Unico + Seq.: '+documentKey);
    seenDay09.add(documentKey);checkedDay09Cents+=cents;
    const li=getLocalIndex(codeLocal);
    assert.equal(String(dict.local[li][1]),String(local),'Divergencia cadastro local ERP');
    const fi=dict.company.findIndex(v=>Number(v)===Number(company));
    assert(fi>=0,'Empresa fiscal ausente: '+company);
    const gi=indexOrAppend(dict.group,group);
    let pi=productIndex.get(String(code));
    if(pi===undefined){pi=dict.product.length;dict.product.push([String(code),String(product),gi]);productIndex.set(String(code),pi)}
    const ui=indexOrAppend(dict.unit,unit);
    const key=[date,li,fi,pi,ui].join('|');
    const record=groupedDay09.get(key)||[date,li,fi,pi,ui,0,0,0,0];
    record[5]+=Number(qty);record[6]+=cents;record[7]++;
    groupedDay09.set(key,record);
  }
  assert.equal(checkedDay09Cents,day09.cents);
  pack.dailyRows.push(...groupedDay09.values());
  originalMeta.records+=day09.records;
  originalMeta.cents+=day09.cents;
  originalMeta.value=originalMeta.cents/100;
  originalMeta.to='2026-11-09';
  originalMeta.sourceFile+=' + '+day09.sourceFile;
  originalMeta.sourceSHA256+='+'+day09.sourceSHA256;
  originalMeta.years['2026'].records+=day09.records;
  originalMeta.years['2026'].value=Number((originalMeta.years['2026'].value+day09.cents/100).toFixed(2));
  const source=pack.meta,D=pack.dict,daily=pack.dailyRows;
  const sum=(rows,k)=>rows.reduce((a,x)=>a+Number(x[k]||0),0);
  assert.equal(source.dateBasis,'Dt.Neg.');
  assert(source.sourceSHA256.startsWith('a068fc42ae4e5ce17378da97351d98b1ad1c99fefdc3af26a0b6c795e493f897+'));
  assert.equal(source.to,'2026-11-09');
  assert.equal(source.records,22019);
  assert.equal(sum(daily,7),22019);
  assert.equal(sum(daily,6),256471703);
  const aggregate=new Map();
  for(const row of daily){
    const mi=D.month.indexOf(row[0].slice(0,7));
    assert(mi>=0,'Mes de negociacao ausente: '+row[0]);
    const k=[mi,...row.slice(1,5)].join('|');
    if(aggregate.has(k)){const x=aggregate.get(k);for(const j of [5,6,7,8])x[j]+=row[j]}
    else aggregate.set(k,[mi,...row.slice(1)]);
  }
  const P={dict:D,meta:{...source,sha256:source.sourceSHA256,costField:'Custo_Total',
    status:{IGUAL:source.records-sum(daily,8),DIFERENTE:sum(daily,8)}},rows:[...aggregate.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3]-b[3])};
  assert(P.rows.length>=13796,'Historico consolidado inesperadamente menor');
  assert.equal(sum(P.rows,7),source.records);
  assert.equal(sum(P.rows,6),source.cents);
  const byMonth={},byYear={};
  for(const x of P.rows){
    const month=D.month[x[0]],yr=month.slice(0,4);
    const m=byMonth[month]||(byMonth[month]={records:0,cents:0});
    const y=byYear[yr]||(byYear[yr]={records:0,cents:0});
    m.records+=x[7];m.cents+=x[6];y.records+=x[7];y.cents+=x[6];
  }
  const totalCount=sum(P.rows,7),totalCents=sum(P.rows,6);
  for(const y of ['2024','2025','2026']){
    assert.equal(byYear[y].records,source.years[y].records);
    assert.equal(byYear[y].cents,Math.round(source.years[y].value*100));
  }
  const money=x=>x/100;
  const formatted=x=>money(x).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  P.meta.years=Object.fromEntries(Object.entries(byYear).map(([y,v])=>[y,{records:v.records,value:money(v.cents)}]));
  P.meta.months=Object.fromEntries(Object.entries(byMonth).map(([y,v])=>[y,{records:v.records,value:money(v.cents)}]));
  P.meta.retification={replacesAllPreviousHistory:true,dateBasis:'Dt.Neg.',monthsReclassified:950};
  for(const year of ['2024','2025','2026']){
    const rows=daily.filter(x=>x[0].startsWith(year+'-'));
    assert.equal(sum(rows,7),byYear[year].records);
    const detail={year,rows,meta:{year,records:sum(rows,7),value:money(sum(rows,6)),dateBasis:'Dt.Neg.',sourceFile:source.sourceFile}};
    write('baixas-detalhe-'+year+'.json.gz',gzipSync(Buffer.from(JSON.stringify(detail)),{level:9,mtime:0}));
  }
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
    "||D.month.length!=="+D.month.length+"||D.product.length!=="+D.product.length+
    ")throw Error('Baixas ERP 2024-2026: fonte nao confere');");
  replace('anuais',/const expectedByYear=\{[^;]+;/,
    'const expectedByYear='+JSON.stringify(Object.fromEntries(Object.entries(byYear).map(([k,v])=>[k,[v.records,v.cents]])))+';');
  replace('mensais',/if\(monthActual\.get\('2026-10'\)[\s\S]*?throw Error\('Baixas mensais do ERP inconsistentes'\);/,
    "if(monthActual.get('2026-10')?.records!=="+byMonth['2026-10'].records+
    "||monthActual.get('2026-10')?.cents!=="+byMonth['2026-10'].cents+
    "||monthActual.get('2026-11')?.records!=="+byMonth['2026-11'].records+
    "||monthActual.get('2026-11')?.cents!=="+byMonth['2026-11'].cents+
    "||monthActual.get('2025-01')?.records!=="+byMonth['2025-01'].records+")throw Error('Baixas mensais do ERP inconsistentes');");
  replace('outubro',/window\.MOVEMENTS_OCTOBER_META=\{[^;]+;/,
    "window.MOVEMENTS_OCTOBER_META={from:'01/10/2026',to:'31/10/2026',records:"+byMonth['2026-10'].records+
    ",value:"+money(byMonth['2026-10'].cents)+"};");
  replace('novembro',/window\.MOVEMENTS_NOVEMBER_META=\{[^;]+;/,
    "window.MOVEMENTS_NOVEMBER_META={from:'01/11/2026',to:'09/11/2026',records:"+byMonth['2026-11'].records+
    ",value:"+money(byMonth['2026-11'].cents)+",partial:true};");
  replace('quantidade minima',/minMonths:2,records:17026/,
    'minMonths:2,records:'+(byYear['2025'].records+byYear['2026'].records-byMonth['2026-11'].records));
  replace('resumo',/box\.innerHTML=[\s\S]*?;\s*summary\.prepend\(box\);/,
    "box.innerHTML='<b>Baixas ERP (data de negociação): 14/03/2024 a 09/11/2026</b> · "+
    totalCount.toLocaleString('pt-BR')+" lancamentos · <b>R$ "+formatted(totalCents)+
    "</b>.'+'<div style=\"color:#657366;font-size:11px\">"+
    "2024: "+byYear['2024'].records+" baixas (somente consulta). 2025: "+byYear['2025'].records+
    " baixas. 2026: "+byYear['2026'].records+
    " baixas ate 09/11. Fonte integral substituída pela data de negociação, sem duplicidade. "+
    "Estoque minimo: 22 meses completos (2025 e janeiro-outubro/2026), cobertura de 2 meses; "+
    "novembro parcial fora da média. Saldo físico preservado da posição ERP 09/11/2026, sem subtração adicional.</div>';summary.prepend(box);");
  replace('2024 meta',/window\.MOVEMENTS_2024_META=\{[^;]+;/,
    "window.MOVEMENTS_2024_META={from:'14/03/2024',to:'31/12/2024',records:"+byYear['2024'].records+",value:"+money(byYear['2024'].cents)+",forMinimum:false};");
  reconcile=reconcile.replace("sourceSHA256:meta.sha256,","sourceSHA256:meta.sha256,dateBasis:meta.dateBasis,");
  write('movement-reconcile-full-20261103.js',reconcile);
  let history=read('public/movement-history-ui-20261103.js')
    .replace('19.387 lançamentos',totalCount.toLocaleString('pt-BR')+' lançamentos')
    .replace('2.298</b>',byYear['2024'].records.toLocaleString('pt-BR')+'</b>')
    .replace('R$ 151.077,95','R$ '+formatted(byYear['2024'].cents))
    .replace('6.220</b>',byYear['2025'].records.toLocaleString('pt-BR')+'</b>')
    .replace('R$ 552.015,35','R$ '+formatted(byYear['2025'].cents))
    .replace('10.869</b>',byYear['2026'].records.toLocaleString('pt-BR')+'</b>')
    .replace('R$ 1.077.223,73','R$ '+formatted(byYear['2026'].cents))
    .replaceAll('?v=20261103-1525','?v=20261106-negociacao')
    .replace('O arquivo recebido não informa a situação da conferência.','A data de referência é a negociação (Dt.Neg.).');
  assert(history.includes('20261106-negociacao'));
  write('movement-history-ui-20261103.js',history);
  const historicKeys=new Set(),networkCodes=new Set();
  for(const d of daily){
    if(Number(d[5])<=0)continue;
    const loc=D.local[d[1]],prod=D.product[d[3]];
    if(!loc||!prod)continue;
    historicKeys.add(String(loc[0])+'|'+String(prod[0]));
    networkCodes.add(String(prod[0]));
  }
  const historicPrelude='window.DB_WITHDRAWAL_HISTORY_2024_2026='+JSON.stringify({
    localCodes:[...historicKeys],networkCodes:[...networkCodes],
    from:'14/03/2024',to:'09/11/2026',dateBasis:'Dt.Neg.',records:source.records,
    includes2024:true,excludedFromMinimum:['2024']
  })+';\n';
  const noBaixas=read('public/stock-no-withdrawals-tab-20261015.js')
    .replace('window.MOVEMENTS_REVISED_META?.records === 19387','window.MOVEMENTS_REVISED_META?.records === '+totalCount)
    .replaceAll('14/03/2024 a 03/11/2026','14/03/2024 a 09/11/2026')
    .replace("historyEnd:'03/11/2026'","historyEnd:'09/11/2026'")
    .replace('const movementByLocal=new Map();',"const movementByLocal=new Map();const allHistory=new Set((window.DB_WITHDRAWAL_HISTORY_2024_2026?.localCodes)||[]);const allNetwork=new Set((window.DB_WITHDRAWAL_HISTORY_2024_2026?.networkCodes)||[]);")
    .replace('if(movementByLocal.has(stockKey(s)))continue;',"if(movementByLocal.has(stockKey(s))||allHistory.has(localCodeKey(s)))continue;")
    .replace("if(f.scope==='rede'&&hasMovementsInNetwork.has(x.codigo))return false;","if(f.scope==='rede'&&(hasMovementsInNetwork.has(x.codigo)||allNetwork.has(x.codigo)))return false;")
    .replace('sourceRows.filter(x=>!hasMovementsInNetwork.has(x.codigo)).length',"sourceRows.filter(x=>!hasMovementsInNetwork.has(x.codigo)&&!allNetwork.has(x.codigo)).length");
  assert(noBaixas!==read('public/stock-no-withdrawals-tab-20261015.js'));
  write('stock-no-withdrawals-tab-20261015.js',historicPrelude+noBaixas);
  for(const pilot of ['sao-joao','chua']){
    const name=pilot+'-no-withdrawals.js';
    const src=read('public/'+name)
      .replace('window.MOVEMENTS_REVISED_META?.records!==21792','window.MOVEMENTS_REVISED_META?.records!=='+totalCount)
      .replace('const localMovements = new Set(), networkMovements = new Set(), pending = new Set();',
        'const localMovements = new Set(), networkMovements = new Set(), pending = new Set();'+
        'const allHistory=new Set((window.DB_WITHDRAWAL_HISTORY_2024_2026?.localCodes)||[]);'+
        'const allNetwork=new Set((window.DB_WITHDRAWAL_HISTORY_2024_2026?.networkCodes)||[]);')
      .replace('localMovements.has(stockKey(s)))continue;',
        'localMovements.has(stockKey(s))||allHistory.has(localCode(s)))continue;')
      .replace('networkMovements.has(String(s.codigo))',
        '(networkMovements.has(String(s.codigo))||allNetwork.has(String(s.codigo)))');
    assert(src.includes('allHistory.has(localCode(s))'));
    write(name,historicPrelude+src);
  }
  const audit={sourceSHA256:source.sourceSHA256,dateBasis:'Dt.Neg.',monthsReclassified:950,
    receivedRecords:source.records,
    revisedRecords:totalCount,totalValue:money(totalCents),
    annual:P.meta.years,october:P.meta.months['2026-10'],november:P.meta.months['2026-11'],
    monthlyPositions:P.rows.length,physicalStockUnchanged:true};
  fs.writeFileSync(path.join(root,'build-baixas-audit.json'),JSON.stringify(audit,null,2)+'\n');
  return audit;
}