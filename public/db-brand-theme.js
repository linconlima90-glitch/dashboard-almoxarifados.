// Identidade visual DB - tema institucional destacado
(function(){
  if(document.documentElement.dataset.dbBrandTheme==='2')return;
  document.documentElement.dataset.dbBrandTheme='2';

  const style=document.createElement('style');
  style.id='db-brand-theme';
  style.textContent=`
    :root{
      --db-green:#1e8747;
      --db-green-strong:#16733b;
      --db-green-dark:#125c31;
      --db-green-deep:#0d4726;
      --db-green-soft:#e6f3eb;
      --db-green-pale:#f3f9f5;
      --db-yellow:#faca04;
      --db-yellow-strong:#e9b900;
      --db-yellow-soft:#fff6c7;
      --db-ink:#2a2a29;
      --db-muted:#67716b;
      --db-line:#d8e4dc;
      --db-surface:#ffffff;
      --db-bg:#f2f6f3;
      --db-shadow:0 7px 24px rgba(17,92,49,.09);
      --db-shadow-strong:0 10px 28px rgba(13,71,38,.15);
    }

    body.db-brand-theme{background:var(--db-bg);color:var(--db-ink)}

    body.db-brand-theme header{
      background:linear-gradient(112deg,var(--db-green-deep),var(--db-green-strong))!important;
      border-bottom:4px solid var(--db-yellow)!important;
      box-shadow:0 6px 20px rgba(13,71,38,.22)!important;
      padding:14px 26px!important;
      min-height:92px;
      position:relative;
      overflow:hidden;
    }
    body.db-brand-theme header:before{content:'';position:absolute;right:-55px;top:-85px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.045)}
    body.db-brand-theme header:after{content:'';position:absolute;right:115px;bottom:-90px;width:190px;height:190px;border-radius:50%;border:26px solid rgba(250,202,4,.08)}
    .db-brand-head{display:flex;align-items:center;gap:19px;min-width:0;position:relative;z-index:2}
    .db-brand-logo-wrap{display:flex;align-items:center;justify-content:center;flex:0 0 auto;padding:7px 12px;background:#fff;border-radius:12px;box-shadow:0 5px 16px rgba(0,0,0,.14);border:1px solid rgba(255,255,255,.7)}
    .db-brand-logo{width:132px;height:auto;display:block}
    .db-brand-copy{min-width:0}
    body.db-brand-theme header h1{color:#fff!important;font-size:23px!important;line-height:1.12;margin:0!important;font-weight:900;letter-spacing:-.25px;text-shadow:0 1px 2px rgba(0,0,0,.08)}
    body.db-brand-theme header p{color:rgba(255,255,255,.86)!important;opacity:1!important;margin:6px 0 0!important;font-size:10.5px!important}

    body.db-brand-theme .clean-toolbar{
      border:1px solid #cdded3!important;
      background:rgba(255,255,255,.97)!important;
      box-shadow:0 7px 22px rgba(13,71,38,.09)!important;
    }
    body.db-brand-theme .clean-primary-btn{color:#536058;position:relative}
    body.db-brand-theme .clean-primary-btn:hover{background:var(--db-green-soft);color:var(--db-green-deep)}
    body.db-brand-theme .clean-primary-btn.active{background:linear-gradient(110deg,var(--db-green-dark),var(--db-green))!important;color:#fff!important;box-shadow:0 4px 10px rgba(30,135,71,.25)!important}
    body.db-brand-theme .clean-primary-btn.active:after{content:'';position:absolute;left:18%;right:18%;bottom:-3px;height:3px;border-radius:3px;background:var(--db-yellow)}
    body.db-brand-theme .clean-action-btn{border-color:#cfe0d5!important;color:var(--db-green-dark)!important;background:#fff!important}
    body.db-brand-theme .clean-action-btn:hover{background:var(--db-green-pale)!important;border-color:#aacdb7!important}
    body.db-brand-theme .clean-filter-count{background:var(--db-yellow)!important;color:var(--db-ink)!important;font-weight:900}
    body.db-brand-theme .clean-subnav{border-top-color:#dce8e0!important}
    body.db-brand-theme .clean-sub-btn:hover{background:var(--db-green-pale)!important;color:var(--db-green-dark)!important}
    body.db-brand-theme .clean-sub-btn.active{background:var(--db-yellow-soft)!important;border-color:#efd76b!important;color:var(--db-green-deep)!important;font-weight:900}

    body.db-brand-theme .filters{border-color:#cfe0d5!important;box-shadow:var(--db-shadow)!important}
    body.db-brand-theme .filter{background:#f6faf7!important;border:1px solid #e4eee7!important}
    body.db-brand-theme .filter label{color:var(--db-green-dark)!important;font-weight:850}
    body.db-brand-theme input:focus,body.db-brand-theme select:focus{outline:2px solid rgba(30,135,71,.18);border-color:var(--db-green)!important}

    body.db-brand-theme .card,
    body.db-brand-theme .panel,
    body.db-brand-theme .tablepanel,
    body.db-brand-theme .exec-kpi,
    body.db-brand-theme .exec-section,
    body.db-brand-theme .quote-kpi{
      border-color:#d5e3d9!important;
      box-shadow:var(--db-shadow)!important;
      background:#fff;
    }

    body.db-brand-theme .card,body.db-brand-theme .exec-kpi,body.db-brand-theme .quote-kpi{position:relative;overflow:hidden}
    body.db-brand-theme .card:before,body.db-brand-theme .exec-kpi:before,body.db-brand-theme .quote-kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--db-green)}
    body.db-brand-theme .card:nth-child(2n):before,body.db-brand-theme .exec-kpi:nth-child(2n):before{background:var(--db-yellow)}
    body.db-brand-theme .card:hover,body.db-brand-theme .exec-kpi:hover{transform:translateY(-1px);border-color:#b8d5c2!important;box-shadow:var(--db-shadow-strong)!important;transition:.16s ease}

    body.db-brand-theme .exec-hero{
      background:linear-gradient(118deg,var(--db-green-deep),var(--db-green-strong) 62%,var(--db-green))!important;
      box-shadow:0 10px 28px rgba(13,71,38,.22)!important;
      position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.08)!important;
    }
    body.db-brand-theme .exec-hero:before{content:'';position:absolute;right:-25px;bottom:-70px;width:225px;height:225px;border-radius:50%;background:rgba(255,255,255,.045)}
    body.db-brand-theme .exec-hero:after{content:'';position:absolute;right:0;top:0;width:150px;height:7px;background:var(--db-yellow)!important}
    body.db-brand-theme .exec-hero h2,body.db-brand-theme .exec-hero p{color:#fff!important;position:relative;z-index:1}
    body.db-brand-theme .official-badge{background:var(--db-yellow)!important;color:var(--db-green-deep)!important;border:1px solid var(--db-yellow-strong)!important;font-weight:900!important;box-shadow:0 2px 7px rgba(0,0,0,.08)}

    body.db-brand-theme .card .k,
    body.db-brand-theme .exec-kpi .k,
    body.db-brand-theme .quote-kpi .k{color:#67736b!important;font-weight:850}
    body.db-brand-theme .card .v,
    body.db-brand-theme .exec-kpi .v,
    body.db-brand-theme .quote-kpi .v{color:var(--db-green-deep)!important;font-weight:900}

    body.db-brand-theme .tablepanel{overflow:hidden}
    body.db-brand-theme .tablehead{background:linear-gradient(90deg,#fff,#f7fbf8)!important;border-bottom:2px solid #dce9e0!important}
    body.db-brand-theme .tablehead h2,body.db-brand-theme .panel h2{color:var(--db-green-deep)!important;font-weight:900}
    body.db-brand-theme thead th{background:var(--db-green-deep)!important;color:#fff!important;border-bottom-color:var(--db-green-deep)!important;padding-top:9px!important;padding-bottom:9px!important}
    body.db-brand-theme thead th.num{color:#fff!important}
    body.db-brand-theme tbody td{border-bottom-color:#e9f0eb!important}
    body.db-brand-theme tbody tr:nth-child(even){background:#fbfdfb}
    body.db-brand-theme tbody tr:hover{background:#ecf7f0!important}
    body.db-brand-theme tbody tr:hover td:first-child{box-shadow:inset 3px 0 0 var(--db-yellow)}
    body.db-brand-theme a{color:var(--db-green-dark)!important;font-weight:750}

    body.db-brand-theme .exec-section{border-left:3px solid var(--db-green)!important}
    body.db-brand-theme .exec-section-head{color:var(--db-green-deep)!important;font-weight:900!important;background:linear-gradient(90deg,#fff,#f8fbf9)!important}
    body.db-brand-theme .exec-section.clean-open .exec-section-head{border-bottom-color:#dce9e0!important}
    body.db-brand-theme .exec-section-head:after{color:var(--db-green)!important;font-weight:900!important}
    body.db-brand-theme .exec-table th{background:var(--db-green-deep)!important;color:#fff!important;border-bottom-color:var(--db-green-deep)!important}
    body.db-brand-theme .exec-action{border-color:#cfe0d5!important;color:var(--db-green-dark)!important;background:#fff!important}
    body.db-brand-theme .exec-action:hover{background:var(--db-yellow-soft)!important;border-color:#efd76b!important}
    body.db-brand-theme .clean-kpi-toggle{color:var(--db-green-dark)!important;font-weight:900!important}

    body.db-brand-theme .notice{background:#f7fbf8!important;border-color:#d8e6dc!important;border-left:4px solid var(--db-green)!important;color:#5f6c64!important}
    body.db-brand-theme .hint{color:#69766e!important}

    body.db-brand-theme button:not(.clean-primary-btn):focus-visible,
    body.db-brand-theme [role="button"]:focus-visible{outline:3px solid var(--db-yellow)!important;outline-offset:2px}

    body.db-brand-theme .economy-groups tbody tr:hover{background:#eaf6ee!important}
    body.db-brand-theme .economy-groups tbody td:first-child:before{color:var(--db-green)!important;font-size:15px!important}
    body.db-brand-theme .economy-drawer{box-shadow:-22px 0 50px rgba(13,71,38,.22)!important;border-left:4px solid var(--db-green)!important}
    body.db-brand-theme .economy-drawer-head{background:linear-gradient(90deg,#fff,#f5faf7)!important;border-bottom:2px solid #dbe8df!important}
    body.db-brand-theme .economy-drawer-head h3{color:var(--db-green-deep)!important;font-weight:900!important}
    body.db-brand-theme .economy-close{border-color:#bfd7c7!important;color:var(--db-green-dark)!important;background:#fff!important;font-weight:900!important}
    body.db-brand-theme .economy-close:hover{background:var(--db-yellow-soft)!important;border-color:#ecd05b!important}
    body.db-brand-theme .economy-drawer-tools{background:#f5faf7!important;border-bottom-color:#dfeae3!important}
    body.db-brand-theme .economy-drawer-body th{background:var(--db-green-deep)!important;color:#fff!important;border-bottom-color:var(--db-green-deep)!important}
    body.db-brand-theme .economy-progress{background:var(--db-yellow-soft)!important;border-color:#efd86c!important;color:var(--db-green-deep)!important;font-weight:800}

    body.db-brand-theme ::selection{background:rgba(250,202,4,.55);color:var(--db-ink)}

    @media(max-width:760px){
      body.db-brand-theme header{padding:11px 14px!important;min-height:78px}
      .db-brand-head{gap:11px}.db-brand-logo-wrap{padding:5px 8px;border-radius:9px}.db-brand-logo{width:94px}
      body.db-brand-theme header h1{font-size:17px!important}
      body.db-brand-theme header p{font-size:9px!important}
    }
  `;
  document.head.appendChild(style);
  document.body.classList.add('db-brand-theme');

  const header=document.querySelector('header');
  if(header){
    let head=header.querySelector('.db-brand-head');
    const h1=header.querySelector('h1');
    const p=header.querySelector('p');
    if(!head&&h1){
      head=document.createElement('div');head.className='db-brand-head';
      const logoWrap=document.createElement('div');logoWrap.className='db-brand-logo-wrap';
      const logo=document.createElement('img');logo.className='db-brand-logo';logo.src='/db-logo.svg?v=20260910-2';logo.alt='DB';logo.decoding='async';
      logoWrap.appendChild(logo);
      const copy=document.createElement('div');copy.className='db-brand-copy';
      header.insertBefore(head,header.firstChild);head.appendChild(logoWrap);head.appendChild(copy);copy.appendChild(h1);if(p)copy.appendChild(p);
    }else if(head&&!head.querySelector('.db-brand-logo-wrap')){
      const logo=head.querySelector('.db-brand-logo');
      if(logo){const logoWrap=document.createElement('div');logoWrap.className='db-brand-logo-wrap';logo.parentNode.insertBefore(logoWrap,logo);logoWrap.appendChild(logo);logo.src='/db-logo.svg?v=20260910-2';}
    }
  }
  document.title='DB | Gestão de Almoxarifados';
})();
