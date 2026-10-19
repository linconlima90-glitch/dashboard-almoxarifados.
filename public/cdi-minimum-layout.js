// CDI uses the same minimum-stock presentation, with its own filters and group selection.
// The authoritative rows remain the consolidated network demand and the CDI balance.
(function () {
  if (window.__CDI_MINIMUM_LAYOUT_INSTALLED) return;
  const panel = document.getElementById('cdiMinimumPanel');
  if (!panel) return;
  window.__CDI_MINIMUM_LAYOUT_INSTALLED = true;

  const state = { year: '', statuses: [], group: '' };
  const el = id => document.getElementById(id);
  const number = value => Number(value) || 0;
  const sum = (rows, field) => rows.reduce((total, row) => total + number(row[field]), 0);
  const critical = row => row.status === 'ABAIXO DO MÍNIMO' || row.status === 'SEM ESTOQUE';
  let base = [];

  function metric(label, value) {
    return '<div class="drilldown-metric"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }

  function selectGroup(group) {
    state.group = state.group === group ? '' : group;
    render();
    const row = Array.from(panel.querySelectorAll('[data-cdi-minimum-group]'))
      .find(item => item.dataset.cdiMinimumGroup === group);
    row?.focus({ preventScroll: true });
    if (state.group) requestAnimationFrame(() =>
      el('cdiMinimumItemsStage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function groupList(groups) {
    const list = document.createElement('div');
    list.className = 'movement-group-list';
    for (const group of groups) {
      const row = document.createElement('div');
      row.className = 'movement-group-row';
      row.classList.toggle('active', group.grupo === state.group);
      row.dataset.cdiMinimumGroup = group.grupo;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-expanded', String(group.grupo === state.group));
      row.setAttribute('aria-controls', 'cdiMinimumItemsStage');
      row.innerHTML = `<div class="movement-group-name" title="${htmlEsc(group.grupo)}">${htmlEsc(group.grupo)}</div>
        <div class="movement-group-metric"><span>Valor reposição</span><strong>${brl.format(group.need)}</strong></div>
        <div class="movement-group-metric"><span>Abaixo / sem estoque</span><strong>${n0.format(group.below)} / ${n0.format(group.withoutStock)}</strong></div>
        <div class="movement-group-metric optional"><span>Valor estoque</span><strong>${brl.format(group.stock)}</strong></div>`;
      row.addEventListener('click', () => selectGroup(group.grupo));
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectGroup(group.grupo);
        }
      });
      list.appendChild(row);
    }
    return list;
  }

  function render(rows) {
    if (Array.isArray(rows)) base = rows;
    let selected = minimumRowsForYear(base, state.year);
    if (state.statuses.length) selected = selected.filter(row => state.statuses.includes(row.status));
    const groups = aggregateMinimumGroups(selected);
    if (state.group && !groups.some(group => group.grupo === state.group)) state.group = '';

    el('cdiMinimumYear').value = state.year;
    panel.querySelectorAll('#cdiMinimumStatuses input').forEach(input => {
      input.checked = state.statuses.includes(input.value);
    });
    const period = state.year === '2025' ? '2025 · média com 12 meses completos'
      : state.year === '2026' ? '2026 · média com jan–set (9 meses completos); outubro parcial só entra na quantidade total'
      : 'Todos os anos · média dos meses completos do histórico';
    el('cdiMinimumFilterInfo').textContent = period + (state.statuses.length
      ? ' · status: ' + state.statuses.join(' + ') : ' · todos os status');
    el('cdiMinimumTitle').textContent = 'CDI Chua · estoque mínimo da rede' + (state.year ? ' · ' + state.year : '');
    el('cdiMinimumCount').textContent = n0.format(groups.length) + ' grupos e ' + n0.format(selected.length) + ' itens no escopo';
    el('cdiMinimumCollapse').style.display = state.group ? 'inline-block' : 'none';
    el('cdiMinimumOpenStock').textContent = state.group
      ? 'Abrir grupo na Gestão de Estoques' : 'Abrir local na Gestão de Estoques';

    const content = el('cdiMinimumContent');
    content.innerHTML = '<div class="drilldown-summary">' +
      metric('Qtd. total baixada', n2.format(sum(selected, 'total'))) +
      metric('Valor estimado de reposição', brl.format(sum(selected, 'need_value'))) +
      metric('Itens abaixo do mínimo', n0.format(selected.filter(critical).length)) +
      metric('Sem estoque com consumo', n0.format(selected.filter(row => row.status === 'SEM ESTOQUE').length)) +
      metric('Itens em atenção', n0.format(selected.filter(row => row.status === 'ATENÇÃO').length)) +
      '</div><div class="movement-stage"><div class="drilldown-stage-head"><h3>1. Grupos de produtos</h3>' +
      '<span>Ordenados pelo maior valor de necessidade de reposição. Clique para abrir os itens.</span></div>' +
      '<div id="cdiMinimumGroupList"></div></div><div class="movement-items" id="cdiMinimumItemsStage"></div>' +
      '<div class="movement-note">O mínimo de <b>2 meses</b> considera a demanda de todos os almoxarifados + o próprio Chua. ' +
      'A necessidade desconta o estoque atual do CDI. As transferências de distribuição não são somadas novamente ao consumo.</div>';

    const list = el('cdiMinimumGroupList');
    const stage = el('cdiMinimumItemsStage');
    if (!groups.length) {
      list.innerHTML = '<div class="warehouse-items-placeholder">Nenhum item corresponde ao ano/status selecionado.</div>';
      return;
    }
    list.appendChild(groupList(groups));
    if (!state.group) {
      stage.innerHTML = '<div class="warehouse-items-placeholder"><b>2. Itens do grupo</b><br>' +
        'Selecione um grupo para visualizar quantidade total baixada, estoque atual, cobertura, mínimo de 2 meses, necessidade e status.</div>';
      return;
    }
    const items = selected.filter(row => (row.grupo || 'SEM GRUPO') === state.group).slice().sort((a, b) =>
      number(b.total) - number(a.total) || number(b.need_value) - number(a.need_value) ||
      number(b.need) - number(a.need) || String(a.produto).localeCompare(String(b.produto), 'pt-BR'));
    stage.innerHTML = '<div class="warehouse-items-head"><h3>2. Itens do grupo · ' + htmlEsc(state.group) +
      ' · maior quantidade baixada primeiro</h3><span>' + n0.format(items.length) + ' itens</span></div>' +
      '<div class="drilldown-summary">' +
      metric('Qtd. total baixada', n2.format(sum(items, 'total'))) +
      metric('Valor reposição do grupo', brl.format(sum(items, 'need_value'))) +
      metric('Itens abaixo do mínimo', n0.format(items.filter(critical).length)) +
      '</div><div id="cdiMinimumItemsTable"></div>';
    el('cdiMinimumItemsTable').appendChild(buildMinimumItemsTable(items));
  }

  el('cdiMinimumYear').addEventListener('change', event => { state.year = event.target.value; render(); });
  el('cdiMinimumStatuses').addEventListener('change', () => {
    state.statuses = Array.from(panel.querySelectorAll('#cdiMinimumStatuses input:checked')).map(input => input.value);
    render();
  });
  el('cdiMinimumAllStatuses').addEventListener('click', () => { state.statuses = []; render(); });
  el('cdiMinimumCollapse').addEventListener('click', () => { state.group = ''; render(); });
  el('cdiMinimumOpenStock').addEventListener('click', () => {
    el('fEmpresa').value = '';
    el('fLocal').value = CDI_CHUA_MIN_LOCAL;
    el('fGrupo').value = state.group;
    if (typeof window.render === 'function') window.render();
    document.querySelector('.tab[data-view="estoque"]')?.click();
  });

  window.renderCdiMinimum = render;
  // The legacy page has rendered once before loading addons; the fast route queues this until ready.
  if (typeof window.renderCDI === 'function') window.renderCDI();
})();
