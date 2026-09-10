// Potencial de economia por grupo - detalhe rapido e progressivo
(function(){
  const D=window.ECONOMY_POTENTIAL_DATA;if(!D||!Array.isArray(D.groups))return;
  const tabs=document.querySelector('.tabs'),wrap=document.querySelector('.wrap');if(!tabs||!wrap)return;
  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const n1=v=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Number(v)||0);
  const pc=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)||0);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  let btn=document.querySelector('.tab[data-view="economia"]');
  if(!btn){btn=document.createElement('button');btn.className='tab';btn.dataset.view='economia';btn.textContent='Potencial de economia';tabs.appendChild(btn)}
  let old=document.getElementById('view-economia');if(old)old.remove();
  const s=D.summary||{},sec=document.createElement('section');sec.id='view-economia';sec.className='view';
  sec.innerHTML=`
    <style>
      #view-economia .economy-groups tbody tr{cursor:pointer;transition:background .12s ease}#view-economia .economy-groups tbody tr:hover{background:#eef5fb}#view-economia .economy-groups tbody td:first-child:before{content:'›';display:inline-block;margin-right:7px;color:#4f7392;font-weight:900}.economy-backdrop{position:fixed;inset:0;background:rgba(18,31,47,.30);z-index:1002;opacity:0;pointer-events:none;transition:.18s}.economy-backdrop.open{opacity:1;pointer-events:auto}.economy-drawer{position:fixed;right:0;top:0;bottom:0;width:min(1180px,94vw);z-index:1003;background:#fff;box-shadow:-18px 0 45px rgba(20,40,65,.20);transform:translateX(102%);transition:transform .16s ease;display:flex;flex-direction:column}.economy-drawer.open{transform:translateX(0)}.economy-drawer-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:17px 20px;border-bottom:1px solid #e1e7ef}.economy-drawer-head h3{margin:0 0 4px;color:#17365d;font-size:17px}.economy-drawer-head p{margin:0;font-size:10px;color:#68778a}.economy-close{border:1px solid #d7e0ea;background:#fff;border-radius:9px;padding:7px 10px;color:#17365d;font-weight:850;cursor:pointer}.economy-drawer-tools{display:flex;gap:8px;padding:10px 18px;border-bottom:1px solid #edf1f5;background:#fafbfd}.economy-drawer-tools input{flex:1;max-width:420px}.economy-drawer-body{overflow:auto;padding:0 18px 24px}.economy-drawer-body table{width:100%;border-collapse:collapse;font-size:9.5px}.economy-drawer-body th{position:sticky;top:0;z-index:1;background:#eef3f8;color:#17365d;padding:8px 7px;text-align:left;border-bottom:1px solid #d8e1eb}.economy-drawer-body td{padding:7px;border-bottom:1px solid #edf1f5}.economy-drawer-body .num{text-align:right;white-space:nowrap}.economy-loading{padding:28px;text-align:center;color:#657386;font-size:11px}.economy-progress{margin:10px 0;padding:8px 10px;border-radius:8px;background:#f6f8fb;color:#657386;font-size:10px;border:1px solid #e5ebf2}
    </style>
    <div class="exec-hero"><div class="official-badge">ANÁLISE AMPLA • ESTOQUE + COMPRA DIRETA</div><h2>Potencial de economia</h2><p>Visão executiva organizada por grupo. Clique em um grupo para consultar todos os itens com oportunidade de economia naquele grupo.</p></div>
    <div class="cards">
      <div class="card"><div class="k">Potencial estimado</div><div class="v">${br(s.potential)}</div><div class="s">Diferença entre cenário de maior e menor custo</div></div>
      <div class="card"><div class="k">Economia sobre maior custo</div><div class="v">${pc((s.potential||0)/(s.maxTotal||1))}</div><div class="s">Cenário máximo: ${br(s.maxTotal)}</div></div>
      <div class="card"><div class="k">Produtos analisados</div><div class="v">${n1(s.products)}</div><div class="s">${n1(s.opportunities)} com potencial positivo</div></div>
      <div class="card"><div class="k">Histórico de custos</div><div class="v">${n1(s.costObservations)}</div><div class="s">${n1(s.costProducts)} produtos • ${esc(s.costFrom)} a ${esc(s.costTo)}</div></div>
    </div>
    <div class="grid2">
      <div class="tablepanel economy-groups"><div class="tablehead"><div><h2>Potencial por grupo</h2><div class="hint">Clique no grupo para abrir todos os itens • maior potencial primeiro</div></div></div><div class="tablewrap" style="max-height:680px"><table><thead><tr><th>Grupo</th><th class="num">Produtos</th><th class="num">Oportunidades</th><th class="num">Potencial</th><th class="num">Participação</th></tr></thead><tbody id="economyGroups"></tbody></table></div></div>
      <div class="panel"><h2>Como interpretar</h2><p class="notice">A tela principal mostra somente os grupos para facilitar a leitura. Ao clicar em um grupo, o detalhamento abre imediatamente e apresenta os itens disponíveis daquele grupo.</p><p class="notice">Para cada item são exibidos quantidade analisada, maior e menor custo histórico, respectivas datas quando identificadas, variação percentual e potencial de economia em reais.</p><p class="notice">Esta análise inclui custos associados a compra direta e complementa — sem substituir — o histórico de compras com fornecedor.</p></div>
    </div>`;
  wrap.appendChild(sec);
  const rowsGroups=D.groups.filter(g=>(Number(g[3])||0)>0).sort((a,b)=>(Number(b[3])||0)-(Number(a[3])||0));
  const gbody=sec.querySelector('#economyGroups');
  gbody.innerHTML=rowsGroups.map(g=>`<tr data-group="${esc(g[0])}"><td><b>${esc(g[0])}</b></td><td class="num">${n1(g[1])}</td><td class="num">${n1(g[6])}</td><td class="num"><b>${br(g[3])}</b></td><td class="num">${pc((g[3]||0)/(s.potential||1))}</td></tr>`).join('');

  const backdrop=document.createElement('div');backdrop.className='economy-backdrop';
  const drawer=document.createElement('aside');drawer.className='economy-drawer';drawer.innerHTML='<div class="economy-drawer-head"><div><h3></h3><p></p></div><button type="button" class="economy-close">Fechar</button></div><div class="economy-drawer-tools"><input id="economyDrawerSearch" placeholder="Buscar código ou produto neste grupo"></div><div class="economy-drawer-body"></div>';
  document.body.append(backdrop,drawer);
  const close=()=>{backdrop.classList.remove('open');drawer.classList.remove('open')};backdrop.addEventListener('click',close);drawer.querySelector('.economy-close').addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  let selectedGroup='',renderQueued=false;

  function groupRows(){
    if(D.rowsByGroup&&Array.isArray(D.rowsByGroup[selectedGroup]))return D.rowsByGroup[selectedGroup];
    const all=Array.isArray(D.rows)?D.rows:[];
    return all.filter(r=>r[2]===selectedGroup&&(Number(r[9])||0)>0);
  }

  function renderGroup(){
    renderQueued=false;
    const body=drawer.querySelector('.economy-drawer-body'),q=(drawer.querySelector('#economyDrawerSearch').value||'').trim().toUpperCase();
    const source=groupRows();
    const rows=source.filter(r=>!q||String(r[0]).includes(q)||String(r[1]).toUpperCase().includes(q)).slice().sort((a,b)=>(Number(b[9])||0)-(Number(a[9])||0));
    const ready=!!window.ECONOMY_FULL_READY;

    if(!rows.length&&!ready&&!q){
      drawer.querySelector('.economy-drawer-head p').textContent='Abrindo itens do grupo...';
      body.innerHTML='<div class="economy-loading">Carregando os primeiros itens...</div>';
      return;
    }

    const total=rows.reduce((a,r)=>a+(Number(r[9])||0),0);
    drawer.querySelector('.economy-drawer-head p').textContent=`${rows.length} itens${ready?'':' carregados'} • ${br(total)} no filtro atual`;
    const progress=ready?'':'<div class="economy-progress">A lista já pode ser consultada. Os demais itens estão sendo carregados em segundo plano.</div>';
    const empty=rows.length?'':'<div class="economy-loading">Nenhum item encontrado neste filtro.</div>';
    const table=rows.length?`<table><thead><tr><th>#</th><th>Código</th><th>Produto</th><th>UN</th><th class="num">Qtd.</th><th class="num">Maior custo</th><th>Data maior</th><th class="num">Menor custo</th><th>Data menor</th><th class="num">Variação</th><th class="num">Potencial</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r[0]}</td><td>${esc(r[1])}</td><td>${esc(r[3])}</td><td class="num">${n1(r[4])}</td><td class="num">${br(r[5])}</td><td>${esc(r[6]||'—')}</td><td class="num">${br(r[7])}</td><td>${esc(r[8]||'—')}</td><td class="num">${r[10]==null?'—':pc(r[10])}</td><td class="num"><b>${br(r[9])}</b></td></tr>`).join('')}</tbody></table>`:'';
    body.innerHTML=progress+empty+table;
  }

  function scheduleRender(){
    if(renderQueued)return;
    renderQueued=true;
    requestAnimationFrame(renderGroup);
  }

  function openGroup(group){
    selectedGroup=group;
    drawer.querySelector('h3').textContent=group;
    drawer.querySelector('#economyDrawerSearch').value='';
    backdrop.classList.add('open');drawer.classList.add('open');
    scheduleRender();
  }

  gbody.addEventListener('click',e=>{const tr=e.target.closest('tr[data-group]');if(tr)openGroup(tr.dataset.group)});
  drawer.querySelector('#economyDrawerSearch').addEventListener('input',scheduleRender);
  window.addEventListener('economy-chunk-ready',()=>{if(drawer.classList.contains('open'))scheduleRender()});
  window.addEventListener('economy-full-data-ready',()=>{if(drawer.classList.contains('open'))scheduleRender()});

  btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));btn.classList.add('active');sec.classList.add('active')});
})();
