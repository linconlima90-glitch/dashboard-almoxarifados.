import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';

export function applyBaixasNegociacao20261106(root,out) {
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const write=(p,value)=>fs.writeFileSync(path.join(out,p),value);

  const pack=JSON.parse(gunzipSync(Buffer.from(read('data/baixas-negociacao-20261106.b64').trim(),'base64')).toString('utf8'));
  const source=pack.meta,D=pack.dict,daily=pack.dailyRows;
  const sum=(rows,k)=>rows.reduce((a,x)=>a+Number(x[k]||0),0);
  assert.equal(source.dateBasis,'Dt.Neg.');
  assert.equal(source.sourceSHA256,'a068fc42ae4e5ce17378da97351d98b1ad1c99fefdc3af26a0b6c795e493f897');
  assert.equal(source.records,21792);
  assert.equal(sum(daily,7),21792);
  assert.equal(sum(daily,6),254684892);
  const aggregate=new Map();
  for(const row of daily){
    const mi=D.month.indexOf(row[0].slice(0,7));
    assert(mi>=0,'Mes de negociacao ausente: '+row[0]);
    const k=[mi,...row.slice(1,5)].join('|');
    if(aggregate.has(k)){const x=aggregate.get(k);for(const j of [5,6,7,8])x[j]+=row[j]}
    else aggregate.set(k,[mi,...row.slice(1)]);
  }
  const P={dict:D,meta:{...source,sha256:source.sourceSHA256,costField:'Custo_Total',
    status:{IGUAL:9562,DIFERENTE:12230}},rows:[...aggregate.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3]-b[3])};
  assert.equal(P.rows.length,13796);
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
    "window.MOVEMENTS_NOVEMBER_META={from:'01/11/2026',to:'06/11/2026',records:"+byMonth['2026-11'].records+
    ",value:"+money(byMonth['2026-11'].cents)+",partial:true};");
  replace('quantidade minima',/minMonths:2,records:17026/,
    'minMonths:2,records:'+(byYear['2025'].records+byYear['2026'].records-byMonth['2026-11'].records));
  replace('resumo',/box\.innerHTML=[\s\S]*?;\s*summary\.prepend\(box\);/,
    "box.innerHTML='<b>Baixas ERP (data de negociação): 14/03/2024 a 06/11/2026</b> · "+
    totalCount.toLocaleString('pt-BR')+" lancamentos · <b>R$ "+formatted(totalCents)+
    "</b>.'+'<div style=\"color:#657366;font-size:11px\">"+
    "2024: "+byYear['2024'].records+" baixas (somente consulta). 2025: "+byYear['2025'].records+
    " baixas. 2026: "+byYear['2026'].records+
    " baixas ate 06/11. Fonte integral substituída pela data de negociação, sem duplicidade. "+
    "Estoque minimo: 22 meses completos (2025 e janeiro-outubro/2026), cobertura de 2 meses; "+
    "novembro parcial fora da média. Saldo físico preservado da posição ERP 05/11/2026, sem subtração adicional.</div>';summary.prepend(box);");
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
  const noBaixas=read('public/stock-no-withdrawals-tab-20261015.js')
    .replace('window.MOVEMENTS_REVISED_META?.records === 19387','window.MOVEMENTS_REVISED_META?.records === '+totalCount)
    .replaceAll('14/03/2024 a 03/11/2026','14/03/2024 a 06/11/2026')
    .replace("historyEnd:'03/11/2026'","historyEnd:'06/11/2026'");
  assert(noBaixas!==read('public/stock-no-withdrawals-tab-20261015.js'));
  write('stock-no-withdrawals-tab-20261015.js',noBaixas);
  const audit={sourceSHA256:source.sourceSHA256,dateBasis:'Dt.Neg.',monthsReclassified:950,
    receivedRecords:source.records,
    revisedRecords:totalCount,totalValue:money(totalCents),
    annual:P.meta.years,october:P.meta.months['2026-10'],november:P.meta.months['2026-11'],
    monthlyPositions:P.rows.length,physicalStockUnchanged:true};
  fs.writeFileSync(path.join(root,'build-baixas-audit.json'),JSON.stringify(audit,null,2)+'\n');
  return audit;
}