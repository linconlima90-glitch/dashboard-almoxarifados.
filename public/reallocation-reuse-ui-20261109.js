// Visao executiva do reaproveitamento entre unidades: valores e criterios separados.
// Foco: total gerencial (custo ERP), composicao, origem/destino e rastreabilidade.
// Nao confundir custo transferido com economia financeira comprovada.
(function () {
  'use strict';
  if (document.documentElement.dataset.dbPilot === '1') return;
  const ledger = window.DB_REALLOCATION_REUSE;
  const host = document.getElementById('cdi-transfer-panel');
  if (!ledger || !host || document.getElementById('reallocation-reuse-panel')) return;

  const rows = Array.isArray(ledger.transfers) ? ledger.transfers : [];
  const audit = ledger.audit || {};
  const total = a => a.reduce((s, x) => s + (Number(x.costCents) || 0), 0);
  const finalChua = rows.filter(r => r.classification === 'USO_FINAL_CHUA');
  const operational = rows.filter(r => r.classification === 'REAPROVEITAMENTO_OPERACIONAL');
  const centsTotal = total(rows), chuaCents = total(finalChua), othersCents = total(operational);
  if (ledger.schemaVersion !== 1 || rows.length !== audit.eligibleRows ||
      centsTotal !== audit.eligibleValueCents || chuaCents !== audit.finalUseChuaCents ||
      othersCents !== audit.otherReuseCents || chuaCents + othersCents !== centsTotal ||
      rows.some(r => r.destinationCode === '10551') ||
      finalChua.some(r => String(r.destinationCode) !== '30115') ||
      new Set(rows.map(r => r.id)).size !== rows.length) {
    throw Error('Base gerencial de reaproveitamento inconsistente');
  }

  const currency = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});
  const int = new Intl.NumberFormat('pt-BR', {maximumFractionDigits:0});
  const dec = new Intl.NumberFormat('pt-BR', {maximumFractionDigits:4});
  const money = cents => currency.format((Number(cents)||0)/100);
  const pct = cents => centsTotal ? (100*cents/centsTotal).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1})+'%' : '0%';
  const width = cents => centsTotal ? Math.max(0,Math.min(100,100*cents/centsTotal)).toFixed(2)+'%' : '0%';
  const escape = v => String(v == null ? '' : v).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = v => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const shortDestination = r => ({
    '30115':'Fazenda Chuá',
    '50115':'Fazenda São João',
    '160115':'Saco São Francisco',
    '570115':'Saco da Tapera'
  })[String(r.destinationCode)] || String(r.destination || r.destinationCode);
  const labelClass = r => r.classification === 'USO_FINAL_CHUA' ? 'Uso final na Chuá' : 'Reaproveitamento em outra unidade';
  const displayDate = v => String(v||'').split('-').reverse().join('/');

  const group = (field, labeler) => {
    const map = new Map();
    for (const r of rows) {
      const key = String(r[field]);
      if (!map.has(key)) map.set(key,{key,label:labeler(r),count:0,cents:0});
      const item=map.get(key); item.count++; item.cents+=Number(r.costCents)||0;
    }
    return [...map.values()].sort((a,b)=>b.cents-a.cents||a.label.localeCompare(b.label,'pt-BR'));
  };
  const origins = group('originCode',r=>r.origin);
  const destinations = group('destinationCode',shortDestination);
  const compositionPct = centsTotal ? 100*othersCents/centsTotal : 0;

  const panel = document.createElement('section');
  panel.id = 'reallocation-reuse-panel';
  panel.className = 'rr-panel';
  panel.setAttribute('aria-labelledby','rr-title');
  panel.innerHTML = [
    '<header class="rr-header">',
      '<div class="rr-intro">',
        '<p class="rr-eyebrow">CONTROLE DE ESTOQUE <span class="rr-sep">/</span> RESULTADO DO REAPROVEITAMENTO</p>',
        '<h2 id="rr-title">Materiais reaproveitados entre fazendas</h2>',
        '<p class="rr-lead">Estoque que estava sem utilização em uma unidade e foi destinado a outra que precisava do material.</p>',
      '</div>',
      '<div class="rr-period"><strong>Período analisado</strong><span>Desde 07/05/2026</span><span>Conferência ERP · 09/11/2026</span></div>',
    '</header>',
    '<div class="rr-primary-grid">',
      '<div class="rr-hero">',
        '<div class="rr-hero-label">VALOR DE MATERIAIS REAPROVEITADOS</div>',
        '<div class="rr-big-number">',money(centsTotal),'</div>',
        '<p>Referência de <b>compras potencialmente evitadas</b>, calculada pelo custo de saída registrado no ERP.</p>',
        '<div class="rr-hero-footer"><b>',int.format(rows.length),' lançamentos conciliados</b><span>',int.format(origins.length),' fazendas de origem · ',int.format(destinations.length),' destinos</span></div>',
      '</div>',
      '<div class="rr-composition" aria-label="Composição do valor reaproveitado">',
        '<div class="rr-composition-title">Como esse valor se divide</div>',
        '<div class="rr-split-item">',
          '<div><strong>Reaproveitamento em outras unidades</strong><span>',int.format(operational.length),' lançamentos · ',pct(othersCents),' do total</span></div>',
          '<b>',money(othersCents),'</b>',
        '</div>',
        '<div class="rr-split-item">',
          '<div><strong>Uso final na Fazenda Chuá</strong><span>',int.format(finalChua.length),' lançamentos recebidos da São João · ',pct(chuaCents),' do total</span></div>',
          '<b>',money(chuaCents),'</b>',
        '</div>',
        '<div class="rr-stacked" role="img" aria-label="',escape(pct(othersCents)),' para outras unidades e ',escape(pct(chuaCents)),' para uso final na Chuá">',
          '<span style="width:',compositionPct.toFixed(2),'%"></span><span class="rr-segment-secondary"></span>',
        '</div>',
        '<p class="rr-sum-note">Os dois valores acima <b>compõem</b> o total de ',money(centsTotal),'. Não devem ser somados novamente.</p>',
      '</div>',
    '</div>',
    '<div class="rr-meaning">',
      '<div class="rr-meaning-item rr-positive">',
        '<span class="rr-meaning-symbol" aria-hidden="true">✓</span>',
        '<div><strong>O que foi realizado</strong><p>Transferências físicas conciliadas e uso dos materiais nas unidades destinatárias.</p></div>',
      '</div>',
      '<div class="rr-meaning-item rr-pending">',
        '<span class="rr-meaning-symbol" aria-hidden="true">i</span>',
        '<div><strong>Economia financeira: ainda em apuração</strong><p>O custo do ERP <b>não comprova</b> a diferença de preço nem o valor contábil efetivamente economizado.</p></div>',
      '</div>',
      '<div class="rr-meaning-item rr-exclude">',
        '<span class="rr-meaning-symbol" aria-hidden="true">−</span>',
        '<div><strong>Fora deste indicador</strong><p>Perdas D410, granjas fora do controle e a distribuição de peças a partir do CDI da Chuá.</p></div>',
      '</div>',
    '</div>',
    '<div class="rr-analysis-title">',
      '<div><h3>De onde vieram e para onde foram</h3><p>Selecione uma fazenda para abrir os documentos correspondentes.</p></div>',
      '<span>Valores ao custo de saída do ERP</span>',
    '</div>',
    '<div class="rr-exploration">',
      '<div class="rr-breakdown-card">',
        '<h4>Fazendas que disponibilizaram materiais</h4>',
        '<p class="rr-breakdown-description">Origem dos estoques reaproveitados</p>',
        '<div class="rr-breakdown-list" id="rr-origin-breakdown"></div>',
      '</div>',
      '<div class="rr-breakdown-card">',
        '<h4>Fazendas que receberam materiais</h4>',
        '<p class="rr-breakdown-description">Locais de utilização ou consumo final</p>',
        '<div class="rr-breakdown-list" id="rr-destination-breakdown"></div>',
      '</div>',
    '</div>',
    '<details class="rr-documents" id="rr-documents">',
      '<summary><span class="rr-doc-icon">▦</span><span class="rr-doc-title"><strong>Ver lançamentos e notas de transferência</strong><small>Conferência dos ',int.format(rows.length),' itens: documento, material, quantidade, origem e destino</small></span><span class="rr-open-label">Abrir detalhes <span class="rr-chevron">⌄</span></span></summary>',
      '<div class="rr-document-content">',
        '<div class="rr-filters">',
          '<label>Fazenda de origem<select id="rr-origin-filter"><option value="">Todas as origens</option></select></label>',
          '<label>Fazenda de destino<select id="rr-destination-filter"><option value="">Todos os destinos</option></select></label>',
          '<label>Tipo de utilização<select id="rr-class-filter"><option value="">Todos os tipos</option><option value="REAPROVEITAMENTO_OPERACIONAL">Outras unidades</option><option value="USO_FINAL_CHUA">Uso final Chuá</option></select></label>',
          '<label>Localizar material ou NF<input type="search" id="rr-search" placeholder="Código, produto, nota..." autocomplete="off"></label>',
          '<button type="button" class="rr-clear" id="rr-clear">Limpar</button>',
        '</div>',
        '<div class="rr-document-totals"><div><strong id="rr-shown-count"></strong><span>lançamentos nos filtros</span></div><div><strong id="rr-shown-total"></strong><span>valor a custo ERP</span></div><button type="button" id="rr-export">Exportar CSV</button></div>',
        '<div class="rr-table-wrap"><table class="rr-table"><thead><tr>',
          ['Data','NF / documento','Origem','Destino','Código / material','Qtd.','Un.','Custo ERP','Classificação'].map(v=>'<th>'+escape(v)+'</th>').join(''),
        '</tr></thead><tbody id="rr-document-rows"></tbody></table></div>',
        '<p class="rr-proof-note">Origem: lançamentos de transferência conciliados pelo ERP. O custo de cada linha é o valor total da saída; não é uma nova baixa no estoque.</p>',
      '</div>',
    '</details>',
    '<footer class="rr-footer"><strong>Critério de leitura para a diretoria</strong><span>Material realocado é um benefício operacional. Para apresentar <b>economia financeira comprovada</b>, será necessário vincular cada transferência ao preço de compra alternativa e aos custos envolvidos. A distribuição do CDI é acompanhada em indicador separado.</span></footer>'
  ].join('');
  host.insertAdjacentElement('afterend',panel);

  const css = document.createElement('style');
  css.id = 'rr-executive-styles';
  css.textContent = [
    '#reallocation-reuse-panel{--rr-green:#17613d;--rr-dark:#173f2d;--rr-muted:#637b6e;--rr-line:#dce8e0;',
    'box-sizing:border-box;margin:16px 0 20px;padding:24px 25px 19px;background:#fff;border:1px solid #d7e6dc;',
    'border-radius:16px;box-shadow:0 5px 24px rgba(30,76,48,.04);font-family:inherit;color:var(--rr-dark)}',
    '#reallocation-reuse-panel *{box-sizing:border-box}',
    '#reallocation-reuse-panel .rr-header{display:flex;align-items:start;justify-content:space-between;gap:22px;margin-bottom:19px}',
    '#reallocation-reuse-panel .rr-eyebrow{margin:0 0 9px;color:#427f5b;font-size:10px;letter-spacing:.08em;font-weight:850}',
    '#reallocation-reuse-panel .rr-sep{color:#b4cabb;padding:0 6px}',
    '#reallocation-reuse-panel h2{margin:0 0 7px;font-size:21px;font-weight:900;letter-spacing:-.03em;color:#173f2d;line-height:1.25}',
    '#reallocation-reuse-panel .rr-lead{font-size:12px;color:#5d7364;line-height:1.55;margin:0;max-width:770px}',
    '#reallocation-reuse-panel .rr-period{font-size:11px;color:#566f60;border-left:2px solid #d5e5d9;padding:2px 0 2px 13px;display:grid;gap:5px;min-width:160px}',
    '#reallocation-reuse-panel .rr-period strong{font-size:10px;color:#224e34}',
    '#reallocation-reuse-panel .rr-primary-grid{display:grid;grid-template-columns:minmax(280px,1.07fr) minmax(330px,1fr);gap:13px}',
    '#reallocation-reuse-panel .rr-hero{border-radius:13px;background:linear-gradient(115deg,#eaf5ee 0%,#f4faf6 100%);border:1px solid #d6e9dd;padding:21px 23px 17px}',
    '#reallocation-reuse-panel .rr-hero-label{font-size:10px;font-weight:900;color:#356a49;letter-spacing:.065em}',
    '#reallocation-reuse-panel .rr-big-number{font-size:clamp(28px,3.2vw,39px);font-weight:900;line-height:1.32;letter-spacing:-.055em;color:#125b34;margin:6px 0 3px;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '#reallocation-reuse-panel .rr-hero p{font-size:12px;line-height:1.55;color:#466956;max-width:440px;margin:1px 0 17px}',
    '#reallocation-reuse-panel .rr-hero-footer{border-top:1px solid #cce3d3;padding-top:13px;display:flex;align-items:center;flex-wrap:wrap;gap:5px 12px;font-size:11px;color:#487156}',
    '#reallocation-reuse-panel .rr-hero-footer b{color:#185f36;font-size:12px}',
    '#reallocation-reuse-panel .rr-composition{border:1px solid var(--rr-line);border-radius:13px;padding:16px 18px 12px;background:#fcfefd}',
    '#reallocation-reuse-panel .rr-composition-title{font-size:11px;font-weight:850;color:#335f46;margin-bottom:7px}',
    '#reallocation-reuse-panel .rr-split-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #e8efea}',
    '#reallocation-reuse-panel .rr-split-item:last-of-type{border-bottom:0}',
    '#reallocation-reuse-panel .rr-split-item>div{min-width:0}',
    '#reallocation-reuse-panel .rr-split-item strong{font-size:12px;font-weight:800;display:block;line-height:1.4;color:#295840}',
    '#reallocation-reuse-panel .rr-split-item span{font-size:10px;color:#718477;display:block;margin-top:3px}',
    '#reallocation-reuse-panel .rr-split-item>b{font-size:17px;letter-spacing:-.03em;color:#174b31;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '#reallocation-reuse-panel .rr-stacked{display:flex;width:100%;height:10px;overflow:hidden;border-radius:10px;background:#e5eee7;margin:14px 0 10px}',
    '#reallocation-reuse-panel .rr-stacked span:first-child{height:100%;background:#21794c}',
    '#reallocation-reuse-panel .rr-stacked .rr-segment-secondary{flex:1;background:#a4cdb0}',
    '#reallocation-reuse-panel .rr-sum-note{font-size:10px;color:#66786d;line-height:1.55;margin:0}',
    '#reallocation-reuse-panel .rr-meaning{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 24px}',
    '#reallocation-reuse-panel .rr-meaning-item{display:flex;gap:10px;padding:11px 13px;border:1px solid #e3ebe5;border-radius:10px;background:#fbfcfa;min-width:0}',
    '#reallocation-reuse-panel .rr-meaning-item strong{font-size:11px;color:#244d34;line-height:1.45;display:block;margin:1px 0 4px}',
    '#reallocation-reuse-panel .rr-meaning-item p{font-size:10px;color:#657c6d;line-height:1.55;margin:0}',
    '#reallocation-reuse-panel .rr-meaning-symbol{display:grid;place-items:center;width:21px;height:21px;min-width:21px;border-radius:50%;font-size:12px;font-weight:900;background:#e2f1e5;color:#277a47}',
    '#reallocation-reuse-panel .rr-pending .rr-meaning-symbol{background:#f6eecf;color:#8d6a18}',
    '#reallocation-reuse-panel .rr-exclude .rr-meaning-symbol{background:#eef0f0;color:#657475}',
    '#reallocation-reuse-panel .rr-analysis-title{display:flex;justify-content:space-between;align-items:end;gap:15px;margin-bottom:13px;padding-top:16px;border-top:1px solid #e3ebe5}',
    '#reallocation-reuse-panel h3{margin:0 0 5px;color:#1b5133;font-size:15px;letter-spacing:-.015em}',
    '#reallocation-reuse-panel .rr-analysis-title p{font-size:11px;color:#6b7f71;margin:0}',
    '#reallocation-reuse-panel .rr-analysis-title>span{font-size:10px;color:#8a998e;white-space:nowrap}',
    '#reallocation-reuse-panel .rr-exploration{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}',
    '#reallocation-reuse-panel .rr-breakdown-card{border:1px solid var(--rr-line);border-radius:11px;padding:16px 17px 12px;min-width:0}',
    '#reallocation-reuse-panel h4{color:#234b32;margin:0 0 4px;font-size:12px;font-weight:850}',
    '#reallocation-reuse-panel .rr-breakdown-description{color:#7a887d;font-size:10px;margin:0 0 12px}',
    '#reallocation-reuse-panel .rr-breakdown-list{display:grid;gap:7px}',
    '#reallocation-reuse-panel .rr-breakdown-row{display:block;width:100%;border:1px solid transparent;background:transparent;text-align:left;cursor:pointer;border-radius:8px;padding:6px 8px}',
    '#reallocation-reuse-panel .rr-breakdown-row:hover,#reallocation-reuse-panel .rr-breakdown-row:focus-visible{background:#f2f8f4;border-color:#cae2d1;outline:none}',
    '#reallocation-reuse-panel .rr-breakdown-row[aria-pressed="true"]{background:#e8f5ec;border-color:#8ebca0}',
    '#reallocation-reuse-panel .rr-breakdown-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:11px}',
    '#reallocation-reuse-panel .rr-breakdown-head b{color:#234833;font-size:11px;line-height:1.35}',
    '#reallocation-reuse-panel .rr-breakdown-head strong{color:#1a5b39;font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '#reallocation-reuse-panel .rr-mini-track{background:#edf3ee;border-radius:6px;height:5px;margin:8px 0 5px;overflow:hidden}',
    '#reallocation-reuse-panel .rr-mini-track i{display:block;height:100%;background:#3f9565;border-radius:6px}',
    '#reallocation-reuse-panel .rr-breakdown-sub{display:flex;justify-content:space-between;font-size:10px;color:#788b7e}',
    '#reallocation-reuse-panel .rr-documents{border:1px solid #dce8df;border-radius:11px;overflow:hidden;background:#fff;margin-top:7px}',
    '#reallocation-reuse-panel .rr-documents>summary{display:flex;align-items:center;gap:13px;list-style:none;cursor:pointer;padding:15px 18px;min-height:65px;background:#f7faf8;color:#214f33}',
    '#reallocation-reuse-panel .rr-documents>summary::-webkit-details-marker{display:none}',
    '#reallocation-reuse-panel .rr-documents>summary:hover{background:#f0f7f2}',
    '#reallocation-reuse-panel .rr-doc-icon{border:1px solid #cde3d3;border-radius:9px;width:31px;height:31px;display:grid;place-items:center;color:#42835c;font-size:19px;flex-shrink:0}',
    '#reallocation-reuse-panel .rr-doc-title{flex:1;min-width:0}',
    '#reallocation-reuse-panel .rr-doc-title strong{display:block;font-size:12px}',
    '#reallocation-reuse-panel .rr-doc-title small{color:#72867a;font-size:10px;display:block;margin-top:4px}',
    '#reallocation-reuse-panel .rr-open-label{font-size:10px;color:#367b51;font-weight:800;white-space:nowrap}',
    '#reallocation-reuse-panel .rr-chevron{font-size:18px;vertical-align:middle;margin-left:6px;display:inline-block}',
    '#reallocation-reuse-panel .rr-documents[open] .rr-chevron{transform:rotate(180deg)}',
    '#reallocation-reuse-panel .rr-document-content{padding:16px;border-top:1px solid var(--rr-line)}',
    '#reallocation-reuse-panel .rr-filters{display:grid;grid-template-columns:repeat(3,minmax(115px,1fr)) minmax(170px,1.3fr) auto;gap:8px;align-items:end}',
    '#reallocation-reuse-panel .rr-filters label{font-size:10px;font-weight:750;color:#55715f;min-width:0}',
    '#reallocation-reuse-panel .rr-filters select,#reallocation-reuse-panel .rr-filters input{display:block;width:100%;height:36px;margin-top:5px;padding:8px;border:1px solid #d2dfd6;background:#fff;border-radius:7px;color:#264d33;font-size:11px;min-width:0}',
    '#reallocation-reuse-panel .rr-clear,#reallocation-reuse-panel #rr-export{border:1px solid #b7d2be;border-radius:7px;padding:9px 12px;background:#eef8f0;color:#225b3a;font-size:11px;font-weight:850;cursor:pointer;white-space:nowrap;min-height:36px}',
    '#reallocation-reuse-panel #rr-export{background:#1d7246;color:white;border-color:#1d7246}',
    '#reallocation-reuse-panel #rr-export:disabled{opacity:.5;cursor:default}',
    '#reallocation-reuse-panel .rr-document-totals{display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin:13px 0 11px;padding:10px 12px;background:#f7faf7;border:1px solid #e4ece6;border-radius:8px}',
    '#reallocation-reuse-panel .rr-document-totals>div{display:flex;align-items:baseline;gap:7px}',
    '#reallocation-reuse-panel .rr-document-totals strong{font-size:14px;color:#1c5e37}',
    '#reallocation-reuse-panel .rr-document-totals span{font-size:10px;color:#6f8174}',
    '#reallocation-reuse-panel .rr-document-totals button{margin-left:auto}',
    '#reallocation-reuse-panel .rr-table-wrap{max-height:450px;overflow:auto;border:1px solid #e0e9e2;border-radius:8px}',
    '#reallocation-reuse-panel .rr-table{border-collapse:collapse;min-width:1100px;width:100%;font-size:10px}',
    '#reallocation-reuse-panel .rr-table th{position:sticky;top:0;background:#ecf4ee;color:#356347;text-align:left;font-size:10px;white-space:nowrap;padding:11px 10px;z-index:1;border-bottom:1px solid #d6e8da}',
    '#reallocation-reuse-panel .rr-table td{padding:10px;border-bottom:1px solid #eaf0eb;vertical-align:top;line-height:1.45;color:#415b4a}',
    '#reallocation-reuse-panel .rr-table tr:hover td{background:#f8fbf9}',
    '#reallocation-reuse-panel .rr-table td:last-child{white-space:nowrap}',
    '#reallocation-reuse-panel .rr-table .rr-amount{white-space:nowrap;color:#195d38;font-weight:800;text-align:right;font-variant-numeric:tabular-nums}',
    '#reallocation-reuse-panel .rr-proof-note{font-size:10px;color:#75877a;margin:11px 0 0;line-height:1.5}',
    '#reallocation-reuse-panel .rr-footer{display:flex;gap:14px;margin-top:15px;padding:12px 0 0;border-top:1px solid #e3ebe6;align-items:flex-start;font-size:10px;line-height:1.6;color:#738175}',
    '#reallocation-reuse-panel .rr-footer strong{color:#51755d;white-space:nowrap}',
    '@media(max-width:1100px){#reallocation-reuse-panel .rr-primary-grid{grid-template-columns:1fr}#reallocation-reuse-panel .rr-meaning{grid-template-columns:1fr 1fr}#reallocation-reuse-panel .rr-filters{grid-template-columns:repeat(2,minmax(135px,1fr))}#reallocation-reuse-panel .rr-filters .rr-clear{grid-column:span 2}}',
    '@media(max-width:720px){#reallocation-reuse-panel{padding:17px 14px}#reallocation-reuse-panel .rr-header{flex-direction:column;gap:11px}#reallocation-reuse-panel .rr-period{border-left:0;border-top:1px solid #dae7dc;padding:9px 0 0;display:flex;flex-wrap:wrap;gap:7px 14px}#reallocation-reuse-panel h2{font-size:18px}#reallocation-reuse-panel .rr-hero{padding:17px}#reallocation-reuse-panel .rr-composition{padding:13px}#reallocation-reuse-panel .rr-meaning,#reallocation-reuse-panel .rr-exploration{grid-template-columns:1fr}#reallocation-reuse-panel .rr-analysis-title{align-items:start;flex-direction:column}#reallocation-reuse-panel .rr-analysis-title>span{white-space:normal}#reallocation-reuse-panel .rr-filters{grid-template-columns:1fr}#reallocation-reuse-panel .rr-filters .rr-clear{grid-column:auto}#reallocation-reuse-panel .rr-open-label{font-size:0}#reallocation-reuse-panel .rr-chevron{font-size:18px}#reallocation-reuse-panel .rr-footer{flex-direction:column;gap:4px}}'
  ].join('');
  document.head.appendChild(css);

  const $ = id => panel.querySelector('#'+id);
  const originFilter = $('rr-origin-filter');
  const destinationFilter = $('rr-destination-filter');
  const classFilter = $('rr-class-filter');
  const queryFilter = $('rr-search');
  const detail = $('rr-documents');

  function options(select, values) {
    values.forEach(item => {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }
  options(originFilter,origins);
  options(destinationFilter,destinations);

  function breakdownHTML(items,field) {
    return items.map(item =>
      '<button type="button" class="rr-breakdown-row" data-rr-filter="'+escape(field)+'" data-rr-key="'+escape(item.key)+'" aria-pressed="false" aria-label="Filtrar documentos: '+escape(item.label)+'">'+
        '<div class="rr-breakdown-head"><b>'+escape(item.label)+'</b><strong>'+money(item.cents)+'</strong></div>'+
        '<div class="rr-mini-track" aria-hidden="true"><i style="width:'+width(item.cents)+'"></i></div>'+
        '<div class="rr-breakdown-sub"><span>'+int.format(item.count)+' lançamentos</span><span>'+pct(item.cents)+' do total</span></div>'+
      '</button>'
    ).join('');
  }
  $('rr-origin-breakdown').innerHTML = breakdownHTML(origins,'origin');
  $('rr-destination-breakdown').innerHTML = breakdownHTML(destinations,'destination');

  let displayed = [];
  function rowMatches(r) {
    if (originFilter.value && String(r.originCode)!==originFilter.value) return false;
    if (destinationFilter.value && String(r.destinationCode)!==destinationFilter.value) return false;
    if (classFilter.value && r.classification!==classFilter.value) return false;
    const q=normalize(queryFilter.value.trim());
    return !q || normalize([r.product,r.productCode,r.invoice,r.document,r.origin,r.destination,r.id].join(' ')).includes(q);
  }
  function tableRow(r) {
    const documentNumber = 'NF '+String(r.invoice||'—')+' · '+String(r.document||'')+'/'+String(r.seq||'');
    return '<tr>'+
      '<td>'+escape(displayDate(r.date))+'</td>'+
      '<td>'+escape(documentNumber)+'</td>'+
      '<td>'+escape(r.origin)+'</td>'+
      '<td>'+escape(shortDestination(r))+'</td>'+
      '<td><b>'+escape(r.productCode)+'</b><div>'+escape(r.product)+'</div></td>'+
      '<td>'+escape(dec.format(r.quantity))+'</td>'+
      '<td>'+escape(r.unit)+'</td>'+
      '<td class="rr-amount">'+money(r.costCents)+'</td>'+
      '<td>'+escape(labelClass(r))+'</td>'+
    '</tr>';
  }
  function render() {
    displayed = rows.filter(rowMatches).sort((a,b)=>b.costCents-a.costCents||b.date.localeCompare(a.date));
    $('rr-shown-count').textContent=int.format(displayed.length);
    $('rr-shown-total').textContent=money(total(displayed));
    $('rr-export').disabled=!displayed.length;
    $('rr-document-rows').innerHTML=displayed.length
      ? displayed.map(tableRow).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:24px;color:#728377">Nenhum lançamento encontrado para os filtros escolhidos.</td></tr>';
    panel.querySelectorAll('.rr-breakdown-row').forEach(button=>{
      const selected=(button.dataset.rrFilter==='origin' ? originFilter.value : destinationFilter.value)===button.dataset.rrKey;
      button.setAttribute('aria-pressed', selected?'true':'false');
    });
  }
  [originFilter,destinationFilter,classFilter].forEach(el=>el.addEventListener('change',render));
  queryFilter.addEventListener('input',render);
  $('rr-clear').addEventListener('click',()=>{
    originFilter.value='';destinationFilter.value='';classFilter.value='';queryFilter.value='';
    render();
    queryFilter.focus();
  });
  panel.querySelectorAll('.rr-breakdown-row').forEach(button=>button.addEventListener('click',()=>{
    originFilter.value=button.dataset.rrFilter==='origin'?button.dataset.rrKey:'';
    destinationFilter.value=button.dataset.rrFilter==='destination'?button.dataset.rrKey:'';
    classFilter.value='';queryFilter.value='';
    detail.open=true;render();
    detail.scrollIntoView({behavior:'smooth',block:'nearest'});
  }));
  $('rr-export').addEventListener('click',()=>{
    const header=['Data','Nota Fiscal','Documento ERP','Sequência','Origem','Código Origem','Destino','Código Destino',
                  'Código Produto','Produto','Quantidade','Unidade','Custo ERP (R$)','Classificação'];
    const fields=r=>[displayDate(r.date),r.invoice,r.document,r.seq,r.origin,r.originCode,shortDestination(r),r.destinationCode,
                      r.productCode,r.product,r.quantity,r.unit,(r.costCents/100).toFixed(2).replace('.',','),labelClass(r)];
    const quote=v=>{
      let s=String(v==null?'':v);
      if (/^[=+@\-\t\r]/.test(s)) s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    };
    const csv='\uFEFF'+[header,...displayed.map(fields)].map(x=>x.map(quote).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download='reaproveitamento_entre_fazendas_2026.csv';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  });
  render();

  // API preservada para outros modulos do painel.
  window.DB_REALLOCATION_CONTROL={
    summary:{records:rows.length,valueCents:centsTotal,finalUseChuaCents:chuaCents,otherCents:othersCents},
    getRows:()=>rows.slice(),
    getFilteredRows:()=>displayed.slice(),
    refresh:render
  };
})();
