// Economia na aquisicao direta de pecas para o CDI - desde 07/05/2026.
// Reconhecer diferenca de preco na COMPRA, uma vez. Distribuicao e consumo apenas
// atribuem a vantagem a destinos; nao somar novamente ao mesmo ganho.
// Fonte: 256 compras CDI TOP89, historico auditado de compras ERP 2025/2026.
// O benchmark de outras fazendas NAO significa cotacao de fornecedor da cidade.
(function(){
'use strict';
if(document.documentElement.dataset.dbPilot==='1'||document.getElementById('cdi-direct-buy-savings'))return;
const host=document.getElementById('cdi-distribution-purchases');
const packed=window.CDI_DISTRIBUTION_DETAIL_GZIP;
const history=typeof PURCHASES!=='undefined'&&Array.isArray(PURCHASES)?PURCHASES:null;
if(!host||!packed||!history)return;
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const int=new Intl.NumberFormat('pt-BR');
const quantityFormat=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4});
const priceFormat=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
const money=c=>currency.format((Number(c)||0)/100);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const asCode=s=>{const v=Number(s);return Number.isFinite(v)?String(Math.trunc(v)):String(s||'').trim()};
const iso=s=>{const t=String(s||'').slice(0,10);const m=t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:/^\d{8}$/.test(t)?t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8):t};
const epoch=s=>Date.parse(iso(s)+'T12:00:00Z');
const oneYear=365*86400000;
const spNotes=new Set(['2645784','2682919']); // ERP: UF emitente 35 nas duas NUNOTAs
const stateOfDoc=n=>spNotes.has(asCode(n))?'SP':'MG'; // 256 compras auditadas; validar na nova remessa
function splitPurchaseData(obj){
 if(obj.v!==1||!obj.d||!Array.isArray(obj.r))throw Error('Base de compras CDI incorreta');
 const d=obj.d;
 const rows=obj.r.map(r=>({
   date:iso(r[0]),note:asCode(r[2]),document:asCode(r[1]),seq:asCode(r[3]),
   code:asCode(r[4]),group:String(d.group[r[5]]||''),product:String(d.product[r[6]]||''),
   unit:String(d.unit[r[7]]||'').toUpperCase(),supplier:String(d.supplier[r[8]]||''),
   qty:Number(r[9]),unitPriceCents10000:Number(r[10]),valueCents:Number(r[11]),
   receipt:String(d.status[r[12]]||''),issuerUF:stateOfDoc(r[1])
 }));
 if(rows.length!==256||rows.reduce((sum,r)=>sum+r.valueCents,0)!==15019467||
    rows.some(r=>r.date<'2026-05-07'||!r.code||!r.unit||r.qty<=0||r.valueCents<=0)||
    rows.filter(r=>r.issuerUF==='SP').length!==60||
    rows.filter(r=>r.issuerUF==='SP').reduce((s,r)=>s+r.valueCents,0)!==1171044||
    new Set(rows.map(r=>r.document+'|'+r.seq+'|'+r.code+'|'+r.unit)).size!==256)
   throw Error('Compras CDI divergentes da conferencia ERP de 09/11');
 return rows;
}
function purchaseHistoryIndex(){
 const bySku=new Map(),ids=new Set();
 for(const p of history){
   const date=iso(p.data),local=asCode(p.codigo_local),code=asCode(p.codigo),unit=String(p.un||'').trim().toUpperCase();
   const count=Number(p.qtd),amount=Number(p.valor),document=asCode(p.nrounico),seq=asCode(p.seq);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!code||!unit||!document||!(count>0)||!(amount>0))continue;
   const key=document+'|'+seq+'|'+code+'|'+local;
   if(ids.has(key))continue;ids.add(key);
   const row={date,day:epoch(date),local,code,unit,qty:count,totalCents:Math.round(amount*100),
     document,note:asCode(p.nota),seq,supplier:String(p.fornecedor||''),status:String(p.status||'')};
   const sku=code+'|'+unit,part=bySku.get(sku)||[];
   part.push(row);bySku.set(sku,part);
 }
 for(const values of bySku.values())values.sort((a,b)=>b.day-a.day||Number(b.document)-Number(a.document));
 return bySku;
}
function enrich(rows,index){
 for(const row of rows){
   const now=epoch(row.date);
   const candidates=(index.get(row.code+'|'+row.unit)||[]).filter(h=>h.local!=='30115'&&h.day<now&&now-h.day<=oneYear);
   const latest=candidates[0]||null;
   const min=candidates.length?candidates.reduce((best,x)=>x.totalCents/x.qty<best.totalCents/best.qty?x:best):null;
   const max=candidates.length?candidates.reduce((best,x)=>x.totalCents/x.qty>best.totalCents/best.qty?x:best):null;
   row.latestRef=latest;row.minRef=min;row.maxRef=max;
   row.cdiPrice=row.valueCents/100/row.qty;
   row.diffCents=latest?Math.round(row.qty*latest.totalCents/latest.qty)-row.valueCents:null;
   row.minDiffCents=min?Math.round(row.qty*min.totalCents/min.qty)-row.valueCents:null;
   row.maxDiffCents=max?Math.round(row.qty*max.totalCents/max.qty)-row.valueCents:null;
   row.priceState=latest?row.diffCents>0?'FAVORAVEL':row.diffCents<0?'DESFAVORAVEL':'IGUAL':'SEM_REFERENCIA';
   row.volumeRatio=latest?row.qty/latest.qty:null;
   row.volumeAlert=latest&&(row.volumeRatio>3||row.volumeRatio<1/3);
   row.sourceQuality=latest?'REFERENCIA_HISTORICA_NAO_LOCAL':'PENDENTE_COTACAO';
 }
 return rows;
}
const css=document.createElement('style');css.id='cdi-direct-buy-style';css.textContent=[
'#cdi-direct-buy-savings{box-sizing:border-box;background:white;border:1px solid #dae8de;border-radius:15px;margin:18px 0 19px;padding:22px 24px;color:#1b4731;font-family:inherit}',
'#cdi-direct-buy-savings *{box-sizing:border-box}',
'#cdi-direct-buy-savings h2{margin:0 0 5px;color:#174a2f;letter-spacing:-.025em;font-size:20px;font-weight:850}',
'#cdi-direct-buy-savings h3{margin:0 0 10px;font-size:13px;color:#245537}',
'#cdi-direct-buy-savings p{margin:0;line-height:1.6;font-size:11px;color:#5f7867}',
'#cdi-direct-buy-savings .dbs-label{font-size:10px;font-weight:850;letter-spacing:.06em;color:#528566;margin:0 0 7px}',
'#cdi-direct-buy-savings .dbs-header{display:flex;align-items:start;justify-content:space-between;gap:18px;margin-bottom:16px}',
'#cdi-direct-buy-savings .dbs-badge{font-size:10px;font-weight:850;color:#9a6d17;background:#fff5db;border:1px solid #eadbb8;padding:6px 9px;border-radius:6px;white-space:nowrap}',
'#cdi-direct-buy-savings .dbs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}',
'#cdi-direct-buy-savings .dbs-stat{background:#f7faf7;border:1px solid #e0ebe2;border-radius:10px;padding:14px 15px;min-width:0}',
'#cdi-direct-buy-savings .dbs-stat small{display:block;font-size:10px;color:#5d7967;line-height:1.5;min-height:30px}',
'#cdi-direct-buy-savings .dbs-stat strong{display:block;font-size:20px;letter-spacing:-.025em;color:#165b36;white-space:nowrap;font-variant-numeric:tabular-nums;margin:6px 0 3px}',
'#cdi-direct-buy-savings .dbs-stat span{font-size:10px;color:#728577;line-height:1.5}',
'#cdi-direct-buy-savings .dbs-rules{display:grid;grid-template-columns:1.2fr 1fr;gap:11px;margin:12px 0 15px}',
'#cdi-direct-buy-savings .dbs-box{border-radius:9px;border:1px solid #e3eae3;padding:14px 15px;background:#fff}',
'#cdi-direct-buy-savings .dbs-box b{font-size:12px;color:#2d573c}',
'#cdi-direct-buy-savings .dbs-box p{margin-top:6px}',
'#cdi-direct-buy-savings .dbs-breakout{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:11px}',
'#cdi-direct-buy-savings .dbs-breakout>span{background:#edf6ef;padding:7px 10px;border-radius:8px;font-size:11px;font-weight:800;color:#185d35}',
'#cdi-direct-buy-savings .dbs-alert{border-left:3px solid #bd9a3a;background:#fffaf0;padding:12px 14px;border-radius:4px;margin:13px 0;font-size:11px;color:#776331;line-height:1.6}',
'#cdi-direct-buy-savings .dbs-alert strong{color:#765316}',
'#cdi-direct-buy-savings details{border:1px solid #d9e7df;border-radius:10px;margin-top:12px;overflow:hidden}',
'#cdi-direct-buy-savings details>summary{list-style:none;cursor:pointer;background:#f2f8f4;font-size:12px;font-weight:850;padding:15px 16px;color:#215a3a}',
'#cdi-direct-buy-savings details>summary::-webkit-details-marker{display:none}',
'#cdi-direct-buy-savings .dbs-body{padding:15px}',
'#cdi-direct-buy-savings .dbs-filters{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr)) minmax(180px,1.5fr) auto;gap:8px;align-items:end}',
'#cdi-direct-buy-savings .dbs-filters label{font-size:10px;font-weight:800;color:#54715d}',
'#cdi-direct-buy-savings input,#cdi-direct-buy-savings select{width:100%;height:36px;border:1px solid #d0dfd6;border-radius:7px;padding:6px 8px;display:block;margin-top:5px;font-size:11px;min-width:0}',
'#cdi-direct-buy-savings button{border:1px solid #a5c7b0;background:#eff8f1;color:#1c663b;padding:8px 12px;border-radius:7px;min-height:36px;cursor:pointer;font-size:11px;font-weight:850}',
'#cdi-direct-buy-savings .dbs-totals{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;border:1px solid #e5eee8;background:#f8fbf9;border-radius:8px;font-size:11px;margin:12px 0}',
'#cdi-direct-buy-savings .dbs-totals strong{color:#245d39}',
'#cdi-direct-buy-savings .dbs-scroll{overflow:auto;max-height:480px;border-radius:8px;border:1px solid #dfe8e2}',
'#cdi-direct-buy-savings table{border-collapse:collapse;width:100%;min-width:1520px;font-size:10px}',
'#cdi-direct-buy-savings th{position:sticky;top:0;background:#eaf5ed;color:#315f42;font-size:10px;text-align:left;padding:10px;white-space:nowrap;z-index:1}',
'#cdi-direct-buy-savings td{padding:9px 10px;border-bottom:1px solid #e7eee8;color:#486254;vertical-align:top}',
'#cdi-direct-buy-savings .dbs-amount{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:800}',
'#cdi-direct-buy-savings .dbs-positive{color:#14743c}',
'#cdi-direct-buy-savings .dbs-negative{color:#bc4b3e}',
'#cdi-direct-buy-savings .dbs-foot{font-size:10px!important;margin-top:12px!important;color:#748777!important}',
'@media(max-width:1000px){#cdi-direct-buy-savings .dbs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#cdi-direct-buy-savings .dbs-rules{grid-template-columns:1fr}#cdi-direct-buy-savings .dbs-filters{grid-template-columns:repeat(2,minmax(130px,1fr))}}',
'@media(max-width:590px){#cdi-direct-buy-savings{padding:17px 14px}#cdi-direct-buy-savings .dbs-header{flex-direction:column}#cdi-direct-buy-savings .dbs-grid{grid-template-columns:1fr 1fr}#cdi-direct-buy-savings .dbs-stat strong{font-size:16px}#cdi-direct-buy-savings .dbs-filters{grid-template-columns:1fr}}'
].join('');
document.head.appendChild(css);
const section=document.createElement('section');
section.id='cdi-direct-buy-savings';
section.setAttribute('aria-label','Economia em compras diretas do CDI');
section.innerHTML='<h2>Compras diretas do CDI</h2><p>Conferindo os preços de aquisição e as notas do ERP...</p>';
host.insertAdjacentElement('afterend',section);

function render(rows){
 const eligible=rows.filter(r=>r.latestRef);
 const favorable=eligible.reduce((s,r)=>s+Math.max(0,r.diffCents||0),0);
 const unfavorable=eligible.reduce((s,r)=>s+Math.min(0,r.diffCents||0),0);
 const net=favorable+unfavorable,sp=rows.filter(r=>r.issuerUF==='SP');
 const notReceived=rows.filter(r=>r.receipt.includes('NÃO')).length;
 const stat=(label,value,foot)=>'<div class="dbs-stat"><small>'+escape(label)+'</small><strong>'+escape(value)+'</strong><span>'+escape(foot)+'</span></div>';
 section.innerHTML=[
 '<header class="dbs-header"><div><div class="dbs-label">PROJETO CDI · COMPRAS PARA ESTOQUE 30115 · DESDE 07/05/2026</div>',
 '<h2>Economia na compra direta de materiais</h2><p>O ganho de preço começa na <b>compra para o CDI</b>, inclusive quando o item é utilizado na Fazenda Chuá ou continua em estoque.</p></div>',
 '<div class="dbs-badge">REFERÊNCIA HISTÓRICA · NÃO HOMOLOGADA</div></header>',
 '<div class="dbs-grid">',
 stat('Valor comprado para o CDI',money(15019467),'256 lançamentos de compra TOP 89'),
 stat('Diferença bruta de preço · histórico da rede',money(net),eligible.length+' de 256 compras comparáveis'),
 stat('Compras de fornecedores com NF-e SP',money(sp.reduce((s,r)=>s+r.valueCents,0)),sp.length+' linhas · emitente UF 35'),
 stat('Economia local comprovada','Em apuração','Pendente de cotação e custos adicionais'),
 '</div>',
 '<div class="dbs-rules">',
 '<div class="dbs-box"><b>Como calculamos a vantagem de compra</b><p>Para o mesmo produto e unidade, comparamos o preço real pago para o 30115 com o <b>último preço pago por outra fazenda</b> nos 365 dias anteriores. A diferença é multiplicada pela quantidade comprada. O menor e o maior preço aparecem para análise, não são somados como ganhos.</p>',
 '<div class="dbs-breakout"><span>Favoráveis: '+money(favorable)+'</span><span>Desfavoráveis: '+money(unfavorable)+'</span></div></div>',
 '<div class="dbs-box"><b>Compra direta de São Paulo x Minas Gerais</b><p>Identificamos '+sp.length+' itens em notas emitidas em SP, no total de '+money(1171044)+'. Em 36 linhas há nota anterior comparável emitida em MG: <b>'+money(262484)+' de diferença líquida favorável</b>. É um subconjunto, com referência específica de UF; <b>não somar</b> ao indicador histórico acima.</p></div>',
 '</div>',
 '<div class="dbs-alert"><strong>O que falta para chamar de economia da cidade:</strong> identificar quais fornecedores são locais e vincular cotação ou compra alternativa da mesma região, mesmo produto, mesma qualidade e quantidade comparável. UF da nota fiscal não identifica o município. <b>'+int.format(notReceived)+' das 256 linhas estão sem lançamento de recebimento</b> no relatório fornecido. Valores pendentes não entram na economia financeira homologada.</div>',
 '<details><summary>Conferir todas as compras, preços maiores/menores e notas de referência</summary>',
 '<div class="dbs-body"><div class="dbs-filters">',
 '<label>Fornecedor<select id="dbs-supplier"><option value="">Todos os fornecedores</option></select></label>',
 '<label>UF do emitente<select id="dbs-uf"><option value="">Todos</option><option value="SP">SP</option><option value="MG">MG</option></select></label>',
 '<label>Comparação<select id="dbs-status"><option value="">Todas</option><option value="FAVORAVEL">Compra menor</option><option value="DESFAVORAVEL">Compra maior</option><option value="IGUAL">Mesmo preço</option><option value="SEM_REFERENCIA">Sem histórico</option></select></label>',
 '<label>Buscar<input type="search" id="dbs-query" placeholder="Código, produto ou NF..."></label>',
 '<button type="button" id="dbs-reset">Limpar</button></div>',
 '<div class="dbs-totals"><div><strong id="dbs-count">—</strong> registros · Compra <strong id="dbs-value">—</strong> · Diferença líquida <strong id="dbs-diff">—</strong></div><button type="button" id="dbs-export">Exportar CSV</button></div>',
 '<div class="dbs-scroll"><table><thead><tr>',
 ['Data','NF compra CDI','Código / produto','Fornecedor CDI','UF NF-e','Quantidade','Preço CDI','Última compra outra fazenda','Preço anterior','Menor preço hist.','Maior preço hist.','Diferença total','Recebimento'].map(s=>'<th>'+escape(s)+'</th>').join(''),
 '</tr></thead><tbody id="dbs-rows"></tbody></table></div>',
 '<p class="dbs-foot">O histórico pode conter compras com volumes e condições diferentes. Informações de preços vêm de notas ERP: valor total ÷ quantidade, antes da compra CDI. Diferencial não inclui comparação homologada com fornecedores da cidade.</p></div></details>',
 '<p class="dbs-foot"><b>Sem dupla contagem:</b> a economia de negociação é reconhecida na aquisição; transferir o produto ou consumi-lo depois apenas atribui esse benefício ao destino. A análise de reaproveitamento de estoque parado permanece separada.</p>'
 ].join('');
 const $=id=>section.querySelector('#'+id);
 const suppliers=[...new Set(rows.map(r=>r.supplier))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 for(const name of suppliers){const option=document.createElement('option');option.value=name;option.textContent=name;$('dbs-supplier').appendChild(option)}
 const sup=$('dbs-supplier'),uf=$('dbs-uf'),status=$('dbs-status'),query=$('dbs-query');
 let visible=[];
 const dateBR=s=>String(s||'').split('-').reverse().join('/');
 const refPrice=ref=>ref?priceFormat.format(ref.totalCents/100/ref.qty):'—';
 const cell=(s,cls)=>'<td'+(cls?' class="'+cls+'"':'')+'>'+escape(s)+'</td>';
 function redraw(){
  const q=norm(query.value);
  visible=rows.filter(r=>(!sup.value||r.supplier===sup.value)&&(!uf.value||r.issuerUF===uf.value)&&(!status.value||r.priceState===status.value)&&
    (!q||norm([r.code,r.product,r.note,r.document,r.supplier,r.group,r.latestRef?.supplier].join(' ')).includes(q)))
   .sort((a,b)=>(b.diffCents??-Infinity)-(a.diffCents??-Infinity)||b.valueCents-a.valueCents);
  $('dbs-count').textContent=int.format(visible.length);
  $('dbs-value').textContent=money(visible.reduce((s,r)=>s+r.valueCents,0));
  $('dbs-diff').textContent=money(visible.reduce((s,r)=>s+(r.diffCents||0),0));
  $('dbs-export').disabled=!visible.length;
  $('dbs-rows').innerHTML=visible.length?visible.map(r=>'<tr>'+
    cell(dateBR(r.date))+cell('NF '+r.note+' · '+r.document+'/'+r.seq)+
    '<td><b>'+escape(r.code)+'</b><div>'+escape(r.product)+'</div></td>'+
    cell(r.supplier)+cell(r.issuerUF)+cell(quantityFormat.format(r.qty),'dbs-amount')+
    cell(priceFormat.format(r.cdiPrice),'dbs-amount')+
    cell(r.latestRef?dateBR(r.latestRef.date)+' · NF '+r.latestRef.note+' / local '+r.latestRef.local+' / '+r.latestRef.supplier:'Sem compra anterior')+
    cell(refPrice(r.latestRef),'dbs-amount')+cell(refPrice(r.minRef),'dbs-amount')+cell(refPrice(r.maxRef),'dbs-amount')+
    cell(r.diffCents==null?'—':money(r.diffCents),'dbs-amount '+(r.diffCents<0?'dbs-negative':'dbs-positive'))+
    cell(r.receipt)+'</tr>').join(''):'<tr><td colspan="13" style="padding:19px">Nenhuma compra com esses filtros.</td></tr>';
 }
 [sup,uf,status].forEach(el=>el.addEventListener('change',redraw));
 query.addEventListener('input',redraw);
 $('dbs-reset').addEventListener('click',()=>{sup.value='';uf.value='';status.value='';query.value='';redraw()});
 $('dbs-export').addEventListener('click',()=>{
  const fields=['Data','NF CDI','NUNOTA CDI','Sequencia','Codigo produto','Descricao','Grupo','UN','Qtd','Valor CDI centavos','Fornecedor CDI','UF emitente','Recebimento','Data referencia','Local referencia','Fornecedor referencia','NUNOTA referencia','Preco unitario referencia','Menor historico','Maior historico','Diferenca centavos','Aviso volume'];
  const line=r=>[r.date,r.note,r.document,r.seq,r.code,r.product,r.group,r.unit,r.qty,r.valueCents,r.supplier,r.issuerUF,r.receipt,r.latestRef?.date||'',r.latestRef?.local||'',r.latestRef?.supplier||'',r.latestRef?.document||'',r.latestRef?r.latestRef.totalCents/100/r.latestRef.qty:'',r.minRef?r.minRef.totalCents/100/r.minRef.qty:'',r.maxRef?r.maxRef.totalCents/100/r.maxRef.qty:'',r.diffCents??'',r.volumeAlert?'Comparar quantidades':''];
  const quote=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const csv='\uFEFF'+[fields,...visible.map(line)].map(row=>row.map(quote).join(';')).join('\r\n');
  const link=document.createElement('a');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  link.href=url;link.download='economia_compras_diretas_30115_historico.csv';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),600);
 });
 redraw();
 window.DB_CDI_DIRECT_BUY_SAVINGS={status:'INDICATIVO',summary:{purchases:256,totalCents:15019467,
   references:eligible.length,favorableCents:favorable,unfavorableCents:unfavorable,
   netHistoricCents:net,spPurchases:sp.length,spPurchaseCents:1171044,
   spMGComparable:36,spMGIndicativeCents:262484,receiptPending:notReceived,
   validatedCents:null,addToDistributionSavings:false},
   getRows:()=>rows.slice(),getVisibleRows:()=>visible.slice(),refresh:redraw};
}
async function boot(){
 try{
   if(!window.DB_AUDITED_PURCHASE_READY)throw Error('Histórico de compras ERP auditado indisponível');
   const bytes=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));
   const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
   const rows=enrich(splitPurchaseData(JSON.parse(raw)),purchaseHistoryIndex());
   render(rows);
 }catch(e){
   console.error('[CDI] erro ao apurar compras diretas',e);
   section.innerHTML='<h2>Compras diretas CDI · auditoria pendente</h2><p>Não foi possível conciliar as compras com os preços históricos: '+escape(e.message)+'. Nenhum benefício será apresentado sem os dados válidos.</p>';
 }
}
boot();
})();