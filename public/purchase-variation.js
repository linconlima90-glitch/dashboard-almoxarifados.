// Aba: Variação de Compras
(function(){
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const perc=new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1});
  const num=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const style=document.createElement('style');
  style.textContent=`
    #view-variacao .variation-cards{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px;margin-bottom:13px}
    #view-variacao .variation-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px}
    #view-variacao .variation-card span{display:block;font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase}
    #view-variacao .variation-card strong{display:block;margin-top:6px;font-size:21px;color:var(--navy)}
    #view-variacao .variation-card.bad strong{color:var(--red)}
    #view-variacao .variation-table .var-high{font-weight:900;color:var(--red)}
    #view-variacao .variation-table .var-mid{font-weight:850;color:var(--orange)}
    #view-variacao .variation-table .var-low{font-weight:800;color:var(--green)}
    @media(max-width:900px){#view-variacao .variation-cards{grid-template-columns:repeat(2,1fr)}}
  `;
  document.head.appendChild(style);

  const tabs=document.querySelector('.tabs');
  if(!tabs || document.querySelector('.tab[data-view="variacao"]')) return;

  const btn=document.createElement('button');
  btn.className='tab';
  btn.dataset.view='variacao';
  btn.textContent='Variação de compras';
  tabs.appendChild(btn);

  const section=document.createElement('section');
  section.id='view-variacao';
  section.className='view';
  section.innerHTML=`
    <div class="variation-cards">
      <div class="variation-card"><span>Itens analisados</span><strong id="variationCount">0</strong></div>
      <div class="variation-card bad"><span>Maior variação</span><strong id="variationMax">0,0%</strong></div>
      <div class="variation-card"><span>Itens acima de 20%</span><strong id="variationOver20">0</strong></div>
      <div class="variation-card"><span>Itens com preço estável</span><strong id="variationStable">0</strong></div>
    </div>
    <div class="tablepanel variation-table">
      <div class="tablehead">
        <div><h2>Variação histórica de compra por item</h2><div class="hint">Mesmo código + unidade • preços zero desconsiderados • maior variação primeiro</div></div>
      </div>
      <div class="tablewrap" style="max-height:760px">
        <table>
          <thead><tr>
            <th>#</th><th>Código</th><th>Produto</th><th>Grupo</th><th>UN</th>
            <th class="num">Menor preço</th><th>Data menor</th><th>Fornecedor menor</th>
            <th class="num">Maior preço</th><th>Data maior</th><th>Fornecedor maior</th>
            <th class="num">Variação R$</th><th class="num">Variação %</th><th class="num">Compras</th>
          </tr></thead>
          <tbody id="variationRows"></tbody>
        </table>
      </div>
      <div class="notice">A variação percentual é calculada por <b>(maior preço − menor preço) ÷ menor preço</b>. Quando um fornecedor é selecionado no filtro superior, a comparação passa a considerar somente o histórico daquele fornecedor.</div>
    </div>`;
  const wrap=document.querySelector('.wrap');
  wrap.appendChild(section);

  function buildRows(){
    let base=[];
    try{base=purchasesFiltered()}catch(e){base=Array.isArray(PURCHASES)?PURCHASES:[]}
    const groups=new Map();
    for(const r of base){
      const price=Number(r.preco)||0;
      if(!(price>0)) continue;
      const key=String(r.codigo)+'|'+String(r.un||'');
      let g=groups.get(key);
      if(!g){g={codigo:r.codigo,produto:r.produto,grupo:r.grupo,un:r.un,min:r,max:r,count:0};groups.set(key,g)}
      g.count++;
      if(price < Number(g.min.preco)) g.min=r;
      if(price > Number(g.max.preco)) g.max=r;
    }
    const rows=[];
    for(const g of groups.values()){
      const min=Number(g.min.preco)||0,max=Number(g.max.preco)||0;
      if(!(min>0)) continue;
      rows.push({...g,minPrice:min,maxPrice:max,diff:max-min,varPct:(max-min)/min});
    }
    rows.sort((a,b)=>b.varPct-a.varPct || b.diff-a.diff || String(a.produto).localeCompare(String(b.produto),'pt-BR'));
    return rows;
  }

  function renderVariation(){
    const rows=buildRows();
    document.getElementById('variationCount').textContent=num.format(rows.length);
    document.getElementById('variationMax').textContent=rows.length?perc.format(rows[0].varPct):'0,0%';
    document.getElementById('variationOver20').textContent=num.format(rows.filter(x=>x.varPct>.20).length);
    document.getElementById('variationStable').textContent=num.format(rows.filter(x=>x.varPct===0).length);
    const tbody=document.getElementById('variationRows');
    if(!rows.length){tbody.innerHTML='<tr><td colspan="14" style="text-align:center;color:var(--muted);padding:22px">Sem compras para os filtros aplicados.</td></tr>';return}
    tbody.innerHTML=rows.map((x,i)=>{
      const cls=x.varPct>=.5?'var-high':x.varPct>=.2?'var-mid':'var-low';
      return `<tr>
        <td>${i+1}</td><td>${esc(x.codigo)}</td><td title="${esc(x.produto)}">${esc(x.produto)}</td><td>${esc(x.grupo)}</td><td>${esc(x.un)}</td>
        <td class="num">${money.format(x.minPrice)}</td><td>${esc(x.min.data)}</td><td>${esc(x.min.fornecedor)}</td>
        <td class="num">${money.format(x.maxPrice)}</td><td>${esc(x.max.data)}</td><td>${esc(x.max.fornecedor)}</td>
        <td class="num">${money.format(x.diff)}</td><td class="num ${cls}">${perc.format(x.varPct)}</td><td class="num">${num.format(x.count)}</td>
      </tr>`;
    }).join('');
  }

  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    section.classList.add('active');
    renderVariation();
  });

  for(const id of ['fEmpresa','fLocal','fGrupo','fUn','fFornecedor']){
    const el=document.getElementById(id); if(el) el.addEventListener('change',renderVariation);
  }
  const busca=document.getElementById('fBusca'); if(busca) busca.addEventListener('input',renderVariation);
  renderVariation();
})();
