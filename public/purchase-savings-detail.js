// Detalhamento do indicador "Potencial sobre o valor comprado" (Resumo > Visao geral).
// Usa as mesmas compras e o mesmo universo de benchmark dos KPIs, respeitando os filtros ativos.
(function(){
  'use strict';
  if(document.documentElement.dataset.purchaseSavingsDetail === '1') return;
  const numberElement = document.getElementById('kEconomiaPct');
  const card = numberElement && (numberElement.closest('.card') || numberElement.closest('.exec-kpi'));
  if(!card) return;
  document.documentElement.dataset.purchaseSavingsDetail = '1';

  const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const integer = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const decimal = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2});
  const percent = new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1});
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const number = value => Number(value) || 0;
  const dateKey = value => {const p=String(value||'').split('/');return p.length===3 ? Number(p[2])*10000+Number(p[1])*100+Number(p[0]) : 0};
  const excluded = x => typeof window.DB_IS_TIRE_OR_CAMERA === 'function'
    ? window.DB_IS_TIRE_OR_CAMERA(x)
    : /(?:PNEU|CAMARA)/.test(norm(x && x.grupo));
  const productKey = x => String(x.codigo)+'|'+String(x.un||'');
  const purchaseYear = date => (String(date||'').match(/\/(20\d{2})$/)||[])[1] || '';

  const style = document.createElement('style');
  style.textContent = [
    '.ps-kpi-action{cursor:pointer!important;position:relative;transition:box-shadow .16s ease,transform .16s ease}',
    '.ps-kpi-action:hover,.ps-kpi-action:focus-visible{box-shadow:0 8px 24px rgba(20,92,49,.17)!important;transform:translateY(-2px);outline:2px solid #1b7840;outline-offset:2px}',
    '.ps-kpi-action:after{content:"Clique para ver os produtos";display:block;margin-top:5px;font-size:9px;font-weight:800;color:#177342}',
    '.ps-layer{position:fixed;inset:0;z-index:2147483645;background:rgba(9,31,20,.55);display:none;align-items:center;justify-content:center;padding:8px;box-sizing:border-box}',
    '.ps-layer.ps-open{display:flex}',
    '.ps-modal{background:#f6f9f6;border-radius:12px;width:100%;height:100%;max-width:none;max-height:none;min-width:0;min-height:0;display:flex;flex-direction:column;box-shadow:0 25px 75px rgba(0,0,0,.30);overflow:hidden;color:#1f3327}',
    '.ps-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;background:#0e512d;color:white;padding:17px 20px;border-bottom:4px solid #e8c400}',
    '.ps-head h2{font-size:19px;margin:0 0 5px;color:white}.ps-head p{font-size:11px;line-height:1.5;margin:0;color:#e2f0e7}',
    '.ps-close{background:white;color:#0e512d;border:0;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:850;cursor:pointer;flex:none}',
    '.ps-content{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:13px 16px 11px;min-height:0;min-width:0}',
    '.ps-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px;flex-shrink:0}',
    '.ps-metric{border:1px solid #d5e5d9;border-radius:11px;padding:11px;background:white}',
    '.ps-metric small{display:block;font-size:9px;font-weight:800;color:#617467;text-transform:uppercase}',
    '.ps-metric strong{display:block;margin-top:5px;font-size:19px;color:#116037}',
    '.ps-metric span{display:block;font-size:10px;color:#6e7b72;margin-top:4px}',
    '.ps-controls{display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap;margin-bottom:11px;flex-shrink:0}',
    '.ps-controls label{font-size:10px;font-weight:850;display:flex;flex-direction:column;gap:4px;color:#4e6555;flex:1;min-width:145px}',
    '.ps-controls input,.ps-controls select{border:1px solid #cbdccc;border-radius:8px;background:white;color:#213a2b;font-size:12px;padding:9px;min-width:0;width:100%;box-sizing:border-box}',
    '.ps-controls .ps-search{flex:1.7;min-width:230px}.ps-controls .ps-year{flex:.55;min-width:120px}',
    '.ps-export{border:1px solid #11713e;background:#fff;color:#13653a;border-radius:8px;padding:9px 12px;font-size:11px;font-weight:850;cursor:pointer}',
    '.ps-table-wrap{flex:1;min-height:0;min-width:0;border:1px solid #d5e5d9;border-radius:10px;overflow:auto;background:white;overscroll-behavior:contain}',
    '.ps-table{width:100%;border-collapse:separate;border-spacing:0;min-width:1300px;table-layout:fixed;font-size:10.5px}',
    '.ps-table>thead>tr>th{position:sticky;top:0;z-index:3;background:#e7f2e9;color:#154b2d;text-align:left;font-size:9px;text-transform:uppercase;padding:10px 7px;white-space:normal;overflow-wrap:anywhere;line-height:1.3}',
    '.ps-table>tbody>tr.ps-item-row>td{padding:9px 7px;border-top:1px solid #e7eee8;vertical-align:top;overflow-wrap:anywhere;line-height:1.45}',
    '.ps-table .ps-num{text-align:right;white-space:nowrap}.ps-table .ps-saving{font-weight:900;color:#116b39}',
    '.ps-table>thead>tr>th:nth-child(1){width:2.2%}.ps-table>thead>tr>th:nth-child(2){width:11%}.ps-table>thead>tr>th:nth-child(3){width:5.3%}.ps-table>thead>tr>th:nth-child(4){width:18%}.ps-table>thead>tr>th:nth-child(5){width:10%}.ps-table>thead>tr>th:nth-child(6){width:3.2%}.ps-table>thead>tr>th:nth-child(7){width:7.7%}.ps-table>thead>tr>th:nth-child(8){width:8.1%}.ps-table>thead>tr>th:nth-child(9){width:7.9%}.ps-table>thead>tr>th:nth-child(10){width:16.1%}.ps-table>thead>tr>th:nth-child(11){width:10.5%}',
    '.ps-table>thead>tr>th:last-child{right:0;z-index:6;background:#dff0e3;box-shadow:-3px 0 7px rgba(24,70,39,.10)}',
    '.ps-table>tbody>tr.ps-item-row>td:last-child{position:sticky;right:0;z-index:2;background:white;box-shadow:-3px 0 7px rgba(24,70,39,.08)}',
    '.ps-table>tbody>tr.ps-item-row:hover>td:last-child{background:#f0f8f2}',
    '.ps-item-row{cursor:pointer}.ps-item-row:hover{background:#f0f8f2}.ps-item-row:focus-visible{outline:2px solid #116b39;outline-offset:-2px}',
    '.ps-item-name{font-weight:700;white-space:normal;overflow-wrap:anywhere}.ps-small{font-size:9px;color:#6a7f70;overflow-wrap:anywhere}',
    '.ps-detail td{background:#f7faf7;padding:12px 14px}.ps-detail-grid{overflow-x:auto}',
    '.ps-detail-grid table{width:100%;border-collapse:collapse;font-size:10px;min-width:720px}.ps-detail-grid th{position:static!important;background:#edf3ed!important}.ps-detail-grid td{background:transparent!important}',
    '.ps-table-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 3px;font-size:11px;color:#506a57;flex-shrink:0}',
    '.ps-table>tbody>tr.ps-detail>td{overflow-wrap:anywhere}',
    '.ps-note{font-size:10px;line-height:1.5;color:#5b715f;margin:8px 2px 0;flex-shrink:0}',
    '.ps-audit-warning{background:#f0f8f2;border:1px solid #cde4d3;border-left:4px solid #21814a;padding:11px 13px;color:#254e34;font-size:11px;line-height:1.55;border-radius:8px;margin:0 0 11px;flex-shrink:0}',
    '.ps-audit-caption{display:block;color:#227347;font-size:10px;font-weight:800;margin-top:5px;line-height:1.3}',
    '@media(max-width:780px){.ps-layer{padding:0}.ps-modal{height:100%;max-height:none;border-radius:0}.ps-head{padding:13px}.ps-head h2{font-size:16px}.ps-content{padding:11px}.ps-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.ps-metric{padding:8px}.ps-metric strong{font-size:16px}.ps-controls{gap:6px}.ps-controls .ps-search{min-width:100%}}'
  ].join('');
  document.head.appendChild(style);

  const layer=document.createElement('div');
  layer.className='ps-layer';
  layer.innerHTML=[
    '<section class="ps-modal" role="dialog" aria-modal="true" aria-labelledby="ps-title">',
      '<header class="ps-head"><div>',
        '<h2 id="ps-title">Comparativo de oportunidades de economia</h2>',
        '<p>Produtos com custo unitário registrado acima do menor custo histórico disponível para o mesmo código e unidade.</p>',
      '</div><button type="button" class="ps-close" aria-label="Fechar comparativo">Fechar ✕</button></header>',
      '<div class="ps-content">',
        '<div class="ps-audit-warning"><strong>Base oficial de compras auditada e aprovada em 03/11/2026.</strong> Os preços e totais refletem o relatório do ERP enviado e validado para o histórico de 2025–2026. A diferença calculada continua sendo <strong>potencial teórico de economia</strong>, não desconto obtido ou cotação vigente: a referência é o menor custo do mesmo código e unidade no histórico, inclusive de outros anos.</div>',
        '<div class="ps-metrics">',
          '<div class="ps-metric"><small>Diferença teórica</small><strong id="ps-saving">—</strong><span>Simulação com custos do ERP</span></div>',
          '<div class="ps-metric"><small>Diferença / valor comprado</small><strong id="ps-rate">—</strong><span>Comparação histórica da base auditada</span></div>',
          '<div class="ps-metric"><small>Produtos com oportunidade</small><strong id="ps-products">—</strong><span>Código + unidade distintos</span></div>',
          '<div class="ps-metric"><small>Registros acima do menor custo</small><strong id="ps-lines">—</strong><span>Registros da base auditada</span></div>',
        '</div>',
        '<div class="ps-controls">',
          '<label class="ps-search">Buscar produto ou código<input id="ps-search" placeholder="Digite o código ou nome do produto" autocomplete="off"></label>',
          '<label class="ps-year">Ano<select id="ps-year"><option value="">Todos os anos</option></select></label>',
          '<label>Local<select id="ps-local"><option value="">Todos os locais</option></select></label>',
          '<label>Grupo<select id="ps-group"><option value="">Todos os grupos</option></select></label>',
          '<button type="button" class="ps-export">Exportar CSV</button>',
        '</div>',
        '<div class="ps-table-wrap"><table class="ps-table">',
          '<thead><tr><th>#</th><th>Local</th><th>Código</th><th>Produto</th><th>Grupo</th><th>UN</th>',
          '<th class="ps-num">Qtd. comprada</th><th class="ps-num">Custo médio ERP</th>',
          '<th class="ps-num">Menor custo ERP</th><th>Registro do menor custo</th>',
          '<th class="ps-num">Diferença teórica</th></tr></thead>',
          '<tbody id="ps-rows"></tbody></table></div>',
        '<div class="ps-table-foot"><span id="ps-showing"></span></div>',
        '<p class="ps-note">O filtro de ano considera a data da compra. A referência continua sendo o menor custo do histórico disponível, inclusive de outros anos. Clique em um produto para conferir os registros; em telas menores, deslize lateralmente (a coluna de diferença teórica permanece visível). ',
        'A economia é teórica e depende de disponibilidade, marca, especificação, frete, impostos e condições comerciais. ',
        'Pneus e câmaras de ar não entram nesta comparação, mas continuam nas compras por mês.</p>',
      '</div>',
    '</section>'
  ].join('');
  document.body.appendChild(layer);

  const $=selector=>layer.querySelector(selector);
  const search=$('#ps-search'), year=$('#ps-year'), local=$('#ps-local'), group=$('#ps-group'), body=$('#ps-rows');
  let data={rows:[],eligibleValue:0,savings:0,lines:0}, filtered=[];
  const focusBefore=()=>document.activeElement;

  function buildData(){
    let purchases=[];
    try{purchases=typeof purchasesFiltered==='function' ? purchasesFiltered() : (typeof PURCHASES!=='undefined'?PURCHASES:[])}catch(e){purchases=[]}
    purchases=(Array.isArray(purchases)?purchases:[]).filter(x=>!excluded(x));
    const years=[...new Set(purchases.map(x=>purchaseYear(x.data)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
    let reference=[];
    try{reference=typeof benchmarkRowsFiltered==='function' ? benchmarkRowsFiltered() : purchases}catch(e){reference=purchases}
    reference=(Array.isArray(reference)?reference:purchases).filter(x=>!excluded(x));
    // O comparativo usa o historico completo como referencia, inclusive de outros anos.
    if(year.value) purchases=purchases.filter(x=>purchaseYear(x.data)===year.value);
    const best=new Map();
    for(const x of reference){
      const price=number(x.preco);
      if(!(price>0))continue;
      const key=productKey(x), previous=best.get(key);
      if(!previous || price<number(previous.preco) || (price===number(previous.preco)&&dateKey(x.data)>dateKey(previous.data)))best.set(key,x);
    }

    const entries=new Map();
    let eligibleValue=0, lines=0;
    for(const x of purchases){
      eligibleValue+=number(x.valor);
      const qty=number(x.qtd),price=number(x.preco);
      if(!(qty>0&&price>0))continue;
      const b=best.get(productKey(x));
      if(!b || !(number(b.preco)>0))continue;
      const key=productKey(x)+'|'+String(x.local||'');
      let r=entries.get(key);
      if(!r){
        r={key:key,codigo:x.codigo,produto:x.produto,grupo:x.grupo,un:x.un,local:x.local,
          qty:0,paid:0,save:0,count:0,reference:b,details:[]};
        entries.set(key,r);
      }
      r.qty+=qty;
      r.paid+=price*qty;
      const diff=price-number(b.preco);
      if(diff>.005){
        const saved=diff*qty;
        r.save+=saved;r.count++;lines++;
        r.details.push({data:x.data,fornecedor:x.fornecedor,nota:x.nota,qtd:qty,preco:price,menor:number(b.preco),save:saved});
      }
    }
    const rows=[...entries.values()].filter(x=>x.save>.005);
    for(const r of rows)r.details.sort((a,b)=>b.save-a.save);
    rows.sort((a,b)=>b.save-a.save || String(a.produto).localeCompare(String(b.produto),'pt-BR'));
    return {rows:rows,eligibleValue:eligibleValue,savings:rows.reduce((a,x)=>a+x.save,0),lines:lines,years:years,purchases:purchases};
  }

  function updateSelect(select,items,title){
    const previous=select.value;
    select.innerHTML='<option value="">'+title+'</option>';
    for(const value of [...new Set(items.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'))){
      const option=document.createElement('option');option.value=String(value);option.textContent=String(value);select.appendChild(option);
    }
    if([...select.options].some(o=>o.value===previous))select.value=previous;
  }
  function refresh(){
    const previousYear=year.value;
    data=buildData();
    updateSelect(year,data.years,'Todos os anos');
    // Ao alterar o filtro geral, nao mantenha um ano que deixou de existir.
    if(previousYear && !year.value) data=buildData();
    updateSelect(local,data.rows.map(r=>r.local),'Todos os locais');
    updateSelect(group,data.rows.map(r=>r.grupo),'Todos os grupos');
    render();
  }
  function visibleRows(){
    const q=norm(search.value),l=local.value,g=group.value;
    return data.rows.filter(r=>(!l||String(r.local)===l)&&(!g||String(r.grupo)===g)&&
      (!q||norm(r.codigo).includes(q)||norm(r.produto).includes(q)||norm(r.grupo).includes(q)));
  }
  function render(){
    filtered=visibleRows();
    const savings=filtered.reduce((a,x)=>a+x.save,0);
    $('#ps-saving').textContent=money.format(savings);
    const q=norm(search.value),l=local.value,g=group.value;
    const comparablePurchases=(data.purchases||[]).filter(x=>(!l||String(x.local)===l)&&(!g||String(x.grupo)===g)&&(!q||norm(x.codigo).includes(q)||norm(x.produto).includes(q)||norm(x.grupo).includes(q)));
    const comparableValue=comparablePurchases.reduce((a,x)=>a+number(x.valor),0);
    $('#ps-rate').textContent=percent.format(comparableValue>0?savings/comparableValue:0);
    $('#ps-products').textContent=integer.format(new Set(filtered.map(r=>productKey(r))).size);
    $('#ps-lines').textContent=integer.format(filtered.reduce((a,x)=>a+x.count,0));
    const visible=filtered;
    body.innerHTML=visible.length?visible.map((r,i)=>[
      '<tr class="ps-item-row" tabindex="0" role="button" aria-expanded="false" data-idx="',i,'">',
        '<td>',i+1,'</td><td>',esc(r.local),'</td><td>',esc(r.codigo),'</td>',
        '<td class="ps-item-name">',esc(r.produto),'</td><td>',esc(r.grupo),'</td><td>',esc(r.un),'</td>',
        '<td class="ps-num">',decimal.format(r.qty),'</td><td class="ps-num">',money.format(r.paid/r.qty),'</td>',
        '<td class="ps-num">',money.format(r.reference.preco),'</td>',
        '<td>',esc(r.reference.fornecedor),'<div class="ps-small">',esc(r.reference.data),'</div></td>',
        '<td class="ps-num ps-saving">',money.format(r.save),' <span aria-hidden="true">▾</span></td>',
      '</tr>'
    ].join('')).join(''):'<tr><td colspan="11" style="padding:23px;text-align:center">Nenhuma oportunidade encontrada para os filtros aplicados.</td></tr>';
    $('#ps-showing').textContent='Todos os '+integer.format(filtered.length)+' registros por produto e local · '+money.format(savings)+' de economia potencial no filtro';
  }

  function openDetail(index){
    const r=filtered[index];if(!r)return;
    const row=body.querySelector('tr.ps-item-row[data-idx="'+index+'"]');if(!row)return;
    const open=row.nextElementSibling?.classList.contains('ps-detail');
    body.querySelectorAll('.ps-detail').forEach(x=>x.remove());
    body.querySelectorAll('.ps-item-row[aria-expanded="true"]').forEach(x=>x.setAttribute('aria-expanded','false'));
    if(open)return;
    const detail=document.createElement('tr');detail.className='ps-detail';
    const lines=r.details.map(x=>[
      '<tr><td>',esc(x.data),'</td><td>',esc(x.fornecedor),'</td><td>',esc(x.nota),'</td>',
      '<td class="ps-num">',decimal.format(x.qtd),'</td><td class="ps-num">',money.format(x.preco),'</td>',
      '<td class="ps-num">',money.format(x.menor),'</td><td class="ps-num ps-saving">',money.format(x.save),'</td></tr>'
    ].join('')).join('');
    detail.innerHTML=[
      '<td colspan="11"><div class="ps-detail-grid"><strong>',esc(r.codigo),' — ',esc(r.produto),
      '</strong><p class="ps-small">Comparação de ',integer.format(r.count),
      ' compra(s) acima do preço de referência. Melhor preço: ',money.format(r.reference.preco),
      ' · ',esc(r.reference.fornecedor),' · ',esc(r.reference.data),'</p>',
      '<table><thead><tr><th>Data</th><th>Fornecedor da compra</th><th>Nota</th>',
      '<th class="ps-num">Quantidade</th><th class="ps-num">Custo ERP</th>',
      '<th class="ps-num">Menor custo ERP</th><th class="ps-num">Diferença teórica</th></tr></thead>',
      '<tbody>',lines,'</tbody></table></div></td>'
    ].join('');
    row.after(detail);row.setAttribute('aria-expanded','true');
  }

  function exportCsv(){
    const headers=['Local','Codigo','Produto','Grupo','Unidade','Quantidade comprada','Custo unitario medio ERP','Menor custo ERP','Fornecedor do registro menor custo','Data registro menor custo','Diferenca teorica com base auditada'];
    const safe=value=>{
      let s=String(value==null?'':value);
      if(/^[=+\-@\t\r]/.test(s))s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    };
    const lines=[headers.map(safe).join(';')];
    for(const r of filtered){
      lines.push([r.local,r.codigo,r.produto,r.grupo,r.un,decimal.format(r.qty),
        decimal.format(r.paid/r.qty),decimal.format(r.reference.preco),r.reference.fornecedor,
        r.reference.data,decimal.format(r.save)].map(safe).join(';'));
    }
    const csv='\uFEFF'+lines.join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='potencial-economia-por-produto.csv';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  let previousFocus=null,previousOverflow='';
  function close(){
    layer.classList.remove('ps-open');
    document.body.style.overflow=previousOverflow;
    if(previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus();
  }
  function open(){
    previousFocus=focusBefore();previousOverflow=document.body.style.overflow;
    search.value='';year.value='';local.value='';group.value='';
    refresh();layer.classList.add('ps-open');document.body.style.overflow='hidden';search.focus();
  }
  // Avisar nas duas métricas principais sem alterar seus valores exibidos.
  for(const id of ['kEconomiaPotencial','kEconomiaPct']){
    const metric=document.getElementById(id);
    const parent=metric?.closest('.card');
    if(parent && !parent.querySelector('.ps-audit-caption')){
      const hint=document.createElement('span');
      hint.className='ps-audit-caption';
      hint.textContent='Base auditada · economia estimada';
      parent.appendChild(hint);
    }
  }
  card.classList.add('ps-kpi-action');
  card.setAttribute('role','button');card.setAttribute('tabindex','0');
  card.setAttribute('aria-haspopup','dialog');card.setAttribute('aria-label','Abrir comparativo de todos os produtos com potencial de economia');
  card.title='Clique para comparar todos os produtos com potencial de economia';
  card.addEventListener('click',open);
  card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
  $('.ps-close').addEventListener('click',close);
  layer.addEventListener('click',event=>{if(event.target===layer)close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&layer.classList.contains('ps-open'))close()});
  for(const control of [search,local,group])control.addEventListener(control===search?'input':'change',render);
  year.addEventListener('change',refresh);
  body.addEventListener('click',event=>{const row=event.target.closest('.ps-item-row');if(row)openDetail(Number(row.dataset.idx))});
  body.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const row=event.target.closest('.ps-item-row');if(row){event.preventDefault();openDetail(Number(row.dataset.idx))}});
  $('.ps-export').addEventListener('click',exportCsv);
  for(const id of ['fEmpresa','fLocal','fGrupo','fUn','fFornecedor','fBusca']){
    const el=document.getElementById(id);
    if(el)el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{if(layer.classList.contains('ps-open'))refresh()});
  }
  window.addEventListener('purchases-updated',()=>{if(layer.classList.contains('ps-open'))refresh()});
})();
