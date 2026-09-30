// Visao dedicada de pneus e camaras - 30/09/2026
// Mantem pneus visiveis no estoque, sem inclui-los em reposicao/estoque-alvo.
(function(){
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const isTire=x=>{
    if(window.DASHBOARD_POLICY?.isTire) return window.DASHBOARD_POLICY.isTire(x);
    return norm(x?.grupo).includes('PNEU')||norm(x?.produto).startsWith('PNEU ')||norm(x?.grupo).includes('CAMARAS DE AR');
  };
  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const n2=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(v)||0);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function rows(){
    if(typeof STOCK==='undefined') return [];
    return STOCK.filter(isTire);
  }

  function aggregate(data){
    const byLocal=new Map();
    let value=0,qty=0;
    for(const x of data){
      value+=Number(x.valor_estoque)||0;
      qty+=Number(x.estoque)||0;
      const k=String(x.local||'Sem local');
      let a=byLocal.get(k);
      if(!a){a={local:k,pos:0,qty:0,value:0,products:new Set()};byLocal.set(k,a)}
      a.pos++;a.qty+=Number(x.estoque)||0;a.value+=Number(x.valor_estoque)||0;a.products.add(String(x.codigo||''));
    }
    return {value,qty,byLocal:[...byLocal.values()].sort((a,b)=>b.value-a.value)};
  }

  function render(){
    const root=document.querySelector('#view-executivo');
    if(!root) return;
    const data=rows(),a=aggregate(data);
    let panel=document.getElementById('tire-stock-panel');
    if(!panel){
      panel=document.createElement('section');
      panel.id='tire-stock-panel';
      panel.className='board-panel tire-stock-panel';
      root.appendChild(panel);
    }
    panel.innerHTML=`
      <div class="board-title">
        <div>
          <h3>Estoque de pneus e câmaras</h3>
          <span>Controle de saldo por almoxarifado • fora da reposição e do estoque-alvo do CDI Chua</span>
        </div>
      </div>
      <div class="tire-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:14px 0;">
        <div class="board-kpi"><div class="label">Posições</div><div class="value">${n2(data.length)}</div><div class="sub">linhas de estoque</div></div>
        <div class="board-kpi"><div class="label">Saldo total</div><div class="value">${n2(a.qty)}</div><div class="sub">unidades cadastradas</div></div>
        <div class="board-kpi"><div class="label">Valor em estoque</div><div class="value">${br(a.value)}</div><div class="sub">pneus e câmaras</div></div>
        <div class="board-kpi"><div class="label">Almoxarifados</div><div class="value">${n2(a.byLocal.length)}</div><div class="sub">com saldo de pneus/câmaras</div></div>
      </div>
      <div style="overflow:auto">
        <table>
          <thead><tr><th>Almoxarifado</th><th class="num">Produtos</th><th class="num">Posições</th><th class="num">Saldo</th><th class="num">Valor</th></tr></thead>
          <tbody>
            ${a.byLocal.map(x=>`<tr><td>${esc(x.local)}</td><td class="num">${n2(x.products.size)}</td><td class="num">${n2(x.pos)}</td><td class="num">${n2(x.qty)}</td><td class="num">${br(x.value)}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum saldo de pneus ou câmaras encontrado na posição atual.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.tab[data-view="executivo"],.clean-primary-btn[data-group="resumo"]')) setTimeout(render,30);
  });
  window.addEventListener('stock-position-updated',()=>setTimeout(render,30));
  setTimeout(render,250);
})();