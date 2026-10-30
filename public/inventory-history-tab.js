(function(){
  if(window.__DB_INVENTORY_TAB || document.documentElement.dataset.dbPilot==='1')return;
  const nav=document.querySelector('.tabs'),wrap=document.querySelector('.wrap');
  if(!nav||!wrap)return;
  window.__DB_INVENTORY_TAB=true;
  const data=window.INVENTORY_LEDGER||{schemaVersion:1,inventories:[],entries:[]};
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  const fmt=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4}).format(v);
  const currency=v=>v===null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
  const dated=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):String(v||'');
  function validate(d){
    if(!d||d.schemaVersion!==1||!Array.isArray(d.inventories)||!Array.isArray(d.entries))
      throw Error('Formato do historico de inventarios invalido.');
    const sessions=new Map(),ids=new Set(),rows=[];
    for(const s of d.inventories){
      if(!s?.id||sessions.has(s.id)||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!s.sourceFile)
        throw Error('Inventario sem ID, data ou fonte, ou ID repetido.');
      sessions.set(s.id,s);
    }
    for(const r of d.entries){
      if(!r?.id||ids.has(r.id)||!sessions.has(r.inventoryId))
        throw Error('Linha duplicada ou sem vinculo a um inventario.');
      ids.add(r.id);
      if(!r.local||!r.codigoLocal||!r.empresaFiscal||!r.grupo||!r.codigo||!r.produto||!r.un)
        throw Error('Linha sem almoxarifado, empresa fiscal, codigo, grupo ou unidade.');
      // Ajustes ERP sao diferentes de contagens fisicas: nunca estimar saldos.
      const isAdjustment=r.tipoRegistro==='AJUSTE';
      const before=isAdjustment?null:numeric(r.saldoSistema),counted=isAdjustment?null:numeric(r.saldoContado);
      if(!isAdjustment&&(before===null||counted===null||before<0||counted<0))
        throw Error('Saldo do sistema e contagem exigidos; celula vazia nao e zero.');
      const cost=r.custoUnitario===null||r.custoUnitario===undefined||r.custoUnitario===''?null:numeric(r.custoUnitario);
      if(cost!==null&&cost<0)throw Error('Custo do inventario invalido.');
      const qty=isAdjustment?numeric(r.quantidadeAjuste):null;
      if(isAdjustment&&(qty===null||qty===0||
        (r.saldoSistema!==null&&r.saldoSistema!==undefined)||
        (r.saldoContado!==null&&r.saldoContado!==undefined)))
        throw Error('Relatorio de ajuste sem quantidade assinada ou com saldo nao demonstrado.');
      const delta=isAdjustment?Math.round(qty*10000)/10000:Math.round((counted-before)*10000)/10000;
      const total=isAdjustment?numeric(r.valorAjuste):null;
      if(isAdjustment&&(total===null||total===0||Math.sign(total)!==Math.sign(delta)))
        throw Error('Valor de ajuste invalido ou com sinal incorreto.');
      const erp=r.statusERP||(delta?'PENDENTE':'SEM_DIFERENCA');
      if(!['PENDENTE','CONFIRMADO','SEM_DIFERENCA'].includes(erp)||
         (delta===0)!==(erp==='SEM_DIFERENCA'))throw Error('Situacao ERP incoerente.');
      rows.push({...r,date:sessions.get(r.inventoryId).date,
        sourceFile:r.sourceFile||sessions.get(r.inventoryId).sourceFile,
        tipoRegistro:isAdjustment?'AJUSTE':'CONTAGEM',
        saldoAnterior:before,quantidadeContada:counted,delta,custoUnitario:cost,
        impacto:isAdjustment?Math.round(total*100)/100:
          cost===null?null:Math.round(cost*delta*100)/100,statusERP:erp});
    }
    return{sessions:[...sessions.values()].sort((a,b)=>b.date.localeCompare(a.date)),rows};
  }
  const tab=document.createElement('button');tab.type='button';tab.className='tab';tab.dataset.view='inventarios';
  tab.textContent='Inventários realizados';nav.appendChild(tab);
  const section=document.createElement('section');section.id='view-inventarios';section.className='view';
  section.innerHTML=`
    <div class="iv-head"><h2>Inventários realizados</h2>
      <p>Histórico de conferências e de ajustes por almoxarifado, grupo e produto.</p></div>
    <div class="iv-cards">
      <div><span>Inventários</span><strong id="iv-count">0</strong></div>
      <div><span>Itens registrados</span><strong id="iv-lines">0</strong></div>
      <div><span>Acréscimos (+)</span><strong id="iv-plus">0</strong></div>
      <div><span>Baixas (−)</span><strong id="iv-minus">0</strong></div>
      <div><span>Pendentes ERP</span><strong id="iv-pending">0</strong></div>
    </div>
    <div class="iv-filters">
      <label>Pesquisar<input id="iv-q" type="search" placeholder="Código, produto ou documento ERP"></label>
      <label>Inventário<select id="iv-session"><option value="">Todos</option></select></label>
      <label>Local<select id="iv-local"><option value="">Todos</option></select></label>
      <label>Grupo<select id="iv-group"><option value="">Todos</option></select></label>
      <label>Diferença<select id="iv-type"><option value="todos">Todos</option><option value="alterados">Com diferença</option>
        <option value="positivo">Acréscimos (+)</option><option value="negativo">Baixas (−)</option>
        <option value="sem">Sem diferença</option><option value="pendente">Pendente no ERP</option></select></label>
      <button type="button" id="iv-export">Exportar CSV</button>
    </div>
    <p class="iv-note">Os ajustes informados <b>não comprovam contagem física e não alteram automaticamente o saldo do ERP</b>.
      Acréscimos e baixas ficam <b>pendentes</b> até a confirmação do ajuste.
      O histórico de estoque, compras e consumo não é modificado por esta aba.</p>
    <div class="iv-panel"><div class="iv-panel-head"><b>Inventários por local e grupo</b><span id="iv-caption"></span></div>
      <p class="iv-hint">Clique no <b>local</b> para abrir os grupos; depois clique no <b>grupo</b> para ver os produtos.</p>
      <div id="iv-hierarchy"></div></div>`;
  wrap.appendChild(section);
  const style=document.createElement('style');
  style.textContent=`
    #view-inventarios{color:#263b2d;--iv:#135c36;--line:#d8e7dc}
    #view-inventarios .iv-head,#view-inventarios .iv-panel,#view-inventarios .iv-filters,#view-inventarios .iv-cards>div{background:#fff;border:1px solid var(--line);border-radius:12px}
    #view-inventarios .iv-head{padding:17px 19px;margin-bottom:12px}
    #view-inventarios h2{margin:0 0 5px;color:var(--iv);font-size:18px}
    #view-inventarios .iv-head p{margin:0;color:#607165;font-size:12px;line-height:1.5}
    #view-inventarios .iv-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-bottom:11px}
    #view-inventarios .iv-cards>div{padding:12px 13px}
    #view-inventarios .iv-cards span{display:block;text-transform:uppercase;font-size:10px;color:#6f7e72;font-weight:800}
    #view-inventarios .iv-cards strong{display:block;margin-top:7px;color:var(--iv);font-size:22px}
    #view-inventarios #iv-minus{color:#b23e2b}
    #view-inventarios .iv-filters{display:grid;grid-template-columns:1.5fr repeat(4,1fr) auto;gap:9px;padding:12px;align-items:end;margin-bottom:10px}
    #view-inventarios .iv-filters label{font-size:10px;font-weight:850;color:#68796b;min-width:0}
    #view-inventarios .iv-filters input,#view-inventarios .iv-filters select{display:block;width:100%;box-sizing:border-box;min-height:35px;margin-top:5px;border:1px solid #d7e5da;border-radius:8px;padding:7px 9px;background:#fbfdfb;font-size:12px}
    #view-inventarios #iv-export{min-height:35px;border:1px solid #bed9c6;border-radius:8px;padding:7px 10px;background:#eaf6ef;color:#155f38;font-weight:800;cursor:pointer}
    #view-inventarios .iv-note{font-size:11px;line-height:1.6;padding:11px 13px;border-left:4px solid #d6ab22;border-radius:8px;margin:0 0 12px;background:#fff9eb;color:#66552c}
    #view-inventarios .iv-panel{overflow:hidden}
    #view-inventarios .iv-panel-head{display:flex;justify-content:space-between;gap:12px;padding:13px 15px;border-bottom:1px solid var(--line);color:var(--iv);font-size:12px}
    #view-inventarios .iv-panel-head span{color:#708071;font-size:11px}
    #view-inventarios .iv-hint{background:#f7fbf8;margin:0;padding:10px 14px;color:#698071;font-size:11px}
    #view-inventarios #iv-hierarchy{padding:12px;display:grid;gap:9px}
    #view-inventarios .iv-local,#view-inventarios .iv-group{border:1px solid var(--line);border-radius:10px;overflow:hidden}
    #view-inventarios .iv-local>summary,#view-inventarios .iv-group>summary{cursor:pointer;display:flex;align-items:center;gap:12px;padding:12px 14px;list-style:none;font-weight:850;font-size:12px}
    #view-inventarios .iv-local>summary{background:#e9f5ed;color:var(--iv)}
    #view-inventarios .iv-group>summary{background:#f9fcfa;color:#36553e}
    #view-inventarios .iv-local summary::-webkit-details-marker,#view-inventarios .iv-group summary::-webkit-details-marker{display:none}
    #view-inventarios summary:before{content:'›';font-size:21px}
    #view-inventarios details[open]>summary:before{content:'⌄'}
    #view-inventarios summary span:first-of-type{flex:1}
    #view-inventarios summary small{margin-left:8px;color:#647767;font-size:10px;font-weight:600}
    #view-inventarios .iv-groups{padding:10px;display:grid;gap:8px}
    #view-inventarios .iv-scroll{overflow-x:auto}
    #view-inventarios table{width:100%;min-width:1180px;border-collapse:collapse;font-size:10px}
    #view-inventarios th{padding:9px;background:#104d2e;color:#fff;white-space:nowrap;text-align:left}
    #view-inventarios td{padding:9px;border-bottom:1px solid #edf2ee;vertical-align:top}
    #view-inventarios .iv-num{text-align:right;white-space:nowrap}
    #view-inventarios .iv-positive{color:#147a42;font-weight:900}
    #view-inventarios .iv-negative{color:#b14234;font-weight:900}
    #view-inventarios .iv-status{font-size:10px;font-weight:800;display:inline-block;padding:3px 7px;border-radius:999px;background:#eef2ed}
    #view-inventarios .iv-status.pending{background:#fff2d7;color:#895f13}
    #view-inventarios .iv-status.done{background:#e2f5e7;color:#156439}
    #view-inventarios .iv-detail{font-size:10px;color:#7c8b80;margin-top:4px}
    #view-inventarios .iv-empty{padding:25px;border:1px dashed #c7dcca;border-radius:9px;background:#fbfdfb;color:#627263;text-align:center;line-height:1.7;font-size:12px}
    @media(max-width:1100px){#view-inventarios .iv-cards{grid-template-columns:repeat(3,minmax(0,1fr))}#view-inventarios .iv-filters{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:650px){#view-inventarios .iv-cards,#view-inventarios .iv-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
  const $=s=>section.querySelector(s);
  let parsed={sessions:[],rows:[]},error='';
  try{parsed=validate(data)}catch(e){error=e.message;console.error('Inventarios:',e)}
  function addSelect(selector,values,label){
    const select=$(selector);
    for(const v of values){const o=document.createElement('option');o.value=v;o.textContent=label?label(v):v;select.add(o)}
  }
  addSelect('#iv-session',parsed.sessions.map(x=>x.id),id=>{
    const s=parsed.sessions.find(x=>x.id===id);return dated(s.date)+' · '+(s.description||s.id)
  });
  addSelect('#iv-local',[...new Set(parsed.rows.map(x=>x.local))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  addSelect('#iv-group',[...new Set(parsed.rows.map(x=>x.grupo))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  function filtered(){
    const sid=$('#iv-session').value,loc=$('#iv-local').value,grp=$('#iv-group').value,
      type=$('#iv-type').value,search=norm($('#iv-q').value);
    return parsed.rows.filter(x=>(!sid||x.inventoryId===sid)&&(!loc||x.local===loc)&&
      (!grp||x.grupo===grp)&&(type==='todos'||type==='alterados'&&x.delta!==0||
      type==='positivo'&&x.delta>0||type==='negativo'&&x.delta<0||
      type==='sem'&&x.delta===0||type==='pendente'&&x.delta!==0&&x.statusERP==='PENDENTE')&&
      (!search||norm([x.codigo,x.produto,x.local,x.grupo,x.empresaFiscal,x.inventoryId,x.documentoERP].join(' ')).includes(search)));
  }
  const stats=rows=>({items:rows.length,
    plus:rows.filter(x=>x.delta>0).length,minus:rows.filter(x=>x.delta<0).length,
    pending:rows.filter(x=>x.delta!==0&&x.statusERP==='PENDENTE').length});
  const action=x=>x.delta>0?(x.statusERP==='CONFIRMADO'?'Acrescentado':'A acrescentar'):
    x.delta<0?(x.statusERP==='CONFIRMADO'?'Baixado':'A baixar'):'Sem diferença';
  const status=x=>x.statusERP==='CONFIRMADO'?'Confirmado no ERP':
    x.statusERP==='PENDENTE'?'Pendente no ERP':'Sem ajuste';
  function table(rows){
    const sorted=rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||
      Math.abs(b.impacto||0)-Math.abs(a.impacto||0)||String(a.codigo).localeCompare(String(b.codigo),'pt-BR'));
    return '<div class="iv-scroll"><table><thead><tr><th>Inventário / data</th><th>Código / produto</th><th>Empresa fiscal</th><th>UN</th><th class="iv-num">Sistema</th><th class="iv-num">Contado</th><th class="iv-num">Diferença / ajuste</th><th class="iv-num">Impacto (R$)</th><th>Ação</th><th>ERP</th><th>Observações</th></tr></thead><tbody>'+
      sorted.map(x=>'<tr><td><b>'+h(dated(x.date))+'</b><div class="iv-detail">'+h(x.tipoRegistro==='AJUSTE'?'Ajuste informado':'Contagem física')+'</div><div class="iv-detail">'+h(x.inventoryId)+'</div></td>'+
      '<td><b>'+h(x.codigo)+'</b> - '+h(x.produto)+'</td><td>'+h(x.empresaFiscal)+'</td><td>'+h(x.un)+'</td>'+
      '<td class="iv-num">'+(x.saldoAnterior===null?'—':fmt(x.saldoAnterior))+'</td><td class="iv-num">'+(x.quantidadeContada===null?'—':fmt(x.quantidadeContada))+'</td>'+
      '<td class="iv-num '+(x.delta>0?'iv-positive':x.delta<0?'iv-negative':'')+'">'+
      (x.delta>0?'+':'')+fmt(x.delta)+'</td><td class="iv-num">'+currency(x.impacto)+'</td>'+
      '<td>'+h(action(x))+'</td><td><span class="iv-status '+(x.statusERP==='PENDENTE'?'pending':x.statusERP==='CONFIRMADO'?'done':'')+'">'+h(status(x))+'</span></td>'+
      '<td>'+h(x.observacao||'—')+(x.sourceRow?'<div class="iv-detail">'+h(x.sourceFile)+' · linha '+h(x.sourceRow)+'</div>':'')+(x.documentoERP?'<div class="iv-detail">ERP: '+h(x.documentoERP)+'</div>':'')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function render(){
    const all=parsed.rows,s=stats(all),shown=filtered();
    $('#iv-count').textContent=fmt(parsed.sessions.length);
    $('#iv-lines').textContent=fmt(s.items);$('#iv-plus').textContent=fmt(s.plus);
    $('#iv-minus').textContent=fmt(s.minus);$('#iv-pending').textContent=fmt(s.pending);
    $('#iv-caption').textContent=shown.length+' posições nos filtros';
    if(error){$('#iv-hierarchy').innerHTML='<div class="iv-empty">Falha de validação do histórico: '+h(error)+'</div>';return}
    if(!parsed.sessions.length){$('#iv-hierarchy').innerHTML='<div class="iv-empty"><b>Nenhum inventário registrado ainda.</b>'+
      '<p>Ao encaminhar a primeira planilha, registraremos data, local, grupo, código, saldo do sistema, contagem física, acréscimos e baixas.</p>'+
      '<p>Novos inventários serão acrescentados ao histórico, sem apagar os anteriores.</p></div>';return}
    if(!shown.length){$('#iv-hierarchy').innerHTML='<div class="iv-empty">Nenhuma posição encontrada com estes filtros.</div>';return}
    const localMap=new Map();
    for(const x of shown){if(!localMap.has(x.local))localMap.set(x.local,new Map());
      const groups=localMap.get(x.local);if(!groups.has(x.grupo))groups.set(x.grupo,[]);
      groups.get(x.grupo).push(x);
    }
    $('#iv-hierarchy').innerHTML=[...localMap].sort(([a],[b])=>a.localeCompare(b,'pt-BR')).map(([local,groups])=>{
      const ls=stats([...groups.values()].flat());
      return '<details class="iv-local" data-iv-local="'+h(local)+'"><summary><span>'+h(local)+
      '<small>'+ls.items+' itens · +'+ls.plus+' / −'+ls.minus+'</small></span><b>'+ls.pending+' pendentes</b></summary>'+
      '<div class="iv-groups">'+[...groups].sort(([a],[b])=>a.localeCompare(b,'pt-BR')).map(([group,items])=>{
        const gs=stats(items);
        return '<details class="iv-group" data-iv-group="'+h(group)+'"><summary><span>'+h(group)+
        '<small>'+gs.items+' itens · +'+gs.plus+' / −'+gs.minus+'</small></span></summary>'+
        table(items)+'</details>';
      }).join('')+'</div></details>';
    }).join('');
  }
  tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    tab.classList.add('active');section.classList.add('active');render();});
  ['#iv-session','#iv-local','#iv-group','#iv-type'].forEach(x=>$(x).addEventListener('change',render));
  $('#iv-q').addEventListener('input',render);
  $('#iv-export').addEventListener('click',()=>{
    if(error||!parsed.rows.length)return;
    const rows=[['Inventario','Data','Arquivo origem','Local','Codigo local','Empresa fiscal','Grupo','Codigo','Produto','UN','Saldo ERP (se informado)','Contagem (se informada)','Diferenca / ajuste','Custo unitario','Impacto R$','Acao','Status ERP','Documento ERP','Observacao']];
    for(const x of filtered())rows.push([x.inventoryId,dated(x.date),x.sourceFile,x.local,x.codigoLocal,
      x.empresaFiscal,x.grupo,x.codigo,x.produto,x.un,x.saldoAnterior??'',x.quantidadeContada??'',x.delta,
      x.custoUnitario??'',x.impacto??'',action(x),status(x),x.documentoERP||'',x.observacao||'']);
    const csv=v=>{let t=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
    const content='\ufeff'+rows.map(r=>r.map(csv).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='inventarios_realizados.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),800);
  });
  window.INVENTORY_HISTORY={validate,open:()=>tab.click(),getRows:()=>parsed.rows.slice(),stats:()=>stats(parsed.rows),refresh:render};
  render();
})();
