// Apuracao do CDI: comparar notas da compra 30115 com distribuicoes e uso local.
// Dados conciliados sao compactados; economia financeira final nao homologada.
(function(){
'use strict';
if(document.documentElement.dataset.dbPilot==='1')return;
const host=document.getElementById('reallocation-reuse-panel')||document.getElementById('cdi-transfer-panel');
if(!host||document.getElementById('cdi-economy-audit-panel'))return;
const section=document.createElement('section');
section.id='cdi-economy-audit-panel';section.setAttribute('aria-labelledby','cea-title');
section.className='cea-bulk-dashboard';
section.innerHTML='<h2 id="cea-title">Apuração da compra centralizada (30115)</h2><p>Conferindo preços de compra, distribuição e consumo próprio da Chuá...</p>';
host.insertAdjacentElement('afterend',section);
const CSS=`
#cdi-economy-audit-panel{font-family:inherit;color:#214331;background:#fff;border:1px solid #d7e4da;border-radius:14px;padding:22px 24px;margin:16px 0 22px;box-shadow:0 3px 18px rgba(27,63,42,.04)}
#cdi-economy-audit-panel *{box-sizing:border-box}
#cdi-economy-audit-panel .cea-eyebrow{font-size:10px;font-weight:850;color:#3c7854;letter-spacing:.07em}
#cdi-economy-audit-panel h2{font-size:21px;letter-spacing:-.02em;margin:6px 0 7px;color:#173e2b}
#cdi-economy-audit-panel h3{font-size:14px;color:#20533a;margin:0 0 9px}
#cdi-economy-audit-panel p{font-size:11px;line-height:1.65;color:#6a7c6d;margin:0}
#cdi-economy-audit-panel .cea-head{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:18px}
#cdi-economy-audit-panel .cea-asof{font-size:10px;color:#728478;text-align:right;line-height:1.6;min-width:170px}
#cdi-economy-audit-panel .cea-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
#cdi-economy-audit-panel .cea-metric{border:1px solid #d8e5db;background:#f8fbf9;border-radius:10px;padding:14px 15px;min-width:0}
#cdi-economy-audit-panel .cea-metric .label{display:block;font-size:10px;color:#65806d;font-weight:700;line-height:1.4}
#cdi-economy-audit-panel .cea-metric strong{display:block;font-size:23px;letter-spacing:-.025em;color:#185f3d;margin:7px 0 5px;line-height:1.25;font-variant-numeric:tabular-nums}
#cdi-economy-audit-panel .cea-metric small{font-size:10px;color:#829086;line-height:1.45;display:block}
#cdi-economy-audit-panel .cea-label-row{display:flex;gap:15px;align-items:center;justify-content:space-between;margin:20px 0 9px}
#cdi-economy-audit-panel .cea-label-row span{font-size:10px;color:#7f9084}
#cdi-economy-audit-panel .cea-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#cdi-economy-audit-panel .cea-analysis{border:1px solid #dae7dd;border-radius:11px;padding:16px 18px 13px;background:#fff}
#cdi-economy-audit-panel .cea-analysis .summary{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:12px 0;border-bottom:1px solid #e4eee7;padding-bottom:10px}
#cdi-economy-audit-panel .cea-analysis .summary .name{font-size:11px;color:#637c6c;line-height:1.6;max-width:65%}
#cdi-economy-audit-panel .cea-analysis .summary b{font-size:19px;color:#194f35;white-space:nowrap;font-variant-numeric:tabular-nums}
#cdi-economy-audit-panel .cea-comparison{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;padding:7px 0}
#cdi-economy-audit-panel .cea-comparison span{color:#6b7f70}
#cdi-economy-audit-panel .cea-comparison strong{font-variant-numeric:tabular-nums;white-space:nowrap}
#cdi-economy-audit-panel .cea-comparison.emphasis{background:#f1f8f3;margin:9px -5px 8px;padding:10px 7px;border-radius:7px}
#cdi-economy-audit-panel .cea-analysis .foot{font-size:10px;color:#7b8b80;margin-top:11px;border-top:1px solid #e6eee8;padding-top:11px}
#cdi-economy-audit-panel .cea-subtle{background:#fcfaf4;border-left:3px solid #bda56b;font-size:11px;padding:13px 14px;color:#6c6240;line-height:1.65;margin-top:12px}
#cdi-economy-audit-panel .cea-subtle strong{color:#675b2e}
#cdi-economy-audit-panel .cea-coverage{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:13px 0}
#cdi-economy-audit-panel .cea-small{border-top:1px solid #e3ebe5;padding:12px 6px 0}
#cdi-economy-audit-panel .cea-small b{font-size:13px;color:#315b40;display:block;margin-bottom:4px}
#cdi-economy-audit-panel .cea-small span{font-size:10px;color:#708376;line-height:1.5;display:block}
#cdi-economy-audit-panel details{border:1px solid #d9e5dc;border-radius:9px;margin-top:16px;overflow:hidden}
#cdi-economy-audit-panel details>summary{list-style:none;padding:15px 16px;font-size:12px;background:#f3f8f4;font-weight:850;color:#2c6445;cursor:pointer}
#cdi-economy-audit-panel details>summary::-webkit-details-marker{display:none}
#cdi-economy-audit-panel .cea-detail{padding:14px}
#cdi-economy-audit-panel .cea-filters{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr)) minmax(180px,1.5fr) auto;gap:8px;align-items:end}
#cdi-economy-audit-panel .cea-filters label{font-size:10px;color:#5c7864;font-weight:700}
#cdi-economy-audit-panel .cea-filters select,#cdi-economy-audit-panel .cea-filters input{width:100%;border:1px solid #d0dfd4;border-radius:6px;height:35px;padding:7px;background:white;margin-top:5px;font-size:11px;color:#30543d}
#cdi-economy-audit-panel button{border:1px solid #bdd7c4;color:#225d3e;background:#f0f7f1;border-radius:7px;padding:9px 12px;min-height:35px;font-size:11px;font-weight:750;cursor:pointer}
#cdi-economy-audit-panel #cea-export{background:#23754b;border-color:#23754b;color:#fff}
#cdi-economy-audit-panel button:disabled{opacity:.5;cursor:default}
#cdi-economy-audit-panel .cea-table-summary{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#f8fbf8;border:1px solid #e4ece6;border-radius:7px;padding:10px;margin:12px 0;font-size:11px;color:#6b806f}
#cdi-economy-audit-panel .cea-table-summary b{color:#275a3a}
#cdi-economy-audit-panel .cea-table-summary #cea-export{margin-left:auto}
#cdi-economy-audit-panel .cea-tablewrap{max-height:460px;overflow:auto;border:1px solid #e1eae3;border-radius:7px}
#cdi-economy-audit-panel table{border-collapse:collapse;min-width:1450px;width:100%;font-size:10px}
#cdi-economy-audit-panel th{padding:10px;background:#e9f3ec;color:#335e43;text-align:left;position:sticky;top:0;z-index:1;white-space:nowrap}
#cdi-economy-audit-panel td{padding:9px;border-bottom:1px solid #e7eee9;vertical-align:top;line-height:1.5;color:#4f6657}
#cdi-economy-audit-panel .cea-num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
#cdi-economy-audit-panel .cea-nav{display:flex;gap:9px;align-items:center;justify-content:flex-end;margin-top:10px;font-size:10px;color:#738676}
#cdi-economy-audit-panel .cea-method{font-size:10px;color:#7b8b80;line-height:1.6;margin-top:12px}
@media(max-width:1100px){#cdi-economy-audit-panel .cea-metrics{grid-template-columns:repeat(2,1fr)}#cdi-economy-audit-panel .cea-two{grid-template-columns:1fr}#cdi-economy-audit-panel .cea-filters{grid-template-columns:repeat(2,minmax(130px,1fr))}}
@media(max-width:660px){#cdi-economy-audit-panel{padding:15px 13px}#cdi-economy-audit-panel .cea-head{display:block}#cdi-economy-audit-panel .cea-asof{text-align:left;margin-top:9px}#cdi-economy-audit-panel .cea-metrics{grid-template-columns:1fr}#cdi-economy-audit-panel .cea-coverage{grid-template-columns:1fr}#cdi-economy-audit-panel .cea-filters{grid-template-columns:1fr}#cdi-economy-audit-panel .cea-label-row{align-items:start;flex-direction:column}}
`;
const css=document.createElement('style');css.id='cea-bulk-style';css.textContent=CSS;document.head.appendChild(css);
const cash=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const numeric=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4});
const fmt=c=>cash.format((Number(c)||0)/100),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const price=n=>n==null?'—':cash.format(Number(n));
const displayDate=d=>d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'';
const types={DISTRIBUICAO:'Distribuição CDI',CONSUMO_CHUA:'Consumo Fazenda Chuá',CONSUMO_COMPARTILHADO:'Estrutura Compartilhada',CONSUMO_OUTROS:'Outros centros (fora do resultado)',PERDA_D410:'Perdas D410 (excluídas)'};
function pair(label,value,emphasis=false){return '<div class="cea-comparison'+(emphasis?' emphasis':'')+'"><span>'+escape(label)+'</span><strong>'+escape(value)+'</strong></div>'}
function card(label,value,desc){return '<div class="cea-metric"><span class="label">'+escape(label)+'</span><strong>'+escape(value)+'</strong><small>'+escape(desc)+'</small></div>'}
async function boot(){
 const encoded=window.DB_CDI_BULK_AUDIT_GZIP;
 if(!encoded||typeof DecompressionStream!=='function')throw Error('Dados compactados ou suporte a descompressão indisponíveis');
 const bytes=Uint8Array.from(atob(encoded),x=>x.charCodeAt(0));
 const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 const pack=JSON.parse(raw),labels=pack.columns;
 if(pack.v!==1||pack.rows.length!==850||pack.purchasesCdi.lines!==256||pack.purchasesCdi.totalCents!==15019467)throw Error('Base de apuração não passou na conferência');
 const list=pack.rows.map(a=>Object.fromEntries(labels.map((x,i)=>[x,a[i]])));
 const totals=pack.categories,D=totals.DISTRIBUICAO,C=totals.CONSUMO_CHUA,S=totals.CONSUMO_COMPARTILHADO,O=totals.CONSUMO_OUTROS,L=totals.PERDA_D410;
 if(D.events!==184||D.amountERPCents!==6277990||C.events!==181||C.matchedEvents!==97||C.matchedCostCDICents!==316154||D.destDiffLast!==1522||C.networkComparables!==76||L.events!==54)throw Error('Base inconsistente com documentos do ERP');
 if(list.reduce((n,r)=>n+(r.type==='CONSUMO_CHUA'),0)!==181||new Set(list.map(r=>r.id)).size!==850)throw Error('Movimentos duplicados ou ausentes');
 const stats='<div class="cea-metrics">'+
   card('Compras para estoque CDI · 30115',fmt(pack.purchasesCdi.totalCents),'256 linhas ERP · não equivale a economia')+
   card('Distribuição do CDI para fazendas',fmt(D.amountERPCents),'184 linhas · D410 excluído')+
   card('Consumo próprio na Fazenda Chuá',fmt(C.amountERPCents),'181 baixas locais · valor de saída ERP')+
 '</div>';
 section.innerHTML=[
  '<header class="cea-head"><div><div class="cea-eyebrow">PROJETO CDI DE PEÇAS / APURAÇÃO DE PREÇOS</div><h2 id="cea-title">Resultado das compras centralizadas e utilização na Chuá</h2><p>O ganho só é comparado na quantidade que encontramos em compras anteriores do CDI. Não duplicamos a mesma compra nas saídas para outras unidades e no consumo próprio.</p></div><div class="cea-asof">Aprovado em 07/05/2026<br>Dados ERP conferidos em 09/11/2026</div></header>',
  stats,
  '<div class="cea-label-row"><h3>Vantagem de preço nas utilizações</h3><span>Comparação com compras anteriores do mesmo produto e unidade</span></div>',
  '<div class="cea-two">',
   '<div class="cea-analysis"><h3>1. Distribuição para outras fazendas</h3>',
    '<div class="summary"><span class="name">Diferença versus último preço da fazenda de destino</span><b>'+fmt(D.destDiffLast)+'</b></div>',
    pair('Menor preço histórico do destino',fmt(D.destDiffMin)),
    pair('Maior preço histórico do destino',fmt(D.destDiffMax)),
    pair('Último preço histórico do destino',fmt(D.destDiffLast),true),
    pair('Diferenças favoráveis',fmt(D.destPos)),
    pair('Diferenças desfavoráveis',fmt(D.destNeg)),
    '<p class="foot">'+D.destComparables+' das '+D.events+' transferências têm quantidade atribuível a nota CDI e compra comparável da própria fazenda. Compra atribuída: '+fmt(D.matchedCostCDICents)+' em '+D.matchedEvents+' transferências com algum vínculo.</p>',
   '</div>',
   '<div class="cea-analysis"><h3>2. Uso na própria Fazenda Chuá</h3>',
    '<div class="summary"><span class="name">Valor de compras CDI vinculado ao consumo local</span><b>'+fmt(C.matchedCostCDICents)+'</b></div>',
    pair('Baixas locais com vínculo de compra CDI',C.matchedEvents+' de '+C.events),
    pair('Comparações com compras antigas da Chuá',C.destComparables+' registros'),
    pair('Diferença vs último preço antigo da Chuá',fmt(C.destDiffLast),true),
    pair('Cenário vs última compra de outras unidades',fmt(C.networkDiffLast)),
    pair('Operações com comparação de outras unidades',C.networkComparables+' registros'),
    '<p class="foot">O preço antigo da própria Chuá coincide com o CDI nas '+C.destComparables+' comparações disponíveis. O cenário de '+fmt(C.networkDiffLast)+' usa preços de outras fazendas: <b>não é economia comprovada</b>.</p>',
   '</div>',
  '</div>',
  '<div class="cea-subtle"><strong>Interpretação:</strong> os valores de compra e de saída não são ganhos por si só. O saldo histórico de preço depende da nota CDI atribuída à saída. Muitas compras estão marcadas como <strong>"não lançada no recebimento"</strong> e a ligação por FIFO é gerencial, sem rastreamento físico de lote. <strong>Nenhuma economia líquida foi homologada</strong> sem validar demanda evitada e logística.</div>',
  '<div class="cea-coverage">',
   '<div class="cea-small"><b>Estrutura Compartilhada: '+S.events+' baixas</b><span>Compras atribuídas a '+S.matchedEvents+' operações; requer confirmação de que o custo pertence à Chuá antes de computar benefício.</span></div>',
   '<div class="cea-small"><b>Outros centros: '+O.events+' baixas</b><span>Movimentações preservadas na auditoria, fora do ganho de consumo próprio.</span></div>',
   '<div class="cea-small"><b>Perdas D410: '+L.events+' saídas</b><span>'+fmt(L.amountERPCents)+' classificados como perda, sempre excluídos da economia.</span></div>',
  '</div>',
  '<details id="cea-details"><summary>Consultar produtos, quantidades, notas e preços máximos e mínimos</summary>',
   '<div class="cea-detail"><div class="cea-filters">',
   '<label>Tipo de movimentação<select id="cea-type"><option value="">Todas</option>'+Object.entries(types).map(([k,v])=>'<option value="'+k+'">'+escape(v)+'</option>').join('')+'</select></label>',
   '<label>Tipo de referência<select id="cea-ref"><option value="">Todas</option><option value="destino">Preço do destino / Chuá pré-projeto</option><option value="rede">Preço de outras unidades</option><option value="faltante">Sem comparação</option></select></label>',
   '<label>Fazenda ou centro de custo<select id="cea-dest"><option value="">Todos</option></select></label>',
   '<label>Pesquisar código, material ou nota<input type="search" id="cea-search" placeholder="Código, descrição, NUNOTA..."></label>',
   '<button id="cea-clear" type="button">Limpar</button></div>',
   '<div class="cea-table-summary"><b id="cea-count">0</b> lançamentos · Custo CDI vinculado <b id="cea-cost">—</b> · Variação destino <b id="cea-difference">—</b><button id="cea-export" type="button">Exportar CSV</button></div>',
   '<div class="cea-tablewrap"><table><thead><tr>',
   ['Data','Operação','Destino/centro','Código e produto','Doc. saída','Notas compras CDI','Qtd. saída','Qtd. ligada ao CDI','Custo CDI','Menor preço destino','Maior preço destino','Último destino','Dif. último','Último preço na rede','Status'].map(s=>'<th>'+escape(s)+'</th>').join(''),
   '</tr></thead><tbody id="cea-rows"></tbody></table></div>',
   '<div class="cea-nav"><button id="cea-prev" type="button">Anterior</button><span id="cea-pages">1 / 1</span><button id="cea-next" type="button">Próximo</button></div>',
   '<p class="cea-method">Preço de compra CDI = total da NF / quantidade. Menor, maior e último preço de referência = compras da própria unidade de destino nos 365 dias anteriores. No consumo da Chuá, referências do próprio local somente anteriores ao projeto; preços de outras fazendas são cenários separados. A diferença utiliza exclusivamente a quantidade com compra CDI atribuída, sem somar perdas ou duplicar quantidades.</p></div>',
  '</details>'
 ].join('');
 const $=id=>section.querySelector('#'+id),ty=$('cea-type'),ref=$('cea-ref'),de=$('cea-dest'),query=$('cea-search');
 const unique=[...new Map(list.map(r=>[r.destinationCode+'|'+r.destinationName,{key:r.destinationCode+'|'+r.destinationName,label:r.destinationName}])).values()].sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
 for(const item of unique){const o=document.createElement('option');o.value=item.key;o.textContent=item.label;de.appendChild(o)}
 let filtered=[],page=0;const limit=80;
 const delta=(r)=>r.diffLast===null?null:Number(r.diffLast)||0;
 function matches(r){
  if(ty.value&&r.type!==ty.value)return false;
  if(de.value&&r.destinationCode+'|'+r.destinationName!==de.value)return false;
  if(ref.value==='destino'&&r.diffLast===null)return false;
  if(ref.value==='rede'&&r.networkLast===null)return false;
  if(ref.value==='faltante'&&(r.diffLast!==null||r.networkLast!==null))return false;
  const q=query.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return !q||[r.code,r.product,r.doc,r.cdidocs,r.destinationName].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q);
 }
 function render(resetPage=false){
  if(resetPage)page=0;
  filtered=list.filter(matches).sort((a,b)=>b.amountERP-a.amountERP);
  const totalPages=Math.max(1,Math.ceil(filtered.length/limit));page=Math.max(0,Math.min(page,totalPages-1));
  $('cea-count').textContent=filtered.length;$('cea-cost').textContent=fmt(filtered.reduce((s,r)=>s+r.costCDI,0));$('cea-difference').textContent=fmt(filtered.reduce((s,r)=>s+(delta(r)||0),0));
  $('cea-pages').textContent=(page+1)+' / '+totalPages;$('cea-prev').disabled=page===0;$('cea-next').disabled=page>=totalPages-1;$('cea-export').disabled=!filtered.length;
  const shown=filtered.slice(page*limit,(page+1)*limit);
  $('cea-rows').innerHTML=shown.length?shown.map(r=>'<tr>'+
    '<td>'+displayDate(r.date)+'</td><td>'+escape(types[r.type]||r.type)+'</td><td>'+escape(r.destinationName)+'</td>'+
    '<td><b>'+escape(r.code)+'</b><div>'+escape(r.product)+'</div></td><td>'+escape(r.doc+'/'+r.seq)+'</td><td>'+escape(r.cdidocs||'—')+'</td>'+
    '<td class="cea-num">'+numeric.format(r.qty)+'</td><td class="cea-num">'+numeric.format(r.matchedQty)+'</td>'+
    '<td class="cea-num">'+fmt(r.costCDI)+'</td><td class="cea-num">'+price(r.minPrice)+'</td><td class="cea-num">'+price(r.maxPrice)+'</td>'+
    '<td class="cea-num">'+price(r.lastPrice)+'</td><td class="cea-num">'+(r.diffLast===null?'—':fmt(r.diffLast))+'</td>'+
    '<td class="cea-num">'+price(r.networkLast)+'</td><td>'+escape(r.matchedQty===0?'Sem compra CDI anterior':r.pendingReceipts?'Compra CDI sem recebimento lançado':r.diffLast===null?'Sem preço próprio':'Comparativo pendente')+'</td></tr>').join(''):
    '<tr><td colspan="15" style="text-align:center;padding:20px">Nenhuma movimentação encontrada.</td></tr>';
 }
 [ty,ref,de].forEach(el=>el.addEventListener('change',()=>render(true)));query.addEventListener('input',()=>render(true));
 $('cea-clear').addEventListener('click',()=>{ty.value='';ref.value='';de.value='';query.value='';render(true)});
 $('cea-prev').addEventListener('click',()=>{page--;render()});$('cea-next').addEventListener('click',()=>{page++;render()});
 $('cea-export').addEventListener('click',()=>{
  const head=['Data','Operacao','Centro custo','Local destino','Codigo','Produto','Un','NUNOTA','Sequencia','Notas CDI','Qtd saida','Qtd com compra CDI','Qtd pendente','Custo saida ERP centavos','Custo CDI centavos','Preco menor destino','Preco maior destino','Preco ultimo destino','Diferenca menor centavos','Diferenca maior centavos','Diferenca ultimo centavos','Preco ultimo outra fazenda','Recebimentos pendentes','Compra CDI mesmo dia','Entrada de outra fazenda'];
  const values=r=>[r.date,types[r.type],r.destinationName,r.destinationCode,r.code,r.product,r.unit,r.doc,r.seq,r.cdidocs,r.qty,r.matchedQty,r.unmatchedQty,r.amountERP,r.costCDI,r.minPrice,r.maxPrice,r.lastPrice,r.diffMin,r.diffMax,r.diffLast,r.networkLast,r.pendingReceipts,r.sameDayReceipt,r.inboundSKU];
  const safe=t=>{let v=String(t??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
  const csv='\uFEFF'+[head,...filtered.map(values)].map(a=>a.map(safe).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='apuracao_compras_CDI_uso_chua.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 window.DB_CDI_BULK_AUDIT={ready:true,data:pack,rows:list,getSummary:()=>pack.categories,getRows:()=>list.slice()};
 render(true);
}
boot().catch(e=>{
 section.innerHTML='<h2 id="cea-title">Apuração das compras do CDI</h2><p style="color:#926b31">Não foi possível conferir a base de compras e baixas: '+escape(e?.message||e)+'. Nenhuma economia não validada será exibida como resultado.</p>';
 console.error('CDI purchase audit',e);
});
})();
