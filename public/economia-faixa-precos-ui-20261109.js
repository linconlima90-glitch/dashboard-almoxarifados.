// Diretoria: economia gerencial retrospectiva por faixa de precos (todas as fazendas).
// Compra de 07/05/2026 em diante. MAX-MIN e ganho da compra nao sao somados novamente
// na distribuicao CDI nem no consumo proprio. Referencias citam notas ERP de compra.
(function(){
'use strict';
if(document.documentElement.dataset.dbPilot==='1'||document.getElementById('db-price-band-panel'))return;
const host=document.getElementById('cdi-distribution-purchases')||document.getElementById('cdi-transfer-panel');
const packed=window.DB_ALL_UNITS_PRICE_BANDS_GZIP;
if(!host||!packed)return;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const price=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
const integer=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4});
const fmtC=c=>money.format((Number(c)||0)/100),fmtMicro=n=>price.format((Number(n)||0)/1e6);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=t=>String(t??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const brDate=v=>String(v||'').split('-').reverse().join('/');
const panel=document.createElement('section');panel.id='db-price-band-panel';panel.className='dbpb';
panel.innerHTML='<h2>Economia por diferença de preços</h2><p>Carregando compras e documentos do ERP...</p>';
host.insertAdjacentElement('afterend',panel);
const css=document.createElement('style');css.id='db-price-band-style';css.textContent=`
#db-price-band-panel{--edge:#dde8df;--ink:#204633;--muted:#688071;background:#fff;border:1px solid #d7e6dc;border-radius:16px;box-shadow:0 4px 17px rgba(10,44,21,.04);padding:24px 26px 20px;color:var(--ink);margin:18px 0 20px;font-family:inherit}
#db-price-band-panel *{box-sizing:border-box}#db-price-band-panel h2{margin:0 0 7px;font-size:22px;font-weight:900;letter-spacing:-.03em;color:#15492d}#db-price-band-panel h3{font-size:14px;color:#24533b;margin:0 0 8px}#db-price-band-panel h4{margin:0;font-size:12px}#db-price-band-panel p{margin:0;line-height:1.58;font-size:11px;color:var(--muted)}
#db-price-band-panel .dbpb-eyebrow{font-size:10px;letter-spacing:.08em;font-weight:850;color:#568564;margin-bottom:8px}#db-price-band-panel .dbpb-head{display:flex;justify-content:space-between;gap:16px;align-items:start}#db-price-band-panel .dbpb-status{font-size:10px;color:#865a15;background:#fff4dd;border:1px solid #ecd3a7;padding:7px 9px;border-radius:8px;font-weight:850;white-space:nowrap}#db-price-band-panel .dbpb-lead{max-width:850px}
#db-price-band-panel .dbpb-hero{display:grid;grid-template-columns:minmax(280px,1.2fr) minmax(190px,1fr) minmax(190px,1fr);gap:12px;margin:16px 0}#db-price-band-panel .dbpb-kpi{border:1px solid var(--edge);background:#f9fcfa;border-radius:12px;padding:17px 18px}#db-price-band-panel .dbpb-kpi.major{background:linear-gradient(105deg,#e5f4ea,#f4faf6);border-color:#bfdac8}#db-price-band-panel .dbpb-kpi small{font-size:10px;font-weight:750;color:#4e795c;display:block;line-height:1.5}#db-price-band-panel .dbpb-kpi strong{display:block;font-size:22px;letter-spacing:-.04em;color:#176238;font-variant-numeric:tabular-nums;margin:6px 0}#db-price-band-panel .dbpb-kpi.major strong{font-size:31px}#db-price-band-panel .dbpb-kpi span{font-size:10px;color:#718276}
#db-price-band-panel .dbpb-logic{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 15px}#db-price-band-panel .dbpb-explain{padding:14px 15px;border:1px solid var(--edge);border-radius:10px}#db-price-band-panel .dbpb-explain strong{font-size:11px;color:#235039}#db-price-band-panel .dbpb-explain p{margin-top:6px}#db-price-band-panel .dbpb-alert{font-size:11px;line-height:1.6;padding:11px 15px;border-left:3px solid #bd9334;background:#fffaf0;border-radius:6px;color:#715d2c;margin:12px 0 17px}
#db-price-band-panel .dbpb-section-title{display:flex;justify-content:space-between;gap:12px;align-items:baseline;border-top:1px solid var(--edge);padding-top:17px;margin:0 0 12px}#db-price-band-panel .dbpb-section-title span{font-size:10px;color:#7b8b80}#db-price-band-panel .dbpb-locations{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:15px}#db-price-band-panel .dbpb-location{width:100%;padding:11px 12px;background:#fbfdfb;border:1px solid #e1eae3;border-radius:9px;cursor:pointer;text-align:left}#db-price-band-panel .dbpb-location:hover,#db-price-band-panel .dbpb-location:focus{background:#eef7f1;outline:1px solid #aed1ba}#db-price-band-panel .dbpb-location[aria-pressed="true"]{background:#e5f4eb;border-color:#80b699}#db-price-band-panel .dbpb-local-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11px}#db-price-band-panel .dbpb-local-head strong{white-space:nowrap;color:#145a35;font-size:12px}#db-price-band-panel .dbpb-local-head b{color:#365442}#db-price-band-panel .dbpb-track{background:#ebf3ed;border-radius:20px;height:6px;margin:8px 0 5px;overflow:hidden}#db-price-band-panel .dbpb-track i{display:block;height:6px;background:#3f9464;border-radius:20px}#db-price-band-panel .dbpb-local-foot{display:flex;justify-content:space-between;font-size:10px;color:#7b8c7e}
#db-price-band-panel details{border:1px solid var(--edge);border-radius:10px;overflow:hidden;margin-top:12px}#db-price-band-panel details>summary{background:#f3f8f4;padding:15px 16px;color:#2a6140;font-size:12px;font-weight:850;cursor:pointer;list-style:none}#db-price-band-panel details>summary::-webkit-details-marker{display:none}#db-price-band-panel .dbpb-body{padding:15px}
#db-price-band-panel .dbpb-filters{display:grid;grid-template-columns:repeat(4,minmax(135px,1fr)) minmax(150px,1.4fr) auto;gap:9px;align-items:end}#db-price-band-panel .dbpb-filters label{font-size:10px;font-weight:800;color:#526f5c}#db-price-band-panel .dbpb-filters select,#db-price-band-panel .dbpb-filters input{margin-top:5px;display:block;width:100%;height:36px;border-radius:7px;border:1px solid #cddfd2;background:white;color:#315341;padding:6px 8px;font-size:11px;min-width:0}#db-price-band-panel button.dbpb-clear,#db-price-band-panel button.dbpb-export{background:#eaf6ee;border:1px solid #a9cbb4;border-radius:7px;color:#1d633d;padding:7px 12px;font-size:11px;cursor:pointer;font-weight:850;min-height:36px}#db-price-band-panel .dbpb-export{background:#187446!important;color:#fff!important}
#db-price-band-panel .dbpb-filtered{display:flex;align-items:center;gap:15px;flex-wrap:wrap;margin:12px 0;border-radius:9px;background:#f7faf8;padding:11px 13px;color:#557061;font-size:11px}#db-price-band-panel .dbpb-filtered strong{color:#1a623d;font-size:13px}#db-price-band-panel .dbpb-filtered button{margin-left:auto}
#db-price-band-panel .dbpb-scroll{max-height:440px;overflow:auto;border-radius:8px;border:1px solid var(--edge)}#db-price-band-panel table{width:100%;border-collapse:collapse;min-width:1120px;font-size:10px}#db-price-band-panel th{background:#e9f4ec;position:sticky;top:0;text-align:left;color:#295e40;padding:11px 9px;white-space:nowrap;z-index:1}#db-price-band-panel td{padding:10px 9px;border-bottom:1px solid #e5ece6;line-height:1.4;color:#405b49;vertical-align:middle}#db-price-band-panel tr.dbpb-product{cursor:pointer}#db-price-band-panel tr.dbpb-product:hover td,#db-price-band-panel tr.dbpb-product:focus td{background:#f1f8f3}#db-price-band-panel td.dbpb-num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:750}#db-price-band-panel td.dbpb-benefit{color:#187044;font-weight:900}#db-price-band-panel .dbpb-doc{border-radius:8px;background:#f4faf6;border:1px solid #d7e5db;padding:14px;margin-top:14px}#db-price-band-panel .dbpb-doc h4{font-size:13px;color:#1d5137;margin-bottom:8px}#db-price-band-panel .dbpb-doc p{margin-bottom:9px}#db-price-band-panel .dbpb-doc table{min-width:900px}#db-price-band-panel .dbpb-info{margin:12px 0 0!important;color:#718477!important;font-size:10px!important}#db-price-band-panel .dbpb-foot{padding-top:11px;border-top:1px solid #e3ebe5;margin-top:14px!important}
@media(max-width:1120px){#db-price-band-panel .dbpb-hero{grid-template-columns:1fr 1fr}#db-price-band-panel .dbpb-hero .major{grid-column:1/-1}#db-price-band-panel .dbpb-filters{grid-template-columns:repeat(3,minmax(130px,1fr))}#db-price-band-panel .dbpb-locations{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){#db-price-band-panel{padding:18px 14px}#db-price-band-panel .dbpb-head{flex-direction:column}#db-price-band-panel .dbpb-hero{grid-template-columns:1fr}#db-price-band-panel .dbpb-hero .major{grid-column:auto}#db-price-band-panel .dbpb-logic{grid-template-columns:1fr}#db-price-band-panel .dbpb-locations{grid-template-columns:1fr}#db-price-band-panel .dbpb-filters{grid-template-columns:1fr}#db-price-band-panel .dbpb-section-title{align-items:start;flex-direction:column}}
`;document.head.appendChild(css);
function launch(data){
 const M=data.meta,products=data.products,purchases=data.purchases;const idx=new Map(products.map(p=>[p[0],p]));
 if(M.schema!==2||M.projectRows!==381||M.scopeSku!==320||M.projectPurchaseCents!==21832862||M.mainGainCents!==1832511||M.priorOnlyGainCents!==1513889||M.latestOverrides!==50||products.length!==320||purchases.length!==381||new Set(products.map(x=>x[0])).size!==320||purchases.reduce((s,r)=>s+r[11],0)!==M.mainGainCents||purchases.reduce((s,r)=>s+r[9],0)!==M.projectPurchaseCents||products.reduce((s,p)=>s+p[19],0)!==M.mainGainCents)throw Error('Base de economia maior/menor não conciliada');
 const locName=c=>M.localNames[String(c)]||String(c);
 const kpi=(title,value,foot,major)=>'<div class="dbpb-kpi'+(major?' major':'')+'"><small>'+esc(title)+'</small><strong>'+esc(value)+'</strong><span>'+esc(foot)+'</span></div>';
 panel.innerHTML=[
 '<header class="dbpb-head"><div><div class="dbpb-eyebrow">GESTÃO DE ESTOQUES · TODAS AS FAZENDAS · DESDE 07/05/2026</div><h2>Economia por diferença de preços das compras</h2><p class="dbpb-lead">Considera todas as compras do período dos produtos enviados, independentemente de terem sido para o CDI 30115, para outras fazendas ou para consumo local.</p></div><div class="dbpb-status">ECONOMIA GERENCIAL ESTIMADA</div></header>',
 '<div class="dbpb-hero">',kpi('Preço maior do histórico versus preço realmente pago',fmtC(M.mainGainCents),'381 compras avaliadas · sem duplicidade',true),kpi('Comparação usando somente preços anteriores',fmtC(M.priorOnlyGainCents),'Referência de compras feitas até cada data',false),kpi('Valor das compras do projeto',fmtC(M.projectPurchaseCents),'320 produtos no relatório · 232 comprados após 07/05',false),'</div>',
 '<div class="dbpb-logic"><div class="dbpb-explain"><strong>Como entra a economia</strong><p>Para cada compra: <b>(maior preço histórico − preço efetivamente pago) × quantidade</b>, considerando somente diferenças positivas. A tabela mostra o menor, o maior, o preço efetivo e a nota de cada compra.</p></div><div class="dbpb-explain"><strong>Controle para não duplicar</strong><p>A vantagem de preço é atribuída à <b>compra</b>. A transferência para outra fazenda ou o consumo na Chuá demonstram a utilização, mas não somam o mesmo ganho novamente. As perdas D410 ficam fora do ganho por movimentação.</p></div></div>',
 '<div class="dbpb-alert"><b>Critério de comparação:</b> o maior preço pode ser posterior à compra, de outra fazenda ou envolver condições diferentes de marca, quantidade e frete. Por isso, '+fmtC(M.mainGainCents)+' é um <b>indicador gerencial retrospectivo</b>, não uma economia líquida comprovada. O teto matemático máximo−mínimo aplicado a todo o volume seria '+fmtC(M.theoreticalSpreadAllQtyCents)+', mas não deve ser somado ao resultado.</div>',
 '<div class="dbpb-section-title"><h3>Onde tivemos compras com melhores preços</h3><span>Clique na fazenda para filtrar as compras</span></div><div class="dbpb-locations" id="dbpb-locations"></div>',
 '<details id="dbpb-details"><summary>Consultar os 320 produtos, preços mínimo/máximo e notas de compra</summary><div class="dbpb-body">',
 '<div class="dbpb-filters">',
 '<label>Local da compra<select id="dbpb-local"><option value="">Todos os locais</option></select></label>',
 '<label>Mês<select id="dbpb-month"><option value="">Todos os meses</option></select></label>',
 '<label>Grupo<select id="dbpb-group"><option value="">Todos os grupos</option></select></label>',
 '<label>Produto<select id="dbpb-sku"><option value="">Todos os produtos</option></select></label>',
 '<label>Buscar código, NF ou fornecedor<input id="dbpb-search" type="search" placeholder="Produto, NF, código..."></label>',
 '<button class="dbpb-clear" id="dbpb-reset" type="button">Limpar</button></div>',
 '<div class="dbpb-filtered"><div><strong id="dbpb-product-count">—</strong> produtos · <strong id="dbpb-count">—</strong> compras</div><div>Comprado: <strong id="dbpb-value">—</strong></div><div>Economia estimada: <strong id="dbpb-gain">—</strong></div><button class="dbpb-export" type="button" id="dbpb-export">Exportar compras CSV</button></div>',
 '<div class="dbpb-scroll"><table><thead><tr>'+['Código / produto','Un.','Menor preço','Maior preço','Dif. unitária','Qtd. comprada','Valor comprado','Ganho estimado','Ganho preço anterior','Situação'].map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody id="dbpb-rows"></tbody></table></div>',
 '<div class="dbpb-doc" id="dbpb-doc" style="display:none"></div>',
 '<p class="dbpb-info">Selecione um produto na tabela para conferir as notas com preços mínimos e máximos e as compras que geraram o diferencial.</p>',
 '</div></details>',
 '<p class="dbpb-foot">Fonte: relatório de compras ERP de 09/11/2026, consolidado com as bases auditadas de 03 e 06/11. Deduplicação por NUNOTA + sequência + produto + local; custos retificados da fonte mais recente prevalecem. '+integer.format(M.latestOverrides)+' lançamentos de origem tiveram valores atualizados. A baixa ou transferência de um item não altera novamente esse indicador.</p>'
 ].join('');
 const $=name=>panel.querySelector('#'+name); const state={};
 const local=$('dbpb-local'),month=$('dbpb-month'),group=$('dbpb-group'),sku=$('dbpb-sku'),search=$('dbpb-search');
 let visible=[],visibleProducts=[];
 const addOption=(element,key,label)=>{const opt=document.createElement('option');opt.value=String(key);opt.textContent=String(label);element.add(opt)};
 [...new Set(purchases.map(p=>p[6]))].sort((a,b)=>locName(a).localeCompare(locName(b),'pt-BR')).forEach(x=>addOption(local,x,locName(x)+' · '+x));
 [...new Set(purchases.map(p=>p[1].slice(0,7)))].sort().reverse().forEach(x=>addOption(month,x,x.slice(5,7)+'/'+x.slice(0,4)));
 function preserveSelect(select,values,label){const before=select.value;select.replaceChildren();addOption(select,'',label);values.forEach(x=>addOption(select,x.value,x.label));select.value=values.some(x=>x.value===before)?before:'';}
 function has(r){return (!local.value||String(r[6])===local.value)&&(!month.value||r[1].startsWith(month.value))}
 const locationContent=data.byLocal.slice().filter(x=>x.lines>0).map(r=>{
   const w=M.mainGainCents?Math.min(100,100*r.gain/M.mainGainCents).toFixed(1):'0';return '<button class="dbpb-location" type="button" data-code="'+esc(r.code)+'" aria-pressed="false"><div class="dbpb-local-head"><b>'+esc(r.name)+'</b><strong>'+fmtC(r.gain)+'</strong></div><div class="dbpb-track" aria-hidden="true"><i style="width:'+w+'%"></i></div><div class="dbpb-local-foot"><span>'+r.lines+' compras</span><span>'+fmtC(r.value)+' comprados</span></div></button>';
 }).join('');$('dbpb-locations').innerHTML=locationContent;
 function updateCascade(){
   const subset=purchases.filter(has);
   const groups=[...new Set(subset.map(x=>x[4]))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
   preserveSelect(group,groups.map(x=>({value:x,label:x})),'Todos os grupos');
   const byGroup=subset.filter(r=>!group.value||r[4]===group.value);
   const ids=[...new Set(byGroup.map(x=>x[0]))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
   preserveSelect(sku,ids.map(k=>({value:k,label:(idx.get(k)?.[2]||k)+' ('+k+')'})),'Todos os produtos');
 }
 const agg=a=>a.reduce((o,r)=>{const k=r[0],x=o.get(k)||{cents:0,gain:0,prior:0,qty:0,lines:0};x.cents+=r[9];x.gain+=r[11];x.prior+=r[12];x.qty+=r[8];x.lines++;o.set(k,x);return o},new Map());
 function purchaseFilter(r){const q=norm(search.value.trim());return has(r)&&(!group.value||r[4]===group.value)&&(!sku.value||r[0]===sku.value)&&(!q||norm([r[2],r[3],r[4],r[7],r[13],r[14],r[0]].join(' ')).includes(q))}
 function render(){
   visible=purchases.filter(purchaseFilter);const summed=agg(visible);
   const defaultAll=!local.value&&!month.value&&!group.value&&!sku.value&&!search.value;
   visibleProducts=products.filter(p=>defaultAll||summed.has(p[0]));
   visibleProducts.sort((a,b)=>(summed.get(b[0])?.gain||0)-(summed.get(a[0])?.gain||0)||a[2].localeCompare(b[2],'pt-BR'));
   $('dbpb-count').textContent=integer.format(visible.length);$('dbpb-product-count').textContent=integer.format(visibleProducts.length);
   $('dbpb-value').textContent=fmtC(visible.reduce((s,r)=>s+r[9],0));$('dbpb-gain').textContent=fmtC(visible.reduce((s,r)=>s+r[11],0));
   $('dbpb-export').disabled=!visible.length;
   $('dbpb-rows').innerHTML=visibleProducts.length?visibleProducts.map(p=>{
    const q=summed.get(p[0])||{cents:0,gain:0,prior:0,qty:0,lines:0};
    return '<tr class="dbpb-product" tabindex="0" data-key="'+esc(p[0])+'" title="Abrir documentos deste produto"><td><b>'+esc(p[1])+'</b><div>'+esc(p[2])+'</div></td><td>'+esc(p[4])+'</td><td class="dbpb-num">'+fmtMicro(p[5])+'</td><td class="dbpb-num">'+fmtMicro(p[6])+'</td><td class="dbpb-num">'+fmtMicro(p[6]-p[5])+'</td><td class="dbpb-num">'+number.format(q.qty)+'</td><td class="dbpb-num">'+fmtC(q.cents)+'</td><td class="dbpb-num dbpb-benefit">'+fmtC(q.gain)+'</td><td class="dbpb-num">'+fmtC(q.prior)+'</td><td>'+esc(q.lines?'Comprado após 07/05':'Só histórico anterior')+'</td></tr>';
   }).join(''):'<tr><td colspan="10" style="text-align:center;padding:18px">Nenhum produto encontrado com os filtros selecionados.</td></tr>';
   panel.querySelectorAll('.dbpb-location').forEach(button=>button.setAttribute('aria-pressed',local.value===button.dataset.code?'true':'false'));
   $('dbpb-doc').style.display='none';
 }
 function detail(key){
   const p=idx.get(key),matches=visible.filter(r=>r[0]===key);
   if(!p)return;const el=$('dbpb-doc');el.style.display='block';
   el.innerHTML='<h4>'+esc(p[1])+' · '+esc(p[2])+'</h4><p><b>Menor preço histórico:</b> '+fmtMicro(p[5])+' · NF '+esc(p[7])+' · '+brDate(p[9])+' · local '+esc(p[10])+' · '+esc(p[11])+'</p>'+
      '<p><b>Maior preço histórico:</b> '+fmtMicro(p[6])+' · NF '+esc(p[12])+' · '+brDate(p[14])+' · local '+esc(p[15])+' · '+esc(p[16])+'</p>'+
      '<div class="dbpb-scroll" style="max-height:280px"><table style="min-width:1120px"><thead><tr>'+['Data','Local','NF / NUNOTA','Fornecedor','Quantidade','Preço pago','Maior preço','Valor da compra','Economia estimada','Recebimento'].map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+matches.map(r=>'<tr><td>'+brDate(r[1])+'</td><td>'+esc(locName(r[6]))+'</td><td>'+esc(r[13]+' / '+r[14]+'/'+r[15])+'</td><td>'+esc(r[7])+'</td><td class="dbpb-num">'+number.format(r[8])+'</td><td class="dbpb-num">'+fmtMicro(r[10])+'</td><td class="dbpb-num">'+fmtMicro(p[6])+'</td><td class="dbpb-num">'+fmtC(r[9])+'</td><td class="dbpb-num dbpb-benefit">'+fmtC(r[11])+'</td><td>'+esc(r[16])+'</td></tr>').join('')+'</tbody></table></div>';
   el.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 local.addEventListener('change',()=>{group.value='';sku.value='';updateCascade();render()});
 month.addEventListener('change',()=>{group.value='';sku.value='';updateCascade();render()});
 group.addEventListener('change',()=>{sku.value='';updateCascade();render()});
 sku.addEventListener('change',render);search.addEventListener('input',render);
 $('dbpb-reset').addEventListener('click',()=>{local.value=month.value=group.value=sku.value=search.value='';updateCascade();render()});
 panel.querySelectorAll('.dbpb-location').forEach(btn=>btn.addEventListener('click',()=>{const next=local.value===btn.dataset.code?'':btn.dataset.code;local.value=next;month.value=group.value=sku.value=search.value='';updateCascade();render();$('dbpb-details').open=true;$('dbpb-details').scrollIntoView({behavior:'smooth',block:'nearest'})}));
 $('dbpb-rows').addEventListener('click',e=>{const tr=e.target.closest('tr[data-key]');if(tr)detail(tr.dataset.key)});
 $('dbpb-rows').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const tr=e.target.closest('tr[data-key]');if(tr){e.preventDefault();detail(tr.dataset.key)}}});
 $('dbpb-export').addEventListener('click',()=>{
   const heads=['Data','Codigo','Produto','Grupo','Unidade','Codigo local','Fornecedor','Quantidade','Valor compra centavos','Preco efetivo por un. R$','Preco minimo R$','Preco maximo R$','Economia centavos','Ganho preco anterior centavos','NF','NUNOTA','Sequencia','Recebimento'];
   const records=visible.map(r=>{const p=idx.get(r[0]);return [r[1],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9],(r[10]/1e6).toFixed(6).replace('.',','),(p[5]/1e6).toFixed(6).replace('.',','),(p[6]/1e6).toFixed(6).replace('.',','),r[11],r[12],r[13],r[14],r[15],r[16]]});
   const quote=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
   const csv='\uFEFF'+[heads,...records].map(x=>x.map(quote).join(';')).join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='compras_economia_max_menor_2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),650);
 });
 updateCascade();render();
 window.DB_PRICE_BAND_SAVINGS={ready:true,summary:M,getProducts:()=>products.slice(),getPurchases:()=>purchases.slice(),getVisiblePurchases:()=>visible.slice(),refresh:render};
}
async function boot(){try{
 const bytes=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));
 const txt=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 launch(JSON.parse(txt));
}catch(err){console.error('[economia preco maior-menor] ',err);panel.innerHTML='<h2>Comparativo maior e menor preço · conferência pendente</h2><p>Não foi possível verificar a base de compras: '+esc(err.message)+'. Nenhuma economia foi apresentada sem conferência.</p>'}}
boot();
})();
