// Ajustes finais da identidade DB: logo inline + modulo executivo
(function(){
  if(document.documentElement.dataset.dbBrandFixes==='1')return;
  document.documentElement.dataset.dbBrandFixes='1';

  const style=document.createElement('style');
  style.id='db-brand-fixes';
  style.textContent=`
    .db-brand-logo-wrap{min-width:132px;min-height:52px}
    .db-brand-logo-svg{display:block;width:132px;height:auto}

    body.db-brand-theme #view-executivo{
      --b-navy:var(--db-green-deep)!important;
      --b-blue:var(--db-green)!important;
      --b-text:var(--db-ink)!important;
      --b-muted:var(--db-muted)!important;
      --b-line:var(--db-line)!important;
      --b-soft:var(--db-green-pale)!important;
      --b-green:var(--db-green)!important;
    }

    body.db-brand-theme #view-executivo .board-hero{
      background:linear-gradient(118deg,var(--db-green-deep),var(--db-green-strong) 62%,var(--db-green))!important;
      box-shadow:0 10px 28px rgba(13,71,38,.22)!important;
      border:1px solid rgba(255,255,255,.08)!important;
      position:relative;
      overflow:hidden;
    }
    body.db-brand-theme #view-executivo .board-hero:before{
      content:'';position:absolute;right:-35px;bottom:-95px;width:245px;height:245px;border-radius:50%;
      border:28px solid rgba(250,202,4,.09);pointer-events:none
    }
    body.db-brand-theme #view-executivo .board-hero:after{
      content:'';position:absolute;right:0;top:0;width:150px;height:7px;background:var(--db-yellow);pointer-events:none
    }
    body.db-brand-theme #view-executivo .board-hero h2,
    body.db-brand-theme #view-executivo .board-hero p,
    body.db-brand-theme #view-executivo .board-ref{color:#fff!important;position:relative;z-index:1}

    body.db-brand-theme #view-executivo .board-reading>div,
    body.db-brand-theme #view-executivo .board-kpi,
    body.db-brand-theme #view-executivo .board-decisions,
    body.db-brand-theme #view-executivo .board-panel{
      border-color:#d5e3d9!important;
      box-shadow:var(--db-shadow)!important;
    }
    body.db-brand-theme #view-executivo .board-reading b,
    body.db-brand-theme #view-executivo .board-kpi .value,
    body.db-brand-theme #view-executivo .board-title h3,
    body.db-brand-theme #view-executivo .board-decision .amount{
      color:var(--db-green-deep)!important;
    }
    body.db-brand-theme #view-executivo .board-kpi{position:relative;overflow:hidden}
    body.db-brand-theme #view-executivo .board-kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--db-green)}
    body.db-brand-theme #view-executivo .board-kpi:nth-child(2n):before{background:var(--db-yellow)}
    body.db-brand-theme #view-executivo .board-kpi.risk .value{color:#a43b3b!important}
    body.db-brand-theme #view-executivo .board-kpi.attn .value{color:#a66012!important}
    body.db-brand-theme #view-executivo .board-kpi.opp .value{color:var(--db-green)!important}

    body.db-brand-theme #view-executivo .board-link{
      border-color:#cfe0d5!important;background:#fff!important;color:var(--db-green-dark)!important
    }
    body.db-brand-theme #view-executivo .board-link:hover{
      background:var(--db-yellow-soft)!important;border-color:#efd76b!important
    }
    body.db-brand-theme #view-executivo .board-badge.blue{
      background:var(--db-green-soft)!important;color:var(--db-green-deep)!important
    }
    body.db-brand-theme #view-executivo .board-panel th{
      background:var(--db-green-deep)!important;color:#fff!important
    }
    body.db-brand-theme #view-executivo .board-panel td{border-bottom-color:#e8f0eb!important}
    body.db-brand-theme #view-executivo .board-panel tbody tr:hover{background:#ecf7f0!important}
    body.db-brand-theme #view-executivo .board-method{
      background:var(--db-green-pale)!important;border-color:#d5e3d9!important
    }
    body.db-brand-theme #view-executivo .board-method b{color:var(--db-green-deep)!important}

    @media(max-width:760px){.db-brand-logo-wrap{min-width:94px;min-height:38px}.db-brand-logo-svg{width:94px}}
  `;
  document.head.appendChild(style);

  function installLogo(){
    const wrap=document.querySelector('.db-brand-logo-wrap');
    if(!wrap)return false;
    wrap.innerHTML=`<svg class="db-brand-logo-svg" viewBox="0 0 385 177" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DB">
      <defs>
        <linearGradient id="dbLogoGreen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#2f6e50"/>
          <stop offset="0.48" stop-color="#168a48"/>
          <stop offset="1" stop-color="#109a43"/>
        </linearGradient>
      </defs>
      <path d="M37 45c18 14 41 20 70 15 34-6 51-18 64-5 16 16 17 45 4 66-12 20-35 31-66 32-31 1-55-8-67-26-10-15-15-34-20-55-4-16-2-23 15-27z" fill="url(#dbLogoGreen)"/>
      <path d="M37 45c8-19 29-31 52-29l-9 43c-19 3-34-2-43-14z" fill="#faca04"/>
      <path d="M151 67l18-25c2 17 9 30 18 42l-28-9z" fill="#faca04"/>
      <text x="198" y="124" font-family="Arial,Helvetica,sans-serif" font-size="94" font-weight="900" letter-spacing="-5" fill="#2a2a29">DB</text>
    </svg>`;
    return true;
  }

  if(!installLogo()){
    const observer=new MutationObserver(()=>{if(installLogo())observer.disconnect()});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),5000);
  }
})();
