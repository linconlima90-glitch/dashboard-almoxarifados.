// Planejamento de compras para 60 dias. Consultivo; nao emite pedido ERP.
(function(){
'use strict';
if(window.DB_PROGRAMMED_PURCHASES)return;
const tabs=document.querySelector('.tabs'),wrap=document.querySelector('.wrap');
if(!tabs||!wrap)return;
const tab=document.createElement('button');tab.type='button';tab.className='tab';
tab.dataset.view='compras-programadas';tab.textContent='Compras Programadas · 2 meses';tabs.appendChild(tab);
const view=document.createElement('section');view.id='view-compras-programadas';view.className='view';wrap.appendChild(view);
const state={query:'',group:'',onlyUrgent:false,otherTransfers:true,limit:100,selected:new Map(),override:new Map(),dirty:true,plan:null};
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
const future=days=>{const d=new Date();d.setDate(d.getDate()+days);return isoDate(d)};
state.date1=future(7);state.date2=future(37);
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
'#view-compras-programadas .pc-filters .pc-toggle{flex-direction:row;align-items:center;min-height:36px;max-width:240px;line-height:1.5}'+
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
'#view-compras-programadas .pc-empty{padding:18px;color:#708277;text-align:center}'+
'@media(max-width:1000px){#view-compras-programadas .pc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}'+
'@media(max-width:600px){#view-compras-programadas .pc-kpis{grid-template-columns:1fr}#view-compras-programadas .pc-filters label{width:100%}}';
document.head.appendChild(css);
view.innerHTML='<div class="pc-head"><h2>Compras Programadas · Rede DB</h2>'+
'<p>Projeção para 2 meses, em duas entregas. A Chuá e o CDI compartilham um único saldo físico 30115: '+
'primeiro é reservada a demanda da fazenda e somente o restante pode abastecer as demais unidades. '+
'Não são emitidos pedidos automaticamente.</p></div>'+
'<div class="pc-filters"><label class="pc-search">Buscar código, produto, grupo ou fazenda<input id="pc-query" type="search" placeholder="Pesquisar na compra consolidada"></label>'+
'<label>Grupo<select id="pc-group"><option value="">Todos os grupos</option></select></label>'+
'<label>Entrega 1<input id="pc-date1" type="date"></label><label>Entrega 2<input id="pc-date2" type="date"></label>'+
'<label class="pc-toggle"><input id="pc-other" type="checkbox" checked> Usar excedentes confiáveis de outras fazendas</label>'+
'<label class="pc-toggle"><input id="pc-urgent-only" type="checkbox"> Somente itens prioritários</label>'+
'<button type="button" class="pc-btn pc-primary" id="pc-export">Exportar compra consolidada</button>'+
'<button type="button" class="pc-btn" id="pc-export-farm">Exportar por fazenda</button>'+
'<button type="button" class="pc-btn" id="pc-export-transfer">Exportar transferências</button></div>'+
'<div id="pc-overview"></div><div id="pc-details"></div>';
const $=s=>view.querySelector(s);
$('#pc-date1').value=state.date1;$('#pc-date2').value=state.date2;
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
        transfers.push({source:chua.local,dest:x.local,code:e.code,product:e.product,un:e.un,q,kind:'CHUA/CDI',price:e.price});
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
          transfers.push({source:d.local,dest:x.local,code:e.code,product:e.product,un:e.un,q,kind:'OUTRA FAZENDA',price:e.price});
        }
      }
    }
    e.gross=0;e.fromChua=0;e.fromOther=0;e.buy=0;e.first=0;e.second=0;e.needLocations=[];
    for(const x of locations){
      x.buy=Math.max(0,round(x.pending,e.un));
      const postTransfer=x.stock+x.receivedChua+x.receivedOther;
      x.first=Math.min(x.buy,roundUp(Math.max(0,x.target30-postTransfer),e.un));
      x.second=Math.max(0,round(x.buy-x.first,e.un));
      e.gross+=x.needed;e.fromChua+=x.receivedChua;e.fromOther+=x.receivedOther;
      e.buy+=x.buy;e.first+=x.first;e.second+=x.second;
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
  const totals={gross:0,chua:0,others:0,buy:0,first:0,second:0,missing:0,urgent:0,review:review.length,reviewStock:0};
  // Incluir tambem codigos 100% supridos por transferencia, para que o
  // resumo feche: falta bruta = CDI + outras transferencias + compra liquida.
  for(const e of allSkus){
    totals.gross+=e.gross*e.price;totals.chua+=e.fromChua*e.price;totals.others+=e.fromOther*e.price;
    totals.buy+=e.buy*e.price;totals.first+=e.first*e.price;totals.second+=e.second*e.price;
    if(e.buy>0&&e.urgent)totals.urgent++;if(e.buy>0&&!e.price)totals.missing++;
  }
  totals.reviewStock=review.reduce((v,x)=>v+x.value,0);
  return {lines,totals,transfers,review,localSummary:[...localSummary.values()].filter(x=>x.rows.length).sort((a,b)=>b.value-a.value),
    stockDate:str(window.CURRENT_STOCK_META?.emissao),months:22,period:'01/01/2025 a 31/10/2026',cdiUnique:true,skusCount:allSkus.length};
}
const edited=e=>{const checked=state.selected.get(e.id)!==false,q=checked?(state.override.has(e.id)?state.override.get(e.id):e.buy):0,
  final=Math.max(0,round(q,e.un)),first=Math.min(final,e.first);return {checked,final,first,second:Math.max(0,round(final-first,e.un)),value:final*e.price}};
const csvField=v=>'"'+str(v??'').replace(/"/g,'""')+'"';
function csv(name,data){const content='\ufeff'+data.map(row=>row.map(csvField).join(';')).join('\r\n'),
  url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),400)}
function redraw(){
  if(!ready()){$('#pc-overview').innerHTML='<div class="pc-note">Preparando histórico e estoque. Reabra esta aba após carregar a plataforma.</div>';return}
  if(state.dirty||!state.plan){state.plan=compute();state.dirty=false;
    const groups=[...new Set(state.plan.lines.map(x=>x.group))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    $('#pc-group').innerHTML='<option value="">Todos os grupos</option>'+groups.map(g=>'<option value="'+esc(g)+'">'+esc(g)+'</option>').join('');
    if(!groups.includes(state.group))state.group='';$('#pc-group').value=state.group;
  }
  const p=state.plan,t=p.totals,needle=norm(state.query);
  const filtered=p.lines.filter(e=>(!state.group||e.group===state.group)&&(!state.onlyUrgent||e.urgent)&&
    (!needle||norm([e.code,e.product,e.group,...e.needLocations.map(x=>x.local)].join(' ')).includes(needle)));
  const chosen=p.lines.reduce((a,e)=>{const x=edited(e);a.value+=x.value;a.items+=(x.final>0?1:0);return a},{value:0,items:0});
  const card=(label,value,note,highlight=false)=>'<div class="pc-kpi'+(highlight?' important':'')+'"><span>'+label+'</span><strong>'+
    value+'</strong><small>'+note+'</small></div>';
  $('#pc-overview').innerHTML='<div class="pc-kpis">'+
    card('Falta bruta da rede · 60 dias',cash(t.gross),'Antes das transferências')+
    card('Atendimento pelo estoque livre Chuá/CDI',cash(t.chua),'Reserva própria da Chuá preservada')+
    card('Excedentes confiáveis de outras unidades',cash(t.others),'Transferências sugeridas')+
    card('Compra líquida calculada · 60 dias',cash(t.buy),integer(p.lines.length)+' produtos para cotar',true)+
    card('1ª entrega · primeiro mês',cash(t.first),esc(state.date1))+
    card('2ª entrega · completar 60 dias',cash(t.second),esc(state.date2))+
    card('Compra selecionada após ajustes',cash(chosen.value),integer(chosen.items)+' produtos selecionados',true)+
    card('Pendências para análise',integer(t.review),integer(t.missing)+' produtos sem custo de referência')+
    '</div><div class="pc-note"><b>Período da média:</b> '+p.period+' (22 meses completos). <b>Estoque:</b> '+esc(p.stockDate)+
    '. Meta = média mensal × 2 meses. Excluídos: pneus, câmaras, cimento e granjas ainda fora do controle. '+
    'Falta de histórico (menos de 3 meses com baixas) ou unidade divergente: não gera compra nem transferência automática. '+
    'Valores pelo custo ERP disponível (ou histórico indicado), sujeitos a nova cotação. Transferências precisam de verificação física e fiscal; não são economia realizada.</div>';
  const rows=filtered.slice(0,state.limit).map(e=>{const a=edited(e);
    return '<tr><td><input type="checkbox" data-pc-select="'+esc(e.id)+'" '+(a.checked?'checked':'')+'></td>'+
    '<td>'+esc(e.code)+'</td><td class="pc-description"><b>'+esc(e.product)+'</b><small>'+esc(e.group)+'</small></td><td>'+esc(e.un)+'</td>'+
    '<td class="num">'+fmt(e.gross)+'</td><td class="num">'+fmt(e.chuaReserve)+'</td><td class="num">'+fmt(e.fromChua)+'</td>'+
    '<td class="num">'+fmt(e.fromOther)+'</td><td class="num"><b>'+fmt(e.buy)+'</b></td>'+
    '<td><input class="pc-qty" type="number" min="0" step="'+(continuous.has(e.un)?'0.01':'1')+
    '" data-pc-qty="'+esc(e.id)+'" value="'+a.final+'"></td><td class="num">'+fmt(a.first)+'</td><td class="num">'+fmt(a.second)+'</td>'+
    '<td class="num">'+(e.price?cash(e.price):'Cotar')+'</td><td class="num"><b>'+cash(a.value)+'</b></td>'+
    '<td class="'+(e.urgent?'pc-urgent':'')+'">'+(e.urgent?'PRIORITÁRIO':'PROGRAMADO')+'</td></tr>';
  }).join('');
  const locs=p.localSummary.map(l=>'<details class="pc-location"><summary>'+esc(l.name)+
    '<small>'+integer(l.rows.length)+' códigos com demanda · compra projetada '+cash(l.value)+'</small></summary>'+
    '<div class="pc-scroll"><table><thead><tr><th>Código</th><th>Produto</th><th>UN</th><th>Média/mês</th><th>Saldo</th>'+
    '<th>Meta 60d</th><th>Falta 60d</th><th>Receber CDI</th><th>Outras transf.</th><th>Compra</th><th>1ª entrega</th><th>2ª entrega</th></tr></thead><tbody>'+
    l.rows.sort((a,b)=>b.buy-a.buy).map(x=>'<tr><td>'+esc(x.code)+'</td><td>'+esc(x.product)+'</td><td>'+esc(x.un)+'</td>'+
      '<td class="num">'+fmt(x.average)+'</td><td class="num">'+fmt(x.stock)+'</td><td class="num">'+fmt(x.target60)+'</td>'+
      '<td class="num">'+fmt(x.needed)+'</td><td class="num">'+fmt(x.receivedChua)+'</td><td class="num">'+fmt(x.receivedOther)+'</td>'+
      '<td class="num"><b>'+fmt(x.buy)+'</b></td><td class="num">'+fmt(x.first)+'</td><td class="num">'+fmt(x.second)+'</td></tr>').join('')+
    '</tbody></table></div></details>').join('');
  const audit=p.review.slice().sort((a,b)=>b.value-a.value).slice(0,100).map(x=>
    '<tr><td>'+esc(x.local)+'</td><td>'+esc(x.code)+'</td><td>'+esc(x.product)+'</td><td>'+esc(x.un)+'</td>'+
    '<td class="num">'+fmt(x.stock)+'</td><td class="num">'+integer(x.active)+'</td><td>'+esc(x.reason)+'</td>'+
    '<td class="num">'+cash(x.value)+'</td></tr>').join('');
  $('#pc-details').innerHTML='<div class="pc-panel"><div class="pc-title"><h3>1. Pedido consolidado por código / unidade</h3>'+
    '<small>'+integer(filtered.length)+' itens no filtro · editar quantidades e selecionar para CSV</small></div>'+
    '<div class="pc-scroll"><table><thead><tr><th>Incluir</th><th>Código</th><th>Produto / grupo</th><th>UN</th><th>Falta 60d</th>'+
    '<th>Reserva Chuá</th><th>Transferir CDI</th><th>Outras transf.</th><th>Compra sugerida</th><th>Comprar</th>'+
    '<th>1ª entrega</th><th>2ª entrega</th><th>Custo ref.</th><th>Valor</th><th>Prioridade</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="pc-footer"><span>Mostrando '+integer(Math.min(filtered.length,state.limit))+' de '+integer(filtered.length)+
    '. Ajustes ficam nesta sessão; exporte antes de fechar.</span>'+
    (filtered.length>state.limit?'<button class="pc-btn" id="pc-more">Mostrar mais 100</button>':'')+'</div></div>'+
    '<div class="pc-panel"><div class="pc-title"><h3>2. Planejamento de abastecimento por fazenda</h3><small>Consumo e transferências por local</small></div>'+
    (locs||'<div class="pc-empty">Sem demanda para reposição.</div>')+'</div>'+
    '<div class="pc-panel"><div class="pc-title"><h3>3. Revisões antes de comprar ou realocar</h3>'+
    '<small>'+integer(t.review)+' posições sem histórico suficiente ou com unidades incompatíveis</small></div>'+
    '<div class="pc-scroll"><table><thead><tr><th>Local</th><th>Código</th><th>Produto</th><th>UN</th><th>Saldo</th>'+
    '<th>Meses com baixas</th><th>Motivo</th><th>Valor em estoque</th></tr></thead><tbody>'+audit+'</tbody></table></div>'+
    '<div class="pc-footer">Exibidas as 100 posições de maior valor para revisão. Não são compras automáticas.</div></div>'+
    '<div class="pc-note">O planejamento é um rascunho gerencial. Confirme prazos de fornecimento, custos, estoque, demanda e empresa fiscal. '+
    'A aprovação e emissão de pedidos continuam sendo feitas no ERP. O dashboard não grava pedidos nem movimenta estoques.</div>';
  window.DB_PROGRAMMED_PURCHASES.meta={
    months:2,stockDate:p.stockDate,sourceMonths:22,closedThrough:'31/10/2026',physicalChuaOnlyOnce:p.cdiUnique,
    localChuaReserved:true,otherTransfers:state.otherTransfers,automaticOrders:false,
    grossValue:t.gross,chuaTransferValue:t.chua,otherTransferValue:t.others,purchaseValue:t.buy,
    firstDeliveryValue:t.first,secondDeliveryValue:t.second,firstDate:state.date1,secondDate:state.date2,
    chosenValue:chosen.value,items:p.lines.length,urgentItems:t.urgent,historyReviewItems:t.review,
    priceMissingItems:t.missing,exportFormats:['consolidado','por-fazenda','transferencias']};
}
function exportPlan(mode){
  const p=state.plan;if(!p)return;
  const date=isoDate(new Date()),name='compras_programadas_rede_'+date;
  if(mode==='consolidado'){
    const rows=[['Código','Produto','Grupo','UN','Falta bruta 60 dias','Reserva Chuá 60 dias','Saldo Chuá',
      'Saldo livre Chuá para CDI','Transferência Chuá/CDI','Transferência outras fazendas',
      'Compra calculada 60 dias','Comprar ajustado','Entrega 1 quantidade','Entrega 2 quantidade','Custo referência ERP (R$)',
      'Fonte do custo','Valor estimado (R$)','Prioridade','Destinos','Data entrega 1','Data entrega 2','Data posição ERP']];
    for(const e of p.lines){const a=edited(e);if(!a.checked||a.final<=0)continue;
      rows.push([e.code,e.product,e.group,e.un,e.gross,e.chuaReserve,e.chuaStock,e.chuaFree,e.fromChua,e.fromOther,
        e.buy,a.final,a.first,a.second,e.price,e.priceSource,a.value,e.urgent?'PRIORITÁRIO':'PROGRAMADO',
        e.needLocations.map(x=>x.local).join(' | '),state.date1,state.date2,p.stockDate]);}
    csv(name+'_consolidado.csv',rows);return;
  }
  if(mode==='fazenda'){
    const rows=[['Fazenda','Código','Produto','Grupo','UN','Média por mês','Meses com baixas','Saldo atual',
      'Meta 30 dias','Meta 60 dias','Falta 60 dias','Receber Chuá/CDI','Receber outras fazendas',
      'Compra 60 dias','Entrega 1','Entrega 2','Data posição ERP']];
    for(const l of p.localSummary)for(const x of l.rows)
      rows.push([x.local,x.code,x.product,x.group,x.un,x.average,x.active,x.stock,x.target30,x.target60,
        x.needed,x.receivedChua,x.receivedOther,x.buy,x.first,x.second,p.stockDate]);
    csv(name+'_por_fazenda.csv',rows);return;
  }
  const rows=[['Origem','Destino','Código','Produto','UN','Quantidade sugerida','Custo referência (R$)','Tipo','Observação']];
  for(const x of p.transfers)rows.push([x.source,x.dest,x.code,x.product,x.un,x.q,x.price,x.kind,
    'Conferir disponibilidade, unidade fiscal e TOP 94; não registrar como economia realizada']);
  csv(name+'_transferencias.csv',rows);
}
$('#pc-query').addEventListener('input',e=>{state.query=e.target.value;state.limit=100;redraw()});
$('#pc-group').addEventListener('change',e=>{state.group=e.target.value;state.limit=100;redraw()});
$('#pc-other').addEventListener('change',e=>{state.otherTransfers=e.target.checked;state.dirty=true;state.limit=100;redraw()});
$('#pc-urgent-only').addEventListener('change',e=>{state.onlyUrgent=e.target.checked;state.limit=100;redraw()});
for(const k of ['1','2'])$('#pc-date'+k).addEventListener('change',e=>{state['date'+k]=e.target.value;redraw()});
$('#pc-export').addEventListener('click',()=>exportPlan('consolidado'));
$('#pc-export-farm').addEventListener('click',()=>exportPlan('fazenda'));
$('#pc-export-transfer').addEventListener('click',()=>exportPlan('transferencias'));
view.addEventListener('click',e=>{if(e.target.id==='pc-more'){state.limit+=100;redraw()}});
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
window.DB_PROGRAMMED_PURCHASES={open:()=>tab.click(),refresh,getPlan:()=>state.plan,meta:null,version:'20261112-rede-60d-v1'};
})();