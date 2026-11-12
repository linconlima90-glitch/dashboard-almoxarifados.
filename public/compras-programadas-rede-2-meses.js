// Planejamento de compras para 60 dias. Consultivo; nao emite pedido ERP.
(function(){
'use strict';
if(window.DB_PROGRAMMED_PURCHASES)return;
const tabs=document.querySelector('.tabs'),wrap=document.querySelector('.wrap');
if(!tabs||!wrap)return;
const tab=document.createElement('button');tab.type='button';tab.className='tab';
tab.dataset.view='compras-programadas';tab.textContent='Compras Programadas · 2 meses';tabs.appendChild(tab);
const view=document.createElement('section');view.id='view-compras-programadas';view.className='view';wrap.appendChild(view);
const state={query:'',local:'',group:'',product:'',onlyUrgent:false,otherTransfers:true,receiptDate:'',limit:100,selected:new Map(),override:new Map(),purchaseOpen:new Set(),destinationOpen:new Set(),purchaseShown:new Map(),destinationShown:new Map(),purchaseInitialized:false,destinationInitialized:false,dirty:true,plan:null};
const num=x=>Number(x)||0,str=x=>String(x??''),norm=x=>str(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const esc=x=>str(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(x));
const fmt=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(num(x));
const integer=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(num(x));
const continuous=new Set(['KG','LT','ML','MT','M2','M3','CM','GR']);
const roundUp=(v,un)=>!(v>0)?0:continuous.has(norm(un))?Math.ceil((v-1e-8)*100)/100:Math.ceil(v-1e-8);
const round=(v,un)=>continuous.has(norm(un))?Math.round(v*100)/100:Math.round(v);
const banned=x=>typeof window.DB_MINIMUM_EXCLUDED==='function'?window.DB_MINIMUM_EXCLUDED(x):
  /\b(PNEUS?|CAMARAS?|CIMENTOS?)\b/.test(norm(str(x.grupo)+' '+str(x.produto)));
const out=x=>['ALMOXARIFADO GERAL G GERIBA','ALMOXARIFADO GERAL G S CRUZ'].includes(norm(x.local).replace(/\s+/g,' '));
const isoDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const css=document.createElement('style');css.id='db-pc-style';
css.textContent=
'#view-compras-programadas{font:12px Arial,Helvetica,sans-serif;color:#234c33;padding-bottom:20px}'+
'#view-compras-programadas *{box-sizing:border-box}'+
'#view-compras-programadas .pc-head{padding:20px;border-radius:12px;background:linear-gradient(105deg,#0d4726,#16733b);border-bottom:4px solid #faca04;color:white}'+
'#view-compras-programadas .pc-head h2{font-size:22px;margin:0 0 6px;color:white}'+
'#view-compras-programadas .pc-head p{max-width:1000px;line-height:1.6;font-size:12px;margin:0;color:#e8f4eb}'+
'#view-compras-programadas .pc-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:end;padding:13px;margin:12px 0;border-radius:10px;background:white;border:1px solid #d9e8de}'+
'#view-compras-programadas .pc-filters label{display:flex;flex-direction:column;gap:5px;font-size:10px;font-weight:bold;min-width:135px}'+
'#view-compras-programadas .pc-filters input:not([type=checkbox]),#view-compras-programadas .pc-filters select{border:1px solid #b9d0c0;border-radius:6px;min-height:36px;padding:6px;background:#fff;color:#254a32}'+
'#view-compras-programadas .pc-filters .pc-search{flex:1;min-width:200px}'+
'#view-compras-programadas .pc-filters .pc-cascade{min-width:190px;flex:1}'+
'#view-compras-programadas .pc-filters .pc-product-filter{min-width:210px;flex:1.2}'+
'#view-compras-programadas .pc-filter-label{flex-basis:100%;font-size:11px;color:#176138;font-weight:bold}'+
'#view-compras-programadas .pc-scope{border:1px solid #cfe4d5;border-radius:10px;padding:10px 13px;margin:11px 0;background:#f3faf5}'+
'#view-compras-programadas .pc-scope h3{font-size:13px;margin:0 0 8px;color:#145b32}'+
'#view-compras-programadas .pc-scope .pc-kpi{background:#fff}'+
'#view-compras-programadas .pc-scope-note{color:#5d7564;font-size:10px;margin:8px 2px 0;line-height:1.5}'+
'#view-compras-programadas .pc-count{color:#355b42;font-weight:bold;font-size:11px}'+
'#view-compras-programadas .pc-filters .pc-toggle{flex-direction:row;align-items:center;min-height:36px;max-width:240px;line-height:1.5}'+
'#view-compras-programadas .pc-delivery-policy{border:1px solid #cbe4d2;background:#f2faf4;border-radius:8px;color:#1c6338;font-size:11px;padding:9px 13px;margin:12px 0;line-height:1.55}'+
'#view-compras-programadas button.pc-btn{border:1px solid #bfd7c5;background:#e9f5ed;color:#145d33;border-radius:7px;padding:10px;cursor:pointer;font-size:11px;font-weight:bold}'+
'#view-compras-programadas button.pc-btn:hover{background:#d8eddf}'+
'#view-compras-programadas button.pc-primary{background:#16633a;color:white;border-color:#16633a}'+
'#view-compras-programadas .pc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}'+
'#view-compras-programadas .pc-kpi{background:white;padding:13px;border:1px solid #dfebe2;border-top:3px solid #17733b;border-radius:9px;min-width:0}'+
'#view-compras-programadas .pc-kpi.important{border-top-color:#faca04}'+
'#view-compras-programadas .pc-kpi span,#view-compras-programadas .pc-kpi small{display:block;color:#647a6b;font-size:10px;line-height:1.5}'+
'#view-compras-programadas .pc-kpi strong{display:block;font-size:20px;color:#105630;margin:6px 0;overflow-wrap:anywhere}'+
'#view-compras-programadas .pc-note{margin:12px 0;padding:11px 14px;border:1px solid #eaddb3;background:#fff9ec;color:#765c20;border-radius:8px;font-size:11px;line-height:1.6}'+
'#view-compras-programadas .pc-panel{background:white;border:1px solid #dce8df;border-radius:10px;margin:12px 0;overflow:hidden}'+
'#view-compras-programadas .pc-title{padding:13px 16px;background:#edf7f0;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #dae8df}'+
'#view-compras-programadas .pc-title h3{font-size:15px;margin:0;color:#165b34}'+
'#view-compras-programadas .pc-title small{color:#617d69;font-size:10px}'+
'#view-compras-programadas .pc-scroll{max-height:560px;overflow:auto}'+
'#view-compras-programadas table{width:100%;min-width:1050px;border-collapse:collapse;font-size:10px}'+
'#view-compras-programadas th,#view-compras-programadas td{border-bottom:1px solid #e3eee5;padding:9px 7px;vertical-align:middle}'+
'#view-compras-programadas th{position:sticky;top:0;background:#e9f4ed;color:#285c38;text-align:left;z-index:1}'+
'#view-compras-programadas td.num{text-align:right;white-space:nowrap}'+
'#view-compras-programadas .pc-description{min-width:200px;max-width:290px}'+
'#view-compras-programadas .pc-description small{display:block;color:#829487;margin-top:3px}'+
'#view-compras-programadas .pc-qty{width:76px;max-width:100%;padding:5px;border:1px solid #c8d8cb;border-radius:5px;text-align:right}'+
'#view-compras-programadas .pc-urgent{color:#83600c;font-weight:bold}'+
'#view-compras-programadas .pc-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:11px 14px;color:#647668;font-size:10px}'+
'#view-compras-programadas .pc-location{margin:8px 13px;border:1px solid #e1ede5;border-radius:7px;overflow:hidden}'+
'#view-compras-programadas .pc-location summary{padding:12px;cursor:pointer;background:#fbfdfb;color:#155b31;font-weight:bold;display:flex;gap:12px;justify-content:space-between}'+
'#view-compras-programadas .pc-location summary small{color:#617b69;font-size:10px;font-weight:normal}'+
'#view-compras-programadas .pc-group-list{padding:9px 12px 12px}'+
'#view-compras-programadas .pc-group{border:1px solid #d9e7de;border-radius:9px;overflow:hidden;margin:8px 0;background:#fff}'+
'#view-compras-programadas .pc-group-toggle{width:100%;border:0;padding:13px 15px;background:#f4faf6;display:flex;gap:14px;align-items:center;justify-content:space-between;text-align:left;cursor:pointer;color:#165a34}'+
'#view-compras-programadas .pc-group-toggle:hover{background:#eaf5ee}'+
'#view-compras-programadas .pc-group-toggle[aria-expanded="true"]{background:#e8f4ec;border-bottom:2px solid #a6d0b1}'+
'#view-compras-programadas .pc-group-label{display:flex;gap:10px;align-items:center;min-width:0;flex:1}'+
'#view-compras-programadas .pc-group-arrow{font-size:14px;flex:none;color:#187041}'+
'#view-compras-programadas .pc-group-label b{font-size:13px;overflow-wrap:anywhere}'+
'#view-compras-programadas .pc-group-values{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:flex-end;font-size:11px;color:#4d735a;text-align:right}'+
'#view-compras-programadas .pc-group-values strong{font-size:14px;color:#13572f}'+
'#view-compras-programadas .pc-group-values span{white-space:nowrap}'+
'#view-compras-programadas .pc-group-count{font-size:10px;color:#577460;font-weight:normal;white-space:nowrap}'+
'#view-compras-programadas .pc-group-empty{font-size:10px;color:#6c8373;padding:10px 14px}'+
'#view-compras-programadas .pc-subgroup-row td{background:#f0f7f1!important;color:#1d5d37;font-weight:bold;border-top:2px solid #dcece1}'+
'#view-compras-programadas .pc-group .pc-scroll{max-height:440px}'+
'#view-compras-programadas .pc-empty{padding:18px;color:#708277;text-align:center}'+
'#view-compras-programadas .pc-central-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}'+
'#view-compras-programadas .pc-flow-step{border:1px solid #cfe2d4;background:#f4faf6;padding:12px 14px;border-radius:9px;min-width:0}'+
'#view-compras-programadas .pc-flow-step b{display:block;color:#185e36;font-size:12px;margin:0 0 5px}'+
'#view-compras-programadas .pc-flow-step span{display:block;color:#5d7665;font-size:10px;line-height:1.5}'+
'#view-compras-programadas .pc-flow-step strong{display:block;margin-top:7px;font-size:17px;color:#135b34}'+
'#view-compras-programadas .pc-route{font-size:10px;color:#4b6954;display:block;margin-top:4px}'+
'@media(max-width:1000px){#view-compras-programadas .pc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#view-compras-programadas .pc-central-flow{grid-template-columns:1fr}}'+
'@media(max-width:600px){#view-compras-programadas .pc-kpis{grid-template-columns:1fr}#view-compras-programadas .pc-filters label{width:100%}}';
document.head.appendChild(css);
view.innerHTML='<div class="pc-head"><h2>Compra Única · Abastecimento do CDI para 2 meses</h2>'+
'<p>Fazer <b>um único pedido agora para cobrir o consumo previsto dos próximos dois meses</b>, com recebimento centralizado '+
'no CDI de Peças (ERP 30115, Fazenda Chuá). <b>Dois meses são o período de estoque a atender, não o prazo de entrega.</b> '+
'O CDI reserva o necessário à Chuá e distribui o restante às outras fazendas. O pedido não é emitido automaticamente.</p></div>'+
'<div class="pc-filters"><span class="pc-filter-label">Filtro em cascata · 1. Fazenda → 2. Grupo → 3. Produto</span>'+
'<label class="pc-cascade">1. Fazenda<select id="pc-local"><option value="">Toda a rede</option></select></label>'+
'<label class="pc-cascade">2. Grupo<select id="pc-group"><option value="">Todos os grupos</option></select></label>'+
'<label class="pc-cascade pc-product-filter">3. Produto<select id="pc-product"><option value="">Todos os produtos</option></select></label>'+
'<label class="pc-search">Busca adicional<input id="pc-query" type="search" placeholder="Código, produto ou unidade"></label>'+
'<button type="button" class="pc-btn" id="pc-clear">Limpar filtros</button>'+
'<label>Recebimento previsto (opcional)<input id="pc-receipt-date" type="date" title="Data negociada com o fornecedor; não é calculada como 60 dias"></label>'+
'<label class="pc-toggle"><input id="pc-other" type="checkbox" checked> Usar excedentes confiáveis de outras fazendas</label>'+
'<label class="pc-toggle"><input id="pc-urgent-only" type="checkbox"> Somente itens prioritários</label>'+
'<button type="button" class="pc-btn pc-primary" id="pc-export">Exportar pedido para CDI 30115</button>'+
'<button type="button" class="pc-btn" id="pc-export-farm">Exportar distribuição por fazenda</button>'+
'<button type="button" class="pc-btn" id="pc-export-transfer">Exportar transferências de saldos atuais</button></div>'+
'<div id="pc-overview"></div><div id="pc-details"></div>';
const $=s=>view.querySelector(s);
$('#pc-receipt-date').value=state.receiptDate;
const ready=()=>typeof STOCK!=='undefined'&&Array.isArray(STOCK)&&
  typeof MOVEMENTS_YEARLY!=='undefined'&&Array.isArray(MOVEMENTS_YEARLY)&&
  !!window.CURRENT_STOCK_META&&window.MOVEMENTS_REVISED_META?.forMinimum?.months===22;
const key=(code,un)=>str(code)+'|'+norm(un);
function compute(){
  if(!ready())return null;
  const skus=new Map(),costs=new Map(),olderPrice=new Map(),mixed=new Set((window.MOVEMENTS_REVISED_META?.mixedUnits||[]).map(x=>str(x.codigo_local)+'|'+str(x.codigo)));
  const pick=(code,un,product,group)=>{
    const id=key(code,un);let e=skus.get(id);
    if(!e){e={id,code:str(code),un:norm(un),product:str(product),group:str(group)||'SEM GRUPO',loc:new Map(),price:0,priceSource:'SEM REFERÊNCIA'};skus.set(id,e)}
    if(!e.product&&product)e.product=str(product);
    if(!e.group&&group)e.group=str(group);
    return e;
  };
  const at=(e,s)=>{
    const id=str(s.codigo_local)+'|'+str(s.local);let x=e.loc.get(id);
    if(!x){x={id,sku:e.id,code:e.code,un:e.un,product:e.product,group:e.group,codeLocal:str(s.codigo_local),local:str(s.local),
      stock:0,stockValue:0,consumed:0,months:new Set(),receivedChua:0,receivedOther:0,donated:0};
      e.loc.set(id,x)}
    return x;
  };
  for(const s of STOCK){
    if(out(s)||banned(s)||!s.codigo||!s.un)continue;
    const e=pick(s.codigo,s.un,s.produto,s.grupo),x=at(e,s),q=Math.max(0,num(s.estoque)),v=Math.max(0,num(s.valor_estoque));
    x.stock+=q;x.stockValue+=v;
    if(q>0&&v>0){const a=costs.get(e.id)||[];a.push({location:str(s.codigo_local),q,v});costs.set(e.id,a)}
  }
  for(const m of MOVEMENTS_YEARLY){
    const year=str(m.year);
    if(!['2025','2026'].includes(year)||out(m)||banned(m)||!m.codigo||!m.un)continue;
    const e=pick(m.codigo,m.un,m.produto,m.grupo),x=at(e,m),limit=year==='2025'?12:10;
    for(let i=0;i<limit;i++){const amount=Math.max(0,num(m.months?.[i]));if(amount>0){x.consumed+=amount;x.months.add(year+'-'+i)}}
  }
  if(typeof MOVEMENTS!=='undefined'&&Array.isArray(MOVEMENTS))for(const m of MOVEMENTS){
    const id=key(m.codigo,m.un);
    if(num(m.cost)>0&&!olderPrice.has(id))olderPrice.set(id,num(m.cost));
  }
  const lines=[],review=[],transfers=[],localSummary=new Map(),allSkus=[...skus.values()];
  for(const e of allSkus){
    const costsFor=costs.get(e.id)||[],chuaCosts=costsFor.filter(x=>x.location==='30115');
    const ref=chuaCosts.length?chuaCosts:costsFor;
    const rQ=ref.reduce((a,x)=>a+x.q,0),rV=ref.reduce((a,x)=>a+x.v,0);
    e.price=rQ>0?rV/rQ:(olderPrice.get(e.id)||0);
    e.priceSource=rQ>0?(chuaCosts.length?'ERP - CHUA/CDI':'ERP - OUTRAS FAZENDAS'):(e.price?'HISTORICO ERP':'SEM PRECO');
    const locations=[...e.loc.values()];
    for(const x of locations){
      x.average=x.consumed/22;x.target30=roundUp(x.average,x.un);x.target60=roundUp(x.average*2,x.un);
      x.active=x.months.size;x.mixed=mixed.has(x.codeLocal+'|'+x.code);
      x.valid=x.active>=3&&!x.mixed;
      x.needed=x.valid?Math.max(0,round(x.target60-x.stock,e.un)):0;
      x.pending=x.needed;x.coverage=x.average>0?x.stock/x.average:null;
      if(!x.valid&&(x.stock>0||x.consumed>0))review.push({...x,reason:x.mixed?'Unidade divergente':'Histórico com menos de 3 meses',value:x.stock>0?x.stockValue:0});
    }
    const chua=locations.find(x=>x.codeLocal==='30115');
    const requests=locations.filter(x=>x.needed>0).sort((a,b)=>(a.stock===0?-1:0)-(b.stock===0?-1:0)||
      (a.coverage??999)-(b.coverage??999)||b.needed-a.needed);
    if(chua&&chua.valid&&chua.stock>chua.target60){
      let free=round(chua.stock-chua.target60,e.un);
      for(const x of requests){if(x===chua||free<=0)continue;
        const q=Math.max(0,round(Math.min(free,x.pending),e.un));if(!q)continue;
        x.pending=round(x.pending-q,e.un);x.receivedChua+=q;chua.donated+=q;free=round(free-q,e.un);
        transfers.push({source:chua.local,dest:x.local,code:e.code,product:e.product,un:e.un,sku:e.id,group:e.group,q,kind:'CHUA/CDI',price:e.price});
      }
    }
    if(state.otherTransfers){
      const donors=locations.filter(x=>x.codeLocal!=='30115'&&x.valid&&x.stock>x.target60)
        .sort((a,b)=>(b.stock-b.target60)-(a.stock-a.target60));
      for(const d of donors){
        let free=round(d.stock-d.target60,e.un);
        for(const x of requests){if(x===d||x.pending<=0||free<=0)continue;
          const q=Math.max(0,round(Math.min(free,x.pending),e.un));if(!q)continue;
          x.pending=round(x.pending-q,e.un);x.receivedOther+=q;d.donated+=q;free=round(free-q,e.un);
          transfers.push({source:d.local,dest:x.local,code:e.code,product:e.product,un:e.un,sku:e.id,group:e.group,q,kind:'OUTRA FAZENDA',price:e.price});
        }
      }
    }
    e.gross=0;e.fromChua=0;e.fromOther=0;e.buy=0;e.first=0;e.second=0;
    e.toChua=0;e.toNetwork=0;e.toChuaFirst=0;e.toChuaSecond=0;e.toNetworkFirst=0;e.toNetworkSecond=0;
    e.needLocations=[];
    for(const x of locations){
      x.buy=Math.max(0,round(x.pending,e.un));x.price=e.price;
      const postTransfer=x.stock+x.receivedChua+x.receivedOther;
      x.first=Math.min(x.buy,roundUp(Math.max(0,x.target30-postTransfer),e.un));
      x.second=Math.max(0,round(x.buy-x.first,e.un));
      e.gross+=x.needed;e.fromChua+=x.receivedChua;e.fromOther+=x.receivedOther;
      e.buy+=x.buy;e.first+=x.first;e.second+=x.second;
      if(x.codeLocal==='30115'){
        e.toChua+=x.buy;e.toChuaFirst+=x.first;e.toChuaSecond+=x.second;
      }else{
        e.toNetwork+=x.buy;e.toNetworkFirst+=x.first;e.toNetworkSecond+=x.second;
      }
      if(x.needed>0)e.needLocations.push(x);
      let loc=localSummary.get(x.local);
      if(!loc){loc={name:x.local,rows:[],value:0,buy:0,received:0};localSummary.set(x.local,loc)}
      if(x.needed>0){loc.rows.push(x);loc.buy+=x.buy;loc.received+=x.receivedChua+x.receivedOther;loc.value+=x.buy*e.price}
    }
    if(e.buy>1e-9){e.gross=round(e.gross,e.un);e.fromChua=round(e.fromChua,e.un);e.fromOther=round(e.fromOther,e.un);
      e.buy=round(e.buy,e.un);e.first=round(e.first,e.un);e.second=round(e.second,e.un);
      e.chuaStock=chua?.stock||0;e.chuaReserve=chua?.target60||0;
      e.chuaFree=chua?Math.max(0,round(chua.stock-chua.target60,e.un)):0;
      e.urgent=e.first>0;lines.push(e)}
  }
  lines.sort((a,b)=>Number(b.urgent)-Number(a.urgent)||b.buy*b.price-a.buy*a.price||a.code.localeCompare(b.code,'pt-BR'));
  const totals={gross:0,chua:0,others:0,buy:0,first:0,second:0,missing:0,urgent:0,
    reserveChua:0,distributeNetwork:0,reserveFirst:0,reserveSecond:0,networkFirst:0,networkSecond:0,
    review:review.length,reviewStock:0};
  // Incluir tambem codigos 100% supridos por transferencia, para que o
  // resumo feche: falta bruta = CDI + outras transferencias + compra liquida.
  for(const e of allSkus){
    totals.gross+=e.gross*e.price;totals.chua+=e.fromChua*e.price;totals.others+=e.fromOther*e.price;
    totals.buy+=e.buy*e.price;totals.first+=e.first*e.price;totals.second+=e.second*e.price;
    totals.reserveChua+=e.toChua*e.price;totals.distributeNetwork+=e.toNetwork*e.price;
    totals.reserveFirst+=e.toChuaFirst*e.price;totals.reserveSecond+=e.toChuaSecond*e.price;
    totals.networkFirst+=e.toNetworkFirst*e.price;totals.networkSecond+=e.toNetworkSecond*e.price;
    if(e.buy>0&&e.urgent)totals.urgent++;if(e.buy>0&&!e.price)totals.missing++;
  }
  totals.reviewStock=review.reduce((v,x)=>v+x.value,0);
  return {lines,totals,transfers,review,localSummary:[...localSummary.values()].filter(x=>x.rows.length).sort((a,b)=>b.value-a.value),
    stockDate:str(window.CURRENT_STOCK_META?.emissao),months:22,period:'01/01/2025 a 31/10/2026',cdiUnique:true,skusCount:allSkus.length};
}
// Os selects sao dependentes: a fazenda limita grupos; o grupo limita produtos.
const hasLocal=(e,local)=>!local||e.needLocations.some(x=>x.local===local);
function refreshCascade(){
  const p=state.plan;if(!p)return;
  const source=p.lines;
  const sorted=(values)=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const options=(id,label,values,selected,display)=>{
    $(id).innerHTML='<option value="">'+esc(label)+'</option>'+
      values.map(value=>'<option value="'+esc(value)+'"'+(selected===value?' selected':'')+'>'+
        esc(display?display(value):value)+'</option>').join('');
  };
  const locals=sorted(p.localSummary.filter(l=>l.rows.some(x=>x.buy>0)).map(l=>l.name));
  if(state.local&&!locals.includes(state.local)){state.local='';state.group='';state.product=''}
  options('#pc-local','Toda a rede',locals,state.local);
  const localLines=source.filter(e=>hasLocal(e,state.local));
  const groups=sorted(localLines.map(e=>e.group));
  if(state.group&&!groups.includes(state.group)){state.group='';state.product=''}
  options('#pc-group','Todos os grupos',groups,state.group);
  const matching=localLines.filter(e=>!state.group||e.group===state.group)
    .slice().sort((a,b)=>a.product.localeCompare(b.product,'pt-BR')||a.code.localeCompare(b.code,'pt-BR'));
  const products=matching.map(e=>e.id);
  if(state.product&&!products.includes(state.product))state.product='';
  const labels=new Map(matching.map(e=>[e.id,e.code+' · '+e.product+' ('+e.un+')']));
  options('#pc-product','Todos os produtos',products,state.product,value=>labels.get(value));
}
function inScope(e){
  const needle=norm(state.query);
  return hasLocal(e,state.local)&&(!state.group||e.group===state.group)&&
    (!state.product||e.id===state.product)&&(!state.onlyUrgent||e.urgent)&&
    (!needle||norm([e.code,e.product,e.group,...e.needLocations.map(x=>x.local)].join(' ')).includes(needle));
}
function localInScope(x){
  const needle=norm(state.query);
  return (!state.local||x.local===state.local)&&(!state.group||x.group===state.group)&&
    (!state.product||x.sku===state.product)&&(!state.onlyUrgent||x.first>0)&&
    (!needle||norm([x.code,x.product,x.group,x.local].join(' ')).includes(needle));
}
function transferInScope(x){
  const needle=norm(state.query);
  return (!state.local||x.dest===state.local)&&(!state.group||x.group===state.group)&&
    (!state.product||x.sku===state.product)&&
    (!needle||norm([x.code,x.product,x.group,x.dest].join(' ')).includes(needle));
}
// Compra única: o consumo de dois meses define quantidade, não data de entrega.
const edited=e=>{
  const checked=state.selected.get(e.id)!==false;
  const q=checked?(state.override.has(e.id)?state.override.get(e.id):e.buy):0;
  const final=Math.max(0,round(q,e.un));
  return {checked,final,value:final*e.price};
};

const CENTRAL_CDI_LOCAL='30115';
const CENTRAL_CDI_NAME='ALMOXARIFADO GERAL F CHUA / CDI DE PEÇAS';
const CENTRAL_CDI_FISCAL='Empresa 003 - Fazenda Chuá (confirmar com o faturamento)';
function allocationFor(e){
  // Um unico pedido para 30115; o mesmo recebimento se desdobra em
  // reserva de consumo proprio Chua e transferencia TOP 94 para outras unidades.
  // Quantidades alteradas pelo usuario sao distribuidas em ordem de prioridade.
  const a=edited(e);
  const dest=e.needLocations.filter(x=>x.buy>0).slice().sort((x,y)=>
    Number(x.codeLocal!=='30115')-Number(y.codeLocal!=='30115')||
    Number(y.first>0)-Number(x.first>0)||(x.coverage??999)-(y.coverage??999)||
    y.buy-x.buy||x.local.localeCompare(y.local,'pt-BR'));
  const rows=dest.map(x=>({id:x.id,sku:e.id,code:e.code,product:e.product,group:e.group,
    local:x.local,localCode:x.codeLocal,unit:e.un,kind:x.codeLocal==='30115'?'RESERVA INTERNA CHUA':'DISTRIBUIR DO CDI',
    total:0,planned:x.buy,price:e.price,historyMonths:x.active,
    currentStock:x.stock,localTarget:x.target60}));
  let remaining=a.final;
  for(let i=0;i<dest.length;i++){
    const q=Math.max(0,round(Math.min(remaining,dest[i].buy),e.un));
    rows[i].total=q;remaining=round(remaining-q,e.un);
  }
  // Quantidade comprada acima da necessidade distribuivel permanece no CDI,
  // sem transferência automática ou segunda remessa.
  const surplus=round(remaining,e.un);
  const reserve=round(rows.filter(x=>x.localCode==='30115').reduce((v,x)=>v+x.total,0),e.un);
  const distribute=round(rows.filter(x=>x.localCode!=='30115').reduce((v,x)=>v+x.total,0),e.un);
  const uncovered=round(dest.reduce((v,x,i)=>v+Math.max(0,round(x.buy-rows[i].total,e.un)),0),e.un);
  return {...a,rows,reserve,distribute,surplus,uncovered,
    reconciled:Math.abs(a.final-reserve-distribute-surplus)<0.02};
}
const csvField=v=>'"'+str(v??'').replace(/"/g,'""')+'"';
function csv(name,data){const content='\ufeff'+data.map(row=>row.map(csvField).join(';')).join('\r\n'),
  url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),400)}
function redraw(){
  if(!ready()){$('#pc-overview').innerHTML='<div class="pc-note">Preparando histórico e estoque. Reabra esta aba após carregar a plataforma.</div>';return}
  if(state.dirty||!state.plan){state.plan=compute();state.dirty=false;refreshCascade()}
  const p=state.plan,t=p.totals,filtered=p.lines.filter(inScope);
  const single=isSingleDelivery();
  const plannedFirst=single?t.buy:t.first,plannedSecond=single?0:t.second;
  const firstLabel=single?'Entrega única · 60 dias':'1ª entrega · primeiro mês';
  const secondDate=single?'':state.date2;
  const localRows=p.localSummary.flatMap(l=>l.rows).filter(localInScope);
  const scope=localRows.reduce((a,x)=>{a.gross+=x.needed*x.price;a.chua+=x.receivedChua*x.price;
    a.other+=x.receivedOther*x.price;a.buy+=x.buy*x.price;a.first+=x.first*x.price;
    a.second+=x.second*x.price;a.rows++;return a;},
    {gross:0,chua:0,other:0,buy:0,first:0,second:0,rows:0});
  const chosen=p.lines.reduce((a,e)=>{const x=allocationFor(e);
    a.value+=x.value;a.items+=(x.final>0?1:0);a.chua+=x.reserve*e.price;
    a.network+=x.distribute*e.price;a.surplus+=x.surplus*e.price;
    a.uncovered+=x.uncovered*e.price;return a;
  },{value:0,items:0,chua:0,network:0,surplus:0,uncovered:0});
  const card=(label,value,note,highlight=false)=>'<div class="pc-kpi'+(highlight?' important':'')+'"><span>'+label+'</span><strong>'+
    value+'</strong><small>'+note+'</small></div>';
  $('#pc-overview').innerHTML='<div class="pc-kpis">'+
    card('Falta bruta da rede · 60 dias',cash(t.gross),'Antes das transferências')+
    card('Atendimento pelo estoque livre Chuá/CDI',cash(t.chua),'Reserva própria da Chuá preservada')+
    card('Excedentes confiáveis de outras unidades',cash(t.others),'Transferências sugeridas')+
    card('Comprar e receber no CDI 30115 · 60 dias',cash(t.buy),integer(p.lines.length)+' produtos para cotar',true)+
    card(firstLabel,cash(plannedFirst),esc(state.date1))+
    '<div class="pc-second-delivery">'+card('2ª entrega · completar 60 dias',cash(plannedSecond),esc(state.date2))+'</div>'+
    card('Compra ao CDI após ajustes',cash(chosen.value),integer(chosen.items)+' produtos selecionados',true)+
    card('Pendências para análise',integer(t.review),integer(t.missing)+' produtos sem custo de referência')+
    '</div><div class="pc-central-flow">'+
    '<div class="pc-flow-step"><b>1. Compra e recebimento central</b><span>Pedido único destinado ao CDI de Peças · ERP 30115. '+
    (single?'Uma entrega para toda a cobertura de 60 dias.':'Duas entregas previstas.')+'</span><strong>'+cash(t.buy)+'</strong></div>'+
    '<div class="pc-flow-step"><b>2. Reserva para consumo da Chuá</b><span>Parte da compra que recompõe a demanda local, sem transferir para outra empresa.</span><strong>'+cash(t.reserveChua)+'</strong></div>'+
    '<div class="pc-flow-step"><b>3. Distribuição às demais fazendas</b><span>Parcela comprada para posterior transferência a partir do CDI, sujeita à TOP 94.</span><strong>'+cash(t.distributeNetwork)+'</strong></div>'+
    '</div><div class="pc-delivery-policy"><b>Programação:</b> '+(single?
    'Entrega única: 100% da necessidade calculada para 60 dias será recebida no CDI na data selecionada. '+
    'A segunda remessa fica desativada.':
    'Duas entregas: a primeira cobre o primeiro mês e a segunda completa os 60 dias.')+
    ' O valor total da compra permanece igual nos dois modos.</div>'+
    '<div class="pc-note"><b>Após ajustes manuais:</b> reserva Chuá '+cash(chosen.chua)+
    ' · distribuição às outras unidades '+cash(chosen.network)+
    ' · saldo a alocar no CDI '+cash(chosen.surplus)+
    ' · demanda não coberta '+cash(chosen.uncovered)+
    '. A compra entra uma única vez no 30115; reserva e distribuição são destinações previstas, não estoque adicional.</div>'+
    '<div id="pc-cascade-summary"></div><div class="pc-note"><b>Período da média:</b> '+p.period+' (22 meses completos). <b>Estoque:</b> '+esc(p.stockDate)+
    '. Meta = média mensal × 2 meses. Excluídos: pneus, câmaras, cimento e granjas ainda fora do controle. '+
    'Falta de histórico (menos de 3 meses com baixas) ou unidade divergente: não gera compra nem transferência automática. '+
    'Valores pelo custo ERP disponível (ou histórico indicado), sujeitos a nova cotação. Transferências precisam de verificação física e fiscal; não são economia realizada.</div>';
  const scoped=Boolean(state.local||state.group||state.product||state.query||state.onlyUrgent);
  const selectedCaption=[state.local||'Toda a rede',state.group||'Todos os grupos',
    state.product?(p.lines.find(x=>x.id===state.product)?.product||'Produto selecionado'):'Todos os produtos']
    .map(esc).join(' / ');
  $('#pc-cascade-summary').innerHTML=scoped?
    '<div class="pc-scope"><h3>Resultado dos filtros · '+selectedCaption+'</h3>'+
    '<div class="pc-kpis">'+card('Necessidade bruta do recorte',cash(scope.gross),'Antes das transferências')+
    card('Receber da Chuá / CDI',cash(scope.chua),'Reserva própria da Chuá preservada')+
    card('Receber das outras unidades',cash(scope.other),'Redistribuição sugerida')+
    card('Compra líquida do recorte',cash(scope.buy),integer(scope.rows)+' combinações de produto e fazenda',true)+
    '</div><p class="pc-scope-note">Os indicadores acima representam somente a demanda das unidades selecionadas. '+
    'A tabela consolidada abaixo continua mostrando a compra da <b>rede inteira</b> para os produtos filtrados, '+
    'pois o mesmo item comprado pode abastecer mais de uma fazenda. O resumo geral acima permanece inalterado.</p></div>':'';
  const purchaseItemRow=e=>{const a=edited(e);
    return '<tr><td><input type="checkbox" data-pc-select="'+esc(e.id)+'" '+(a.checked?'checked':'')+'></td>'+
    '<td>'+esc(e.code)+'</td><td class="pc-description"><b>'+esc(e.product)+'</b><small>'+esc(e.group)+'</small></td><td>'+esc(e.un)+'</td>'+
    '<td class="num">'+fmt(e.gross)+'</td><td class="num">'+fmt(e.chuaReserve)+'</td><td class="num">'+fmt(e.fromChua)+'</td>'+
    '<td class="num">'+fmt(e.fromOther)+'</td><td class="num"><b>'+fmt(e.buy)+'</b></td>'+
    '<td><input class="pc-qty" type="number" min="0" step="'+(continuous.has(e.un)?'0.01':'1')+
    '" data-pc-qty="'+esc(e.id)+'" value="'+a.final+'"></td><td class="num">'+fmt(a.first)+
    '</td><td class="num pc-second-delivery">'+fmt(a.second)+'</td>'+
    '<td class="num">'+(e.price?cash(e.price):'Cotar')+'</td><td class="num"><b>'+cash(a.value)+'</b></td>'+
    '<td class="'+(e.urgent?'pc-urgent':'')+'">'+(e.urgent?'PRIORITÁRIO':'PROGRAMADO')+'</td></tr>';
  };
  const purchaseMap=new Map();
  for(const e of filtered){
    let g=purchaseMap.get(e.group);
    if(!g){g={name:e.group,items:[],planned:0,selected:0,first:0,second:0};purchaseMap.set(e.group,g)}
    const a=edited(e);g.items.push(e);g.planned+=e.buy*e.price;g.selected+=a.value;
    g.first+=a.first*e.price;g.second+=a.second*e.price;
  }
  const purchaseGroups=[...purchaseMap.values()].sort((a,b)=>b.planned-a.planned||a.name.localeCompare(b.name,'pt-BR'));
  if(!state.purchaseInitialized&&purchaseGroups.length){
    state.purchaseOpen.add(purchaseGroups[0].name);state.purchaseInitialized=true;
  }
  const purchaseHeader='<thead><tr><th>Incluir</th><th>Código</th><th>Produto</th><th>UN</th><th>Falta 60d</th>'+
    '<th>Reserva Chuá</th><th>Transferir CDI</th><th>Outras transf.</th><th>Compra sugerida</th><th>Comprar</th>'+
    '<th>'+(single?'Entrega única':'1ª entrega')+'</th><th class="pc-second-delivery">2ª entrega</th>'+
    '<th>Custo ref.</th><th>Valor</th><th>Prioridade</th></tr></thead>';
  const purchaseGroupHtml=purchaseGroups.map(g=>{
    const open=state.purchaseOpen.has(g.name),sorted=g.items.slice().sort((a,b)=>
      edited(b).value-edited(a).value||b.buy*b.price-a.buy*a.price||
      a.product.localeCompare(b.product,'pt-BR')||a.code.localeCompare(b.code,'pt-BR'));
    const limit=state.purchaseShown.get(g.name)||80;
    const visible=open?sorted.slice(0,limit):[];
    const body=open?'<div class="pc-scroll"><table>'+purchaseHeader+'<tbody>'+
      visible.map(purchaseItemRow).join('')+'</tbody></table></div>'+
      '<div class="pc-footer"><span>'+integer(visible.length)+' de '+integer(sorted.length)+' itens do grupo. '+
      'Valores da compra consolidada para o CDI 30115.</span>'+
      (sorted.length>limit?'<button type="button" class="pc-btn" data-pc-purchase-more="'+esc(g.name)+'">Mostrar mais itens</button>':'')+
      '</div>':'';
    return '<section class="pc-group" data-pc-purchase-group="'+esc(g.name)+'">'+
      '<button type="button" class="pc-group-toggle" data-pc-purchase-toggle="'+esc(g.name)+'" aria-expanded="'+(open?'true':'false')+'">'+
      '<span class="pc-group-label"><span class="pc-group-arrow">'+(open?'▾':'▸')+'</span>'+
      '<b>'+esc(g.name)+'</b><span class="pc-group-count">'+integer(g.items.length)+' itens</span></span>'+
      '<span class="pc-group-values"><span>Compra CDI: <strong>'+cash(g.planned)+'</strong></span>'+
      '<span>Selecionado: '+cash(g.selected)+'</span><span>'+(single?'Entrega única: ':'1ª entrega: ')+cash(g.first)+'</span>'+
      '<span class="pc-second-delivery">2ª entrega: '+cash(g.second)+'</span></span></button>'+body+'</section>';
  }).join('');
  const locs=p.localSummary.filter(l=>!state.local||l.name===state.local).map(l=>{
    const rows=l.rows.filter(localInScope).sort((a,b)=>b.buy*b.price-a.buy*a.price);
    if(!rows.length)return '';
    const purchase=rows.reduce((total,x)=>total+x.buy*x.price,0);
    return '<details class="pc-location"><summary>'+esc(l.name)+
    '<small>'+integer(rows.length)+' códigos com demanda · compra projetada '+cash(purchase)+'</small></summary>'+
    '<div class="pc-scroll"><table><thead><tr><th>Código</th><th>Produto</th><th>UN</th><th>Média/mês</th><th>Saldo</th>'+
    '<th>Meta 60d</th><th>Falta 60d</th><th>Receber CDI</th><th>Outras transf.</th><th>Compra</th>'+
    '<th>'+(single?'Entrega única':'1ª entrega')+'</th><th class="pc-second-delivery">2ª entrega</th></tr></thead><tbody>'+
    rows.map(x=>'<tr><td>'+esc(x.code)+'</td><td>'+esc(x.product)+'</td><td>'+esc(x.un)+'</td>'+
      '<td class="num">'+fmt(x.average)+'</td><td class="num">'+fmt(x.stock)+'</td><td class="num">'+fmt(x.target60)+'</td>'+
      '<td class="num">'+fmt(x.needed)+'</td><td class="num">'+fmt(x.receivedChua)+'</td><td class="num">'+fmt(x.receivedOther)+'</td>'+
      '<td class="num"><b>'+fmt(x.buy)+'</b></td><td class="num">'+fmt(firstQty(x))+
    '</td><td class="num pc-second-delivery">'+fmt(secondQty(x))+'</td></tr>').join('')+
    '</tbody></table></div></details>';
  }).join('');
  const audit=p.review.filter(x=>(!state.local||x.local===state.local)&&(!state.group||x.group===state.group)&&
    (!state.product||x.sku===state.product)&&(!state.query||norm([x.code,x.product,x.group,x.local].join(' ')).includes(norm(state.query))))
    .sort((a,b)=>b.value-a.value).slice(0,100).map(x=>
    '<tr><td>'+esc(x.local)+'</td><td>'+esc(x.code)+'</td><td>'+esc(x.product)+'</td><td>'+esc(x.un)+'</td>'+
    '<td class="num">'+fmt(x.stock)+'</td><td class="num">'+integer(x.active)+'</td><td>'+esc(x.reason)+'</td>'+
    '<td class="num">'+cash(x.value)+'</td></tr>').join('');
  const destRows=filtered.flatMap(e=>allocationFor(e).rows.filter(x=>x.total>0)
    .map(x=>({...x,price:e.price}))).sort((a,b)=>
      Number(a.localCode!=='30115')-Number(b.localCode!=='30115')||
      a.local.localeCompare(b.local,'pt-BR')||a.code.localeCompare(b.code,'pt-BR'));
  const reserveCount=destRows.filter(x=>x.localCode==='30115').length;
  const destHtml=destRows.slice(0,500).map(x=>'<tr><td>'+esc(x.kind)+'</td>'+
    '<td>'+esc(x.localCode)+'</td><td>'+esc(x.local)+'</td><td>'+esc(x.code)+'</td>'+
    '<td>'+esc(x.product)+'</td><td>'+esc(x.unit)+'</td>'+
    '<td class="num">'+fmt(x.first)+'</td><td class="num pc-second-delivery">'+fmt(x.second)+'</td>'+
    '<td class="num"><b>'+fmt(x.total)+'</b></td>'+
    '<td class="num">'+cash(x.total*x.price)+'</td></tr>').join('');
  $('#pc-details').innerHTML='<div class="pc-panel"><div class="pc-title"><h3>1. Pedido centralizado para CDI · local 30115</h3>'+
    '<small>'+integer(purchaseGroups.length)+' grupos · '+integer(filtered.length)+' itens no filtro · clique no grupo para abrir os produtos</small></div>'+
    '<div class="pc-group-list">'+(purchaseGroupHtml||'<div class="pc-empty">Nenhum item encontrado.</div>')+'</div>'+
    '<div class="pc-footer">Grupos ordenados pelo maior valor da compra. Dentro do grupo, itens ordenados pelo valor. '+
    'Ajustes ficam nesta sessão; exporte antes de fechar.</div></div>'+
    '<div class="pc-panel"><div class="pc-title"><h3>2. Destinação do material comprado no CDI</h3>'+
    '<small>'+integer(destRows.length)+' alocações previstas · '+integer(reserveCount)+' reservas internas da Chuá</small></div>'+
    '<div class="pc-scroll"><table><thead><tr><th>Tipo</th><th>Local destino</th><th>Fazenda</th><th>Código</th>'+
    '<th>Produto</th><th>UN</th><th>'+(single?'Entrega única':'1ª entrega')+
    '</th><th class="pc-second-delivery">2ª entrega</th><th>Total previsto</th><th>Valor ref.</th>'+
    '</tr></thead><tbody>'+destHtml+'</tbody></table></div>'+
    '<div class="pc-footer">Compra recebida no CDI 30115. A reserva Chuá permanece no próprio saldo; distribuição às fazendas somente após entrada e transferência formal. '+ 
    'Exibidas até 500 alocações. Exportar CSV para lista integral.</div></div>'+
    '<div class="pc-panel"><div class="pc-title"><h3>3. Planejamento de abastecimento por fazenda</h3><small>Consumo e distribuição a partir do CDI</small></div>'+
    (locs||'<div class="pc-empty">Sem demanda para reposição.</div>')+'</div>'+
    '<div class="pc-panel"><div class="pc-title"><h3>4. Revisões antes de comprar ou realocar</h3>'+
    '<small>'+integer(audit.length)+' posições exibidas no filtro · revisão de histórico ou unidades</small></div>'+
    '<div class="pc-scroll"><table><thead><tr><th>Local</th><th>Código</th><th>Produto</th><th>UN</th><th>Saldo</th>'+
    '<th>Meses com baixas</th><th>Motivo</th><th>Valor em estoque</th></tr></thead><tbody>'+audit+'</tbody></table></div>'+
    '<div class="pc-footer">Exibidas as 100 posições de maior valor para revisão. Não são compras automáticas.</div></div>'+
    '<div class="pc-note">O planejamento é um rascunho gerencial. Confirme prazos de fornecimento, custos, estoque, demanda e empresa fiscal. '+
    'A aprovação e emissão de pedidos continuam sendo feitas no ERP. O dashboard não grava pedidos nem movimenta estoques.</div>';
  window.DB_PROGRAMMED_PURCHASES.meta={
    months:2,stockDate:p.stockDate,sourceMonths:22,closedThrough:'31/10/2026',physicalChuaOnlyOnce:p.cdiUnique,
    localChuaReserved:true,otherTransfers:state.otherTransfers,automaticOrders:false,
    grossValue:t.gross,chuaTransferValue:t.chua,otherTransferValue:t.others,purchaseValue:t.buy,
    firstDeliveryValue:plannedFirst,secondDeliveryValue:plannedSecond,
    firstDate:state.date1,secondDate:secondDate,deliveryMode:state.deliveryMode,
    deliveryCount:single?1:2,deliveryHorizonMonths:2,oneDeliveryIncludesFull60Days:single,
    calculatedPurchaseValueUnchanged:t.buy,
    chosenValue:chosen.value,items:p.lines.length,urgentItems:t.urgent,historyReviewItems:t.review,
    centralPurchaseDestination:'CDI DE PECAS',centralPurchaseLocal:'30115',centralPurchaseFiscalCompany:'003',
    purchaseReceivingOnlyAtCDI:true,transferAfterReceipt:true,internalChuaReservation:true,
    centralToChuaValue:t.reserveChua,centralToNetworkValue:t.distributeNetwork,
    editedCentralReserveValue:chosen.chua,editedCentralNetworkValue:chosen.network,
    editedCentralUnallocatedValue:chosen.surplus,editedUncoveredDemandValue:chosen.uncovered,
    centralAllocationRows:destRows.length,
    priceMissingItems:t.missing,exportFormats:['pedido-compra-recebimento-CDI','distribuicao-destinos','transferencias-saldo-existente'],
    cascadeLocal:state.local,cascadeGroup:state.group,cascadeProduct:state.product,
    cascadeSequence:['Fazenda','Grupo','Produto'],cascadeVisibleItems:filtered.length,
    cascadeScopedPurchaseValue:scope.buy,cascadeScopedGrossValue:scope.gross,
    cascadeScopedChuaTransferValue:scope.chua,cascadeScopedOtherTransferValue:scope.other,
    cascadeScopeRows:scope.rows,networkTotalsUnaffectedByCascade:true,
    purchaseHierarchy:['Grupo','Item'],groupedPurchaseView:true,
    purchaseGroups:purchaseGroups.length,groupedPurchaseItemCount:filtered.length,
    groupedPurchaseValue:purchaseGroups.reduce((v,g)=>v+g.planned,0),
    purchaseOpenedGroups:[...state.purchaseOpen].filter(n=>purchaseMap.has(n)),
    selectedFirstDeliveryValue:p.lines.reduce((v,e)=>v+edited(e).first*e.price,0),
    selectedSecondDeliveryValue:p.lines.reduce((v,e)=>v+edited(e).second*e.price,0)};
}
function exportPlan(mode){
  const p=state.plan;if(!p)return;
  const date=isoDate(new Date()),name='compras_programadas_CDI_30115_'+date;
  if(mode==='consolidado'){
    const rows=[['Local de COMPRA/RECEBIMENTO','Destino fiscal a confirmar','Código','Produto','Grupo','UN',
      'Falta bruta 60 dias','Reserva histórica Chuá 60 dias','Saldo físico 30115','Saldo livre CDI anterior',
      'Transferência de saldo anterior Chuá/CDI','Transferências de outras fazendas','Compra CDI calculada 60 dias',
      'Compra CDI ajustada','1ª entrega no CDI','2ª entrega no CDI','Destinar compra à Chuá',
      'Destinar compra às outras unidades','Saldo não alocado no CDI','Custo referência ERP (R$)',
      'Fonte do custo','Valor estimado (R$)','Prioridade','Unidades atendidas pelo CDI',
      'Data entrega 1','Data entrega 2','Data posição ERP','Fluxo','Modalidade de entrega']];
    for(const e of p.lines.filter(inScope)){const a=edited(e);if(!a.checked||a.final<=0)continue;
      const allocation=allocationFor(e);
      rows.push([CENTRAL_CDI_LOCAL,CENTRAL_CDI_FISCAL,e.code,e.product,e.group,e.un,
        e.gross,e.chuaReserve,e.chuaStock,e.chuaFree,e.fromChua,e.fromOther,
        e.buy,allocation.final,allocation.first,allocation.second,allocation.reserve,allocation.distribute,
        allocation.surplus,e.price,e.priceSource,allocation.value,e.urgent?'PRIORITÁRIO':'PROGRAMADO',
        allocation.rows.filter(x=>x.total>0).map(x=>x.local+' ('+x.kind+')').join(' | '),
        state.date1,isSingleDelivery()?'':state.date2,p.stockDate,
        'Receber tudo no CDI 30115; reservar Chuá e distribuir por TOP 94',
        isSingleDelivery()?'ENTREGA ÚNICA - 60 DIAS':'DUAS ENTREGAS - 30 + 30 DIAS']);}
    csv(name+'_pedido_compra_recebimento_CDI.csv',rows);return;
  }
  if(mode==='fazenda'){
    const rows=[['Local de recebimento da COMPRA','Código local destino','Fazenda destino','Tipo de destinação',
      'Código','Produto','Grupo','UN','Quantidade calculada antes de ajustes','1ª entrega programada',
      '2ª entrega programada','Total a reservar/distribuir','Custo referência ERP','Valor de destino previsto',
      'Procedimento de movimentação','Data entrega CDI 1','Data entrega CDI 2','Posição ERP']];
    for(const e of p.lines.filter(inScope)){
      for(const x of allocationFor(e).rows.filter(x=>x.total>0&&localInScope(x))){
        rows.push([CENTRAL_CDI_LOCAL,x.localCode,x.local,x.kind,x.code,x.product,x.group,x.unit,x.planned,
          x.first,x.second,x.total,x.price,x.total*x.price,
          x.kind==='RESERVA INTERNA CHUA'?'Reservar em 30115, sem nova entrada':'Após entrada em 30115, emitir TOP 94 se aplicável',
          state.date1,isSingleDelivery()?'':state.date2,p.stockDate]);
      }
    }
    csv(name+'_distribuicao_destinos.csv',rows);return;
  }
  const rows=[['Origem','Destino','Código','Produto','UN','Quantidade sugerida','Custo referência (R$)','Tipo','Observação']];
  for(const x of p.transfers.filter(transferInScope))rows.push([x.source,x.dest,x.code,x.product,x.un,x.q,x.price,x.kind,
    'Movimentação sugerida sobre SALDO ATUAL, independente das novas compras CDI. Conferir disponibilidade, empresa fiscal e TOP 94; não registrar economia realizada']);
  csv(name+'_transferencias_saldo_existente.csv',rows);
}
$('#pc-query').addEventListener('input',e=>{state.query=e.target.value;state.limit=100;redraw()});
$('#pc-local').addEventListener('change',e=>{state.local=e.target.value;state.group='';state.product='';
  state.limit=100;state.purchaseOpen.clear();state.purchaseInitialized=false;refreshCascade();redraw()});
$('#pc-group').addEventListener('change',e=>{state.group=e.target.value;state.product='';
  state.limit=100;if(state.group)state.purchaseOpen.add(state.group);refreshCascade();redraw()});
$('#pc-product').addEventListener('change',e=>{state.product=e.target.value;state.limit=100;
  const sku=state.plan?.lines.find(x=>x.id===state.product);if(sku)state.purchaseOpen.add(sku.group);
  redraw()});
$('#pc-clear').addEventListener('click',()=>{state.local='';state.group='';state.product='';
  state.query='';state.onlyUrgent=false;state.limit=100;$('#pc-query').value='';
  $('#pc-urgent-only').checked=false;refreshCascade();redraw()});
$('#pc-other').addEventListener('change',e=>{state.otherTransfers=e.target.checked;state.dirty=true;state.limit=100;redraw()});
$('#pc-urgent-only').addEventListener('change',e=>{state.onlyUrgent=e.target.checked;state.limit=100;redraw()});
for(const k of ['1','2'])$('#pc-date'+k).addEventListener('change',e=>{state['date'+k]=e.target.value;redraw()});
$('#pc-delivery-mode').addEventListener('change',e=>{
  state.deliveryMode=e.target.value==='single'?'single':'two';
  syncDeliveryForm();
  redraw();
});
$('#pc-export').addEventListener('click',()=>exportPlan('consolidado'));
$('#pc-export-farm').addEventListener('click',()=>exportPlan('fazenda'));
$('#pc-export-transfer').addEventListener('click',()=>exportPlan('transferencias'));
view.addEventListener('click',e=>{
  const target=e.target;
  const toggle=target.closest('[data-pc-purchase-toggle]');
  if(toggle){
    const name=toggle.dataset.pcPurchaseToggle;
    if(state.purchaseOpen.has(name))state.purchaseOpen.delete(name);else state.purchaseOpen.add(name);
    redraw();return;
  }
  const more=target.closest('[data-pc-purchase-more]');
  if(more){
    const name=more.dataset.pcPurchaseMore;
    state.purchaseShown.set(name,(state.purchaseShown.get(name)||80)+80);
    redraw();return;
  }
});
view.addEventListener('change',e=>{
  const el=e.target;if(el.matches('[data-pc-select]')){state.selected.set(el.dataset.pcSelect,el.checked);redraw()}
  else if(el.matches('[data-pc-qty]')){const id=el.dataset.pcQty,sku=state.plan.lines.find(x=>x.id===id);
    if(!sku)return;state.override.set(id,roundUp(Math.max(0,num(el.value)),sku.un));redraw()}
});
tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  tab.classList.add('active');view.classList.add('active');redraw();
});
const refresh=()=>{state.dirty=true;if(view.classList.contains('active'))redraw()};
for(const event of ['stock-position-updated','movements-updated','minimum-policy-updated'])window.addEventListener(event,refresh);
window.DB_PROGRAMMED_PURCHASES={open:()=>tab.click(),refresh,getPlan:()=>state.plan,
  allocationFor:sku=>{const e=state.plan?.lines.find(x=>x.id===sku);return e?allocationFor(e):null},
  meta:null,version:'20261112-cdi-entrega-unica-ou-dupla-v5'};
})();