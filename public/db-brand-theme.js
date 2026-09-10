// Identidade visual DB - tema institucional discreto
(function(){
  if(document.documentElement.dataset.dbBrandTheme==='1')return;
  document.documentElement.dataset.dbBrandTheme='1';

  const style=document.createElement('style');
  style.id='db-brand-theme';
  style.textContent=`
    :root{
      --db-green:#1e8747;
      --db-green-dark:#176a39;
      --db-green-deep:#12532d;
      --db-green-soft:#eaf5ee;
      --db-green-pale:#f5faf7;
      --db-yellow:#faca04;
      --db-yellow-soft:#fff8d9;
      --db-ink:#2a2a29;
      --db-muted:#68706b;
      --db-line:#dde6e0;
      --db-surface:#ffffff;
      --db-bg:#f5f7f6;
      --db-shadow:0 6px 22px rgba(30,135,71,.065);
    }

    body.db-brand-theme{background:var(--db-bg);color:var(--db-ink)}
    body.db-brand-theme header{background:#fff;border-bottom:1px solid var(--db-line);box-shadow:0 3px 14px rgba(42,42,41,.055);padding:12px 26px!important;min-height:74px;position:relative}
    body.db-brand-theme header:after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:3px;background:linear-gradient(90deg,var(--db-green) 0 82%,var(--db-yellow) 82% 100%)}
    .db-brand-head{display:flex;align-items:center;gap:18px;min-width:0}
    .db-brand-logo{width:118px;height:auto;display:block;flex:0 0 auto}
    .db-brand-copy{min-width:0}
    body.db-brand-theme header h1{color:var(--db-ink)!important;font-size:21px!important;line-height:1.15;margin:0!important;font-weight:850;letter-spacing:-.2px}
    body.db-brand-theme header p{color:var(--db-muted)!important;opacity:1!important;margin:5px 0 0!important;font-size:10.5px!important}

    body.db-brand-theme .clean-toolbar{border-color:var(--db-line);background:rgba(245,247,246,.96);box-shadow:0 5px 18px rgba(30,135,71,.045)}
    body.db-brand-theme .clean-primary-btn{color:#59645e}
    body.db-brand-theme .clean-primary-btn:hover{background:var(--db-green-soft);color:var(--db-green-dark)}
    body.db-brand-theme .clean-primary-btn.active{background:var(--db-green);color:#fff;box-shadow:0 2px 8px rgba(30,135,71,.20)}
    body.db-brand-theme .clean-action-btn{border-color:#d8e3dc;color:var(--db-green-dark)}
    body.db-brand-theme .clean-action-btn:hover{background:var(--db-green-pale)}
    body.db-brand-theme .clean-filter-count{background:var(--db-yellow);color:var(--db-ink)}
    body.db-brand-theme .clean-subnav{border-top-color:#e3ebe6}
    body.db-brand-theme .clean-sub-btn:hover{background:var(--db-green-pale);color:var(--db-green-dark)}
    body.db-brand-theme .clean-sub-btn.active{background:var(--db-green-soft);border-color:#cbe1d2;color:var(--db-green-dark)}

    body.db-brand-theme .filters{border-color:var(--db-line)!important;box-shadow:var(--db-shadow)!important}
    body.db-brand-theme .filter{background:#f7faf8!important}
    body.db-brand-theme .filter label{color:var(--db-green-dark)}
    body.db-brand-theme input:focus,body.db-brand-theme select:focus{outline:2px solid rgba(30,135,71,.16);border-color:var(--db-green)!important}

    body.db-brand-theme .card,
    body.db-brand-theme .panel,
    body.db-brand-theme .tablepanel,
    body.db-brand-theme .exec-kpi,
    body.db-brand-theme .exec-section,
    body.db-brand-theme .quote-kpi{border-color:var(--db-line)!important;box-shadow:var(--db-shadow)}

    body.db-brand-theme .exec-hero{background:linear-gradient(120deg,var(--db-green-dark),var(--db-green))!important;box-shadow:0 8px 24px rgba(30,135,71,.14)!important;position:relative;overflow:hidden}
    body.db-brand-theme .exec-hero:after{content:'';position:absolute;right:0;top:0;width:82px;height:5px;background:var(--db-yellow)}
    body.db-brand-theme .exec-hero h2,body.db-brand-theme .exec-hero p{color:#fff!important}
    body.db-brand-theme .official-badge{background:var(--db-yellow-soft)!important;color:var(--db-green-deep)!important;border:1px solid rgba(250,202,4,.45)!important}

    body.db-brand-theme .card .k,
    body.db-brand-theme .exec-kpi .k,
    body.db-brand-theme .quote-kpi .k{color:#6a746e}
    body.db-brand-theme .card .v,
    body.db-brand-theme .exec-kpi .v,
    body.db-brand-theme .quote-kpi .v{color:var(--db-ink)}
    body.db-brand-theme .card:hover,body.db-brand-theme .exec-kpi:hover{border-color:#c7ddcf!important}

    body.db-brand-theme .tablehead{background:#fff!important;border-bottom-color:#edf2ef!important}
    body.db-brand-theme .tablehead h2,body.db-brand-theme .panel h2{color:var(--db-ink)!important}
    body.db-brand-theme thead th{background:#eef6f1!important;color:var(--db-green-deep)!important;border-bottom-color:#d5e5db!important}
    body.db-brand-theme tbody td{border-bottom-color:#edf2ef!important}
    body.db-brand-theme tbody tr:hover{background:#f6fbf8!important}
    body.db-brand-theme a{color:var(--db-green-dark)}

    body.db-brand-theme .exec-section-head{color:var(--db-green-deep)!important}
    body.db-brand-theme .exec-section.clean-open .exec-section-head{border-bottom-color:#e3ece6!important}
    body.db-brand-theme .exec-section-head:after{color:var(--db-green)!important}
    body.db-brand-theme .exec-table th{background:#eef6f1!important;color:var(--db-green-deep)!important;border-bottom-color:#d5e5db!important}
    body.db-brand-theme .exec-action{border-color:#d7e4db!important;color:var(--db-green-dark)!important}
    body.db-brand-theme .exec-action:hover{background:var(--db-green-pale)!important}
    body.db-brand-theme .clean-kpi-toggle{color:var(--db-green-dark)!important}

    body.db-brand-theme .notice{background:#fbfdfb!important;border-color:#dfe9e2!important;border-left-color:var(--db-green)!important;color:#657069!important}
    body.db-brand-theme .hint{color:#758079}

    body.db-brand-theme button:not(.clean-primary-btn):focus-visible,
    body.db-brand-theme [role="button"]:focus-visible{outline:2px solid var(--db-yellow);outline-offset:2px}

    body.db-brand-theme .economy-groups tbody tr:hover{background:#f2f9f5!important}
    body.db-brand-theme .economy-groups tbody td:first-child:before{color:var(--db-green)!important}
    body.db-brand-theme .economy-drawer{box-shadow:-18px 0 45px rgba(30,70,45,.17)!important}
    body.db-brand-theme .economy-drawer-head h3{color:var(--db-green-deep)!important}
    body.db-brand-theme .economy-close{border-color:#d7e4db!important;color:var(--db-green-dark)!important}
    body.db-brand-theme .economy-drawer-tools{background:#f8faf9!important;border-bottom-color:#e6ede8!important}
    body.db-brand-theme .economy-drawer-body th{background:#eef6f1!important;color:var(--db-green-deep)!important;border-bottom-color:#d5e5db!important}
    body.db-brand-theme .economy-progress{background:var(--db-green-pale)!important;border-color:#dbe9df!important;color:#607067!important}

    body.db-brand-theme ::selection{background:rgba(250,202,4,.40);color:var(--db-ink)}

    @media(max-width:760px){
      body.db-brand-theme header{padding:10px 14px!important;min-height:64px}
      .db-brand-head{gap:11px}.db-brand-logo{width:88px}
      body.db-brand-theme header h1{font-size:17px!important}
      body.db-brand-theme header p{font-size:9px!important}
    }
  `;
  document.head.appendChild(style);
  document.body.classList.add('db-brand-theme');

  const header=document.querySelector('header');
  if(header&&!header.querySelector('.db-brand-head')){
    const h1=header.querySelector('h1');
    const p=header.querySelector('p');
    if(h1){
      const head=document.createElement('div');head.className='db-brand-head';
      const logo=document.createElement('img');logo.className='db-brand-logo';logo.src='/db-logo.svg?v=20260910';logo.alt='DB';logo.decoding='async';
      const copy=document.createElement('div');copy.className='db-brand-copy';
      header.insertBefore(head,header.firstChild);head.appendChild(logo);head.appendChild(copy);copy.appendChild(h1);if(p)copy.appendChild(p);
    }
  }
  document.title='DB | Gestão de Almoxarifados';
})();
