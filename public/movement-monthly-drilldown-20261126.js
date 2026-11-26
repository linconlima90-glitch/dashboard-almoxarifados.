// Consumo mensal e destinos por centro/placa em Estoque > Movimentacoes.
// O historico e a conciliacao de custos continuam independentes desta consulta.
(function(){
  'use strict';
  if(window.DB_MOVEMENT_MONTHLY)return;
  const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const sourceHash='e163e240a08fc4477932905abccec791f894ac925d0ab12247b0e4610cd55678';
  const periods={all:[2024,2025,2026],'2025-2026':[2025,2026],'2024':[2024],'2025':[2025],'2026':[2026]};
  const centers=new Map(),plates=new Map(),inflight=new Map();
  const text=v=>String(v??'');
  const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
  const qty=v=>fmt.format(Number(v)||0);
  let dialog=null,current=null,serial=0;
  async function fetchPack(year,type){
    const target=type==='plate'?plates:centers;
    const key=type+year;
    if(target.has(year))return target.get(year);
    if(inflight.has(key))return inflight.get(key);
    const promise=(async()=>{
      const path='/'+(type==='plate'?'centros-resultado-placas':'centros-resultado')+'-20261126-'+year+'.b64';
      const response=await fetch(path,{cache:'force-cache'});
      if(!response.ok)throw Error('Fonte '+year+' indisponível ('+response.status+')');
      if(typeof DecompressionStream==='undefined')throw Error('Navegador sem suporte a gzip');
      const b64=(await response.text()).trim();
      if(!/^[A-Za-z0-9+/=]+$/.test(b64))throw Error('Arquivo '+year+' inválido');
      const bytes=Uint8Array.from(atob(b64),x=>x.charCodeAt(0));
      const data=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
      const expected=year===2025?7315:13988;
      if(data.year!==year||data.sourceSHA256!==sourceHash||!data.dict||!Array.isArray(data.rows)||
         (type==='plate'?data.schema!==1||data.records!==expected:data.schema!==2||data.totalRecords!==expected))
        throw Error('Fonte de '+year+' não conferiu com a auditoria');
      const D=data.dict;
      if(!['local','product','unit','center'].every(k=>Array.isArray(D[k]))||
         (type==='plate'&&(!Array.isArray(D.plate)||!Array.isArray(D.vehicle))))
        throw Error('Dicionário de '+year+' incompleto');
      target.set(year,data);
      return data;
    })();
    inflight.set(key,promise);
    try{return await promise}finally{inflight.delete(key)}
  }
  function matchingRows(data,info,plate){
    const D=data.dict;
    const product=D.product.indexOf(info.codigo);
    const unit=D.unit.findIndex(x=>norm(x)===norm(info.un));
    const allowed=new Set(info.localCodes.map(text));
    if(product<0||unit<0)return [];
    const rows=[];
    for(const r of data.rows){
      const [m,li,pi,ui]=r;
      if(pi!==product||ui!==unit||!allowed.has(text(D.local[li]))||m<1||m>12)continue;
      rows.push({
        month:m,local:text(D.local[li]),center:text(D.center[r[4]]||'CENTRO NÃO INFORMADO'),
        plate:plate?text(D.plate[r[5]]||''):'',vehicle:plate?text(D.vehicle[r[6]]||''):'',
        value:Number(r[plate?7:5])||0
      });
    }
    return rows;
  }
  function monthlyTotals(list){
    const a=Array(12).fill(0);
    for(const r of list)if(r.month>=1&&r.month<=12)a[r.month-1]+=r.value;
    return a;
  }
  function historicalTotals(year,info){
    const a=Array(12).fill(0);
    for(const r of info.rows){
      if(Number(r.year)!==year)continue;
      const m=Number(text(r.month).slice(5,7));
      if(m>=1&&m<=12)a[m-1]+=Number(r.quantidade)||0;
    }
    return a;
  }
  function renderCharts(state){
    const years=state.years;
    const values=years.map(year=>({year,total:state.centerRows.has(year)?
      monthlyTotals(state.centerRows.get(year)):historicalTotals(year,state.info)}));
    const max=Math.max(1,...values.flatMap(x=>x.total.map(Math.abs)));
    const tip=years.some(year=>year>=2025)?
      '2025 e 2026 usam a planilha de baixas de 26/11/2026, por data de negociação; novembro de 2026 é parcial. '+
      'Os indicadores financeiros da aba Movimentações permanecem em sua base própria.':'';
    const intro='<div class="dbmov-context">Produto <strong>'+esc(state.info.codigo)+' · '+esc(state.info.produto)+
      '</strong> · Unidade: <strong>'+esc(state.info.un)+'</strong> · '+esc(state.info.localLabel)+'</div>'+
      '<p class="dbmov-note">Clique em uma barra para conferir os destinos do consumo. Meses sem baixas aparecem com zero. '+
      'Os centros, as placas e os veículos são mostrados somente quando constam no ERP. '+
      esc(tip)+'</p>';
    const charts=values.map(({year,total})=>{
      const end=year===2026&&state.centerRows.has(2026)?11:12;
      const bars=total.slice(0,end).map((val,index)=>{
        const partial=year===2026&&index===10;
        const height=Math.abs(val)>0?Math.max(4,Math.round(Math.abs(val)/max*140)):2;
        const aria=months[index]+' '+year+': '+qty(val)+' '+state.info.un+(partial?' (parcial)':'');
        return '<button type="button" class="dbmov-month" data-dbmov-year="'+year+'" data-dbmov-month="'+(index+1)+
          '" data-dbmov-value="'+val+'" aria-label="'+esc('Conferir '+aria)+'" title="'+esc(aria)+'">'+
          '<span class="dbmov-value">'+qty(val)+'</span>'+
          '<span class="dbmov-bar-space"><span class="dbmov-bar'+(partial?' is-partial':'')+(val===0?' is-zero':'')+
          '" style="height:'+height+'px"></span></span>'+
          '<span class="dbmov-month-name">'+months[index]+(partial?'*':'')+'</span></button>';
      }).join('');
      const sum=total.slice(0,end).reduce((a,b)=>a+b,0);
      const note=year===2024?'Histórico 2024: sem vínculo de centro de resultado e placa nesta consulta.':
        'Detalhamento por centro e placa: planilha de baixas de 26/11/2026.';
      return '<section class="dbmov-year"><div class="dbmov-year-heading"><h3>'+year+
        '</h3><small>Total: '+qty(sum)+' '+esc(state.info.un)+'</small></div>'+
        '<div class="dbmov-scroll"><div class="dbmov-bars" role="group" aria-label="Baixas mensais de '+year+'">'+bars+
        '</div></div><p class="dbmov-year-note">'+esc(note)+'</p></section>';
    }).join('');
    return intro+charts+'<section id="dbmov-destinations" class="dbmov-destinations" aria-live="polite" hidden></section>'+
      (years.includes(2026)?'<p class="dbmov-footnote">* Novembro de 2026 ainda parcial; não altera o estoque mínimo.</p>':'');
  }
  function details(state,year,month,chartTotal){
    const label=months[month-1]+' / '+year;
    const title='<h3>Destinos das baixas · '+esc(label)+'</h3>'+
      '<p>Produto '+esc(state.info.codigo)+' · '+esc(state.info.produto)+
      ' · total do mês: <strong>'+qty(chartTotal)+' '+esc(state.info.un)+'</strong></p>';
    if(!chartTotal)return title+'<p class="dbmov-empty">Não há baixas neste mês para os filtros selecionados.</p>';
    if(year===2024)return title+'<p class="dbmov-empty">O histórico de 2024 tem consumo mensal, '+
      'mas não contém vínculo conferido de centro de resultado, placa ou veículo. Nenhum destino foi estimado.</p>';
    const centerEntries=(state.centerRows.get(year)||[]).filter(x=>x.month===month);
    const plateEntries=(state.plateRows.get(year)||[]).filter(x=>x.month===month);
    if(!centerEntries.length)return title+'<p class="dbmov-empty">Não foram encontrados centros de resultado neste mês.</p>';
    const grouped=new Map();
    for(const r of centerEntries){
      const key=r.local+'|'+r.center;
      const x=grouped.get(key)||{local:r.local,center:r.center,qty:0,parts:[]};
      x.qty+=r.value;grouped.set(key,x);
    }
    for(const r of plateEntries){
      const key=r.local+'|'+r.center,x=grouped.get(key);
      if(!x)continue;
      const part=x.parts.find(y=>y.plate===r.plate&&y.vehicle===r.vehicle);
      if(part)part.qty+=r.value;else x.parts.push({plate:r.plate,vehicle:r.vehicle,qty:r.value});
    }
    const list=[...grouped.values()].sort((a,b)=>b.qty-a.qty||a.center.localeCompare(b.center,'pt-BR'));
    const localColumn=state.info.localCodes.length>1;
    let discrepancies=[];
    const cells=list.map(g=>{
      g.parts.sort((a,b)=>b.qty-a.qty||a.plate.localeCompare(b.plate,'pt-BR'));
      const sumPlate=g.parts.reduce((sum,x)=>sum+x.qty,0);
      if(Math.abs(sumPlate-g.qty)>.001)discrepancies.push(g.center+' ('+g.local+')');
      if(!g.parts.length)g.parts=[{plate:'',vehicle:'',qty:g.qty,missing:true}];
      return g.parts.map((p,i)=>'<tr>'+
        (i===0?'<td class="dbmov-center" rowspan="'+g.parts.length+'">'+esc(g.center)+
          '<small>Total: '+qty(g.qty)+' '+esc(state.info.un)+'</small></td>':'')+
        (localColumn&&i===0?'<td rowspan="'+g.parts.length+'">'+
          esc(state.info.localNames[g.local]||g.local)+'</td>':'')+
        '<td>'+esc(p.missing?'Identificação não conciliada':p.plate||'Sem placa informada')+'</td>'+
        '<td>'+esc(p.vehicle||'—')+'</td><td class="dbmov-number">'+qty(p.qty)+' '+
        esc(state.info.un)+'</td></tr>').join('');
    }).join('');
    const centerTotal=list.reduce((sum,x)=>sum+x.qty,0);
    const isMatch=Math.abs(centerTotal-chartTotal)<=.001&&discrepancies.length===0;
    const status=isMatch?'Quantidades conciliadas por centro e placa.':
      'Há diferença entre as fontes ou placas sem conciliação. Confira os dados do período.';
    return title+'<div class="dbmov-status'+(isMatch?' is-valid':'')+'">'+esc(status)+'</div>'+
      '<div class="dbmov-table-wrap"><table><thead><tr><th>Centro de resultado</th>'+
      (localColumn?'<th>Almoxarifado</th>':'')+
      '<th>Placa</th><th>Veículo / equipamento</th><th>Qtd. baixada</th></tr></thead><tbody>'+
      cells+'</tbody></table></div>'+
      '<p class="dbmov-source">Fonte: baixas ERP de 26/11/2026 · data de negociação. '+
      'Transferências não entram no consumo. Valores de estoque e reposição permanecem inalterados.</p>';
  }
  function ensureDialog(){
    if(dialog)return dialog;
    const d=document.createElement('dialog');
    d.className='dbmov-dialog';d.id='dbmov-monthly-dialog';d.setAttribute('aria-labelledby','dbmov-dialog-title');
    document.body.appendChild(d);
    d.addEventListener('click',event=>{
      const month=event.target.closest('button[data-dbmov-month]');
      if(month){
        if(!current)return;
        const year=Number(month.dataset.dbmovYear),m=Number(month.dataset.dbmovMonth);
        const slot=d.querySelector('#dbmov-destinations');
        if(!slot)return;
        slot.hidden=false;
        slot.innerHTML='<p class="dbmov-empty">Consultando centros e placas...</p>';
        const token=serial;
        (async()=>{
          if(year>=2025&&!current.plateRows.has(year)){
            try{const p=await fetchPack(year,'plate');current.plateRows.set(year,matchingRows(p,current.info,true))}
            catch(e){if(token===serial)slot.innerHTML='<p class="dbmov-empty">Falha ao consultar as placas: '+esc(e.message)+'</p>';return}
          }
          if(token!==serial||!d.open)return;
          slot.innerHTML=details(current,year,m,Number(month.dataset.dbmovValue));
          d.querySelectorAll('[data-dbmov-month]').forEach(b=>b.setAttribute('aria-pressed',b===month?'true':'false'));
          slot.scrollIntoView({block:'nearest'});
        })();
        return;
      }
      if(event.target.closest('[data-dbmov-close]')||event.target===d)d.close();
    });
    dialog=d;
    return d;
  }
  function installCss(){
    if(document.getElementById('dbmov-style'))return;
    const style=document.createElement('style');style.id='dbmov-style';
    style.textContent=[
      '.dbmov-dialog{box-sizing:border-box;width:min(970px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 32px);border:1px solid #badac3;border-radius:15px;padding:0;margin:auto;background:#fff;color:#14532f;box-shadow:0 25px 70px #0004;overflow:auto}',
      '.dbmov-dialog::backdrop{background:rgba(6,36,20,.65)}',
      '.dbmov-header{display:flex;justify-content:space-between;align-items:start;gap:15px;padding:17px 20px;background:#0b512d;border-bottom:3px solid #e3b811;color:white}',
      '.dbmov-header small{display:block;font-size:10px;letter-spacing:.08em;font-weight:800;color:#d3e8d9}',
      '.dbmov-header h2{font-size:20px;margin:6px 0 0;color:white;line-height:1.3}',
      '.dbmov-header button{border:1px solid #bfdac5;background:#fff;color:#155b32;border-radius:7px;padding:8px 11px;font-weight:800;cursor:pointer;flex:none}',
      '.dbmov-content{padding:16px 20px 24px}',
      '.dbmov-context{font-size:12px;margin-bottom:8px;line-height:1.6}',
      '.dbmov-note,.dbmov-year-note,.dbmov-footnote{font-size:11px;line-height:1.6;color:#57705f}',
      '.dbmov-year{border-top:1px solid #dce9e1;margin-top:20px;padding-top:12px}',
      '.dbmov-year-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}',
      '.dbmov-year h3{margin:0 0 8px;font-size:15px;color:#145633}',
      '.dbmov-year-heading small{font-size:12px;font-weight:800}',
      '.dbmov-scroll{overflow-x:auto;padding-bottom:6px}',
      '.dbmov-bars{display:grid;grid-template-columns:repeat(12,minmax(44px,1fr));gap:6px;min-width:640px;border-bottom:2px solid #cbe4d5;align-items:end}',
      '.dbmov-month{display:flex;flex-direction:column;align-items:center;justify-content:end;background:transparent;border:0;min-width:0;cursor:pointer;color:#15522c;font:inherit;padding:2px 0}',
      '.dbmov-month:hover,.dbmov-month[aria-pressed="true"]{background:#eaf7ee;border-radius:6px}',
      '.dbmov-month:focus-visible{outline:3px solid #e3b811;outline-offset:2px}',
      '.dbmov-value{font-size:10px;font-weight:800}',
      '.dbmov-bar-space{height:145px;width:72%;display:flex;align-items:end;justify-content:center}',
      '.dbmov-bar{display:block;width:100%;border-radius:5px 5px 0 0;background:#167c45}',
      '.dbmov-bar.is-partial{background:#d6a91c}',
      '.dbmov-bar.is-zero{background:#c6ddd0}',
      '.dbmov-month-name{font-size:11px;padding:6px 0 0;font-weight:800}',
      '.dbmov-destinations{margin-top:20px;border:1px solid #cbded0;background:#f8fbf9;padding:14px;border-radius:10px}',
      '.dbmov-destinations[hidden]{display:none}',
      '.dbmov-destinations h3{margin:0 0 5px;font-size:16px}',
      '.dbmov-destinations p{font-size:11px;line-height:1.5;margin:5px 0 10px}',
      '.dbmov-empty{padding:12px;border:1px dashed #bed4c4;border-radius:7px;background:white}',
      '.dbmov-status{padding:10px;margin:10px 0;background:#fff5d7;border-left:4px solid #d5a620;font-size:12px}',
      '.dbmov-status.is-valid{background:#e8f5eb;border-left-color:#168044}',
      '.dbmov-table-wrap{overflow:auto;max-height:325px}',
      '.dbmov-table-wrap table{border-collapse:collapse;width:100%;font-size:12px}',
      '.dbmov-table-wrap th{background:#0e5933;color:white;position:sticky;top:0;text-align:left;padding:9px;white-space:nowrap}',
      '.dbmov-table-wrap td{padding:9px;border-bottom:1px solid #e0ede3;vertical-align:top}',
      '.dbmov-table-wrap td.dbmov-number{text-align:right;white-space:nowrap}',
      '.dbmov-table-wrap td.dbmov-center{font-weight:800;min-width:160px}',
      '.dbmov-center small{display:block;font-weight:500;color:#617d69;margin-top:4px}',
      '@media(max-width:650px){.dbmov-header{padding:12px}.dbmov-header h2{font-size:16px}.dbmov-content{padding:12px}}'
    ].join('\n');
    document.head.appendChild(style);
  }
  async function open(info,trigger){
    installCss();
    const token=++serial;
    const d=ensureDialog();
    current=null;
    d.innerHTML='<div class="dbmov-header"><div><small>HISTÓRICO MENSAL DE BAIXAS</small>'+
      '<h2 id="dbmov-dialog-title">'+esc(info.produto)+'</h2></div>'+
      '<button type="button" data-dbmov-close>Fechar ×</button></div>'+
      '<div class="dbmov-content"><p class="dbmov-empty">Carregando histórico por mês...</p></div>';
    if(!d.open)d.showModal();
    const years=periods[info.period]||periods.all;
    const state={info,years,centerRows:new Map(),plateRows:new Map()};
    current=state;
    try{
      await Promise.all(years.filter(y=>y>=2025).map(async year=>{
        const data=await fetchPack(year,'center');
        state.centerRows.set(year,matchingRows(data,info,false));
      }));
      if(token!==serial||!d.open)return;
      d.querySelector('.dbmov-content').innerHTML=renderCharts(state);
    }catch(error){
      if(token!==serial||!d.open)return;
      d.querySelector('.dbmov-content').innerHTML=
        '<p class="dbmov-empty">Não foi possível consultar o histórico mensal: '+esc(error.message)+
        '. Os valores e filtros de Movimentações continuam disponíveis.</p>';
    }
    d.addEventListener('close',()=>{if(trigger?.isConnected)trigger.focus()},{once:true});
  }
  window.DB_MOVEMENT_MONTHLY={open};
})();