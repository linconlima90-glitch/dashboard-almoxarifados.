// Base oficial de compras auditadas: 03/11/2026, 2873 lancamentos, 2025-2026.
(function(){
const P=window.DB_AUDITED_PURCHASE_DELTA;
if(!P || !P.meta || !Array.isArray(P.R) || !Array.isArray(P.U) || !Array.isArray(P.D))
  throw Error('Relatorio de compras auditado indisponivel; nao publicar dados anteriores como atualizados');
const m=P.meta, L=P.L;
const dk=s=>{const p=String(s||'').split('/');return p.length===3?Number(p[2])*10000+Number(p[1])*100+Number(p[0]):0};
const originalBase=PURCHASES.filter(x=>dk(x.data)<20260801);
if(originalBase.length!==m.oldbase || m.count!==2873 || m.recent!==564 || m.older!==2309)
  throw Error('Fotografia anterior de compras diverge da base auditada');
const revised=originalBase.map(x=>({...x}));
for(const [index,fields] of P.U){
  if(!revised[index] || !fields || !Number.isInteger(index))
    throw Error('Atualizacao de compra auditada com indice invalido');
  Object.assign(revised[index],fields);
}
for(const index of P.D.slice().sort((a,b)=>b-a)){
  if(!revised[index])throw Error('Exclusao de compra auditada com indice invalido');
  revised.splice(index,1);
}
const fields=['status','nrounico','nota','data','fornecedor_codigo','fornecedor','empresa_compra','empresa_local','codigo','grupo','produto','un','local','qtd','preco','valor','observacao','seq','codigo_local'];
const inserted=P.R.map(r=>Object.fromEntries(fields.map((k,i)=>[k,Object.prototype.hasOwnProperty.call(L,k)?L[k][r[i]]:r[i]])));
const NEW_PURCHASES=revised.concat(inserted);
const costTotal=NEW_PURCHASES.reduce((a,x)=>a+(Number(x.valor)||0),0);
const oldCount=NEW_PURCHASES.filter(x=>dk(x.data)<20260801).length;
const uniqueAuditKeys=new Set(NEW_PURCHASES.filter(x=>dk(x.data)>=20260801).map(x=>[x.nrounico,x.seq,x.codigo,x.codigo_local].join('|')));
if(NEW_PURCHASES.length!==2873 || oldCount!==2309 || uniqueAuditKeys.size!==564 ||
   Math.abs(costTotal-1814454.14)>.02 || NEW_PURCHASES.some(x=>dk(x.data)<20250101||dk(x.data)>20261029))
  throw Error('Base de compras auditada nao passou nas validacoes de quantidade, periodo e valor');

const X=window.DB_PURCHASES_20261110_DELTA;
if(!X||X.meta?.sourceSHA256!=='9ed21525bbab94802abd56ddf8260c9706f5b15f4a7295d20577b66b8db75405'||
  X.added?.length!==49||X.reprice?.length!==2||X.economy?.length!==28)throw Error('Remessa de compras 10/11 nao validada');
const rowKey=x=>[Number(x.nrounico),Number(x.seq),Number(x.codigo),Number(x.codigo_local)].join('|');
const rawKey=r=>[r[1],r[2],r[3],r[4]].join('|');
const byKey=new Map();
for(const x of NEW_PURCHASES){const k=rowKey(x);if(byKey.has(k))throw Error('Duplicidade preexistente em compras '+k);byKey.set(k,x)}
const moneyCents=arr=>arr.reduce((s,x)=>s+Math.round(Number(x.valor||0)*100),0);
if(NEW_PURCHASES.length!==2873||moneyCents(NEW_PURCHASES)!==181445414)throw Error('Historico anterior a 10/11 alterado');
for(const r of X.reprice){
 const x=byKey.get(rawKey(r));
 if(!x)throw Error('Retificacao sem nota original '+rawKey(r));
 x.preco=r[14]/1000000;x.valor=r[15]/100;
}
for(const r of X.added){
 const k=rawKey(r);if(byKey.has(k))throw Error('Compra ja existente '+k);
 const x={status:r[16],nrounico:r[1],nota:r[17],data:r[0],fornecedor_codigo:r[5],fornecedor:r[6],
  empresa_compra:r[7],empresa_local:r[8],codigo:r[3],grupo:r[10],produto:r[11],un:r[12],
  local:r[9],qtd:r[13],preco:r[14]/1000000,valor:r[15]/100,observacao:r[18],seq:r[2],codigo_local:r[4]};
 byKey.set(k,x);NEW_PURCHASES.push(x);
}
if(NEW_PURCHASES.length!==2922||moneyCents(NEW_PURCHASES)!==185352351)
 throw Error('Conferencia de 2922 compras e total nao fechou');
const newMeta={...m,source:'COMPRAS_DE_INSUMOS_POR_LOCAL(5).xlsx',sourceRows:2922,count:2922,older:2309,
 recent:613,fim:'05/11/2026',sourceSHA256:X.meta.sourceSHA256,incremental:X.meta,audited:true};
window.DB_PURCHASES_20261110_AUDIT={...X.meta,ready:true};

PURCHASES.splice(0,PURCHASES.length,...NEW_PURCHASES);
PURCHASES.sort((a,b)=>dk(b.data)-dk(a.data)||Number(b.nrounico||0)-Number(a.nrounico||0));
// Registros de produtos que passaram a existir no novo historico, mas nao estavam
// na tabela de produtos anterior, devem participar dos comparativos.
const known=new Set(PRODUCTS.map(x=>String(x.codigo)+'|'+String(x.un||'')));
for(const x of PURCHASES){
  const key=String(x.codigo)+'|'+String(x.un||'');
  if(known.has(key))continue;
  known.add(key);
  PRODUCTS.push({codigo:x.codigo,produto:x.produto,grupo:x.grupo,un:x.un,estoque:0,
    valor_estoque:0,custo_medio_estoque:0,locais:0});
}
window.DB_AUDITED_PURCHASE_READY=true;
window.DB_AUDITED_PURCHASE_META=newMeta;
const hist=new Map();for(const x of PURCHASES){const k=String(x.codigo)+'|'+String(x.un||'');let h=hist.get(k);if(!h){h={rows:[],pos:[],sup:new Set(),q:0,v:0};hist.set(k,h)}h.rows.push(x);h.sup.add(x.fornecedor);h.q+=Number(x.qtd)||0;h.v+=Number(x.valor)||0;if(Number(x.preco)>0)h.pos.push(x)}
function stats(code,un){const h=hist.get(String(code)+'|'+String(un||''));if(!h)return null;let mn=null,mx=null,lt=null;for(const x of h.pos){if(!mn||x.preco<mn.preco||(x.preco===mn.preco&&dk(x.data)>dk(mn.data)))mn=x;if(!mx||x.preco>mx.preco||(x.preco===mx.preco&&dk(x.data)>dk(mx.data)))mx=x;if(!lt||dk(x.data)>=dk(lt.data))lt=x}const variation=mn&&mx&&mn.preco>0?(mx.preco-mn.preco)/mn.preco:null;let status='SEM HISTÓRICO DE COMPRA';if(h.rows.length===1)status='UMA COMPRA';else if(variation!=null)status=variation>.5?'VARIAÇÃO >50%':variation>.2?'VARIAÇÃO >20%':'HISTÓRICO ESTÁVEL';return{mn,mx,lt,variation,status,valor:h.v,qtd:h.q,avg:h.q?h.v/h.q:0,fornecedores:h.sup.size,registros:h.rows.length,lista:[...h.sup].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'))}}
function apply(x,isProduct){
  const h=stats(x.codigo,x.un);
  if(!h){
    x.min_preco=0;x.forn_min='';x.data_min='';x.max_preco=0;x.forn_max='';
    x.data_max='';x.ultimo_preco=0;x.ultimo_forn='';x.data_ultimo='';
    x.preco_medio=0;x.fornecedores=0;x.registros=0;x.variacao=null;x.fornecedores_lista=[];
    if(isProduct){x.valor_comprado=0;x.qtd_comprada=0;x.nota_min=null;
      x.nota_max=null;x.nota_ultimo=null;x.status='SEM HISTÓRICO DE COMPRA'}
    else{x.status_preco='SEM HISTÓRICO DE COMPRA';x.dif_estoque_min=0}
    return;
  }
  const mn=h.mn,mx=h.mx,lt=h.lt;
  x.min_preco=mn?.preco||0;x.forn_min=mn?.fornecedor||'';x.data_min=mn?.data||'';
  x.max_preco=mx?.preco||0;x.forn_max=mx?.fornecedor||'';x.data_max=mx?.data||'';
  x.ultimo_preco=lt?.preco||0;x.ultimo_forn=lt?.fornecedor||'';x.data_ultimo=lt?.data||'';
  x.preco_medio=h.avg;x.fornecedores=h.fornecedores;x.registros=h.registros;
  x.variacao=h.variation;x.fornecedores_lista=h.lista;
  if(isProduct){x.valor_comprado=h.valor;x.qtd_comprada=h.qtd;
    x.nota_min=mn?.nota??null;x.nota_max=mx?.nota??null;x.nota_ultimo=lt?.nota??null;x.status=h.status}
  else{x.status_preco=h.status;
    x.dif_estoque_min=x.min_preco>0?((Number(x.custo_estoque)||0)-x.min_preco)*(Number(x.estoque)||0):0}
}
for(const x of STOCK)apply(x,false);for(const x of PRODUCTS)apply(x,true);
for(const mes of [...new Set(PURCHASES.map(x=>String(x.data||'').slice(3)))]){const a=PURCHASES.filter(x=>String(x.data||'').slice(3)===mes);let m=MONTHLY.find(x=>x.mes===mes);if(!m){m={mes,valor:0,linhas:0,fornecedores:0,produtos:0};MONTHLY.push(m)}m.valor=a.reduce((s,x)=>s+(Number(x.valor)||0),0);m.linhas=a.length;m.fornecedores=new Set(a.map(x=>x.fornecedor).filter(Boolean)).size;m.produtos=new Set(a.map(x=>String(x.codigo)+'|'+String(x.un||''))).size}MONTHLY.sort((a,b)=>{const [am,ay]=a.mes.split('/').map(Number),[bm,by]=b.mes.split('/').map(Number);return ay-by||am-bm})
const total=PURCHASES.reduce((s,x)=>s+(Number(x.valor)||0),0),analysisPurchases=PURCHASES.filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)),bench=new Map();for(const x of analysisPurchases){if(!(Number(x.preco)>0))continue;const k=String(x.codigo)+'|'+String(x.un||''),b=bench.get(k);if(!b||x.preco<b.preco)bench.set(k,x)}let savings=0,atBest=0,eligible=0,above=0;const saveSup=new Map();for(const x of analysisPurchases){if(!(Number(x.preco)>0&&Number(x.qtd)>0))continue;const b=bench.get(String(x.codigo)+'|'+String(x.un||''));if(!b)continue;eligible++;const d=x.preco-b.preco;if(Math.abs(d)<.005)atBest++;else if(d>.005){above++;const v=d*x.qtd;savings+=v;saveSup.set(x.fornecedor,(saveSup.get(x.fornecedor)||0)+v)}}
const lm=new Map();for(const x of PURCHASES){let a=lm.get(x.local);if(!a){a={v:0,n:0,p:new Set(),f:new Set(),u:''};lm.set(x.local,a)}a.v+=Number(x.valor)||0;a.n++;a.p.add(x.codigo);a.f.add(x.fornecedor);if(!a.u||dk(x.data)>dk(a.u))a.u=x.data}for(const l of LOCATIONS){const a=lm.get(l.local);l.valor_comprado=a?.v||0;l.linhas=a?.n||0;l.produtos_comprados=a?.p.size||0;l.fornecedores=a?.f.size||0;l.ultima=a?.u||''}
const sm=new Map();for(const x of PURCHASES){let a=sm.get(x.fornecedor);if(!a){a={codigo:String(x.fornecedor_codigo||''),fornecedor:x.fornecedor,linhas:0,notas:new Set(),produtos:new Set(),locais:new Set(),empresas:new Set(),qtd:0,valor:0,primeira:x.data,ultima:x.data,lanc_receb:0,nao_lanc_receb:0};sm.set(x.fornecedor,a)}a.linhas++;a.notas.add(x.nrounico);a.produtos.add(x.codigo);a.locais.add(x.local);a.empresas.add(x.empresa_compra);a.qtd+=Number(x.qtd)||0;a.valor+=Number(x.valor)||0;if(dk(x.data)<dk(a.primeira))a.primeira=x.data;if(dk(x.data)>dk(a.ultima))a.ultima=x.data;if(x.status==='LANC.RECEB.')a.lanc_receb++;else a.nao_lanc_receb++}SUPPLIERS.splice(0,SUPPLIERS.length,...[...sm.values()].map(a=>({...a,notas:a.notas.size,produtos:a.produtos.size,locais:a.locais.size,empresas:a.empresas.size,ticket:a.linhas?a.valor/a.linhas:0,participacao:total?a.valor/total:0})).sort((a,b)=>b.valor-a.valor));
for(const el of document.querySelectorAll('header p'))el.innerHTML=el.innerHTML.replace(/histórico de compras:\s*02\/01\/2025\s*a\s*\d{2}\/\d{2}\/\d{4}/,'histórico de compras: 02/01/2025 a '+newMeta.fim);try{render()}catch(e){console.error(e)}
const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0),pf=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(v||0);for(const el of document.querySelectorAll('.exec-kpi')){const k=el.querySelector('.k')?.textContent.trim(),v=el.querySelector('.v');if(k==='Valor comprado histórico')v.textContent=br(total);if(k==='Economia potencial em compras')v.textContent=br(savings);if(k==='Linhas compradas no menor preço')v.textContent=eligible?pf(atBest/eligible):'—'}

// Os filtros iniciais sao criados antes do carregamento dos complementos de compras.
function extendSelect(id,values){const el=document.getElementById(id);if(!el)return;const present=new Set(Array.from(el.options).map(o=>o.value));for(const v of [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'))){if(!present.has(v)){el.add(new Option(v,v));present.add(v)}}}
extendSelect('fEmpresa',PURCHASES.flatMap(x=>[x.empresa_compra,x.empresa_local]));
extendSelect('fLocal',PURCHASES.map(x=>x.local));
extendSelect('fGrupo',PURCHASES.map(x=>x.grupo));
extendSelect('fUn',PURCHASES.map(x=>x.un));
extendSelect('fFornecedor',SUPPLIERS.map(x=>x.fornecedor));
window.LATEST_PURCHASE_META={...newMeta,rowsSinceAugust:newMeta.recent};
window.dispatchEvent(new CustomEvent('purchases-updated',{detail:window.LATEST_PURCHASE_META}));
})();