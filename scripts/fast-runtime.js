/* Lazy rendering only: original calculation functions and datasets are preserved. */
(function () {
  if (window.DB_FAST) return;
  const registry = new Map(), dirty = new Set();
  const pilot = document.documentElement.dataset.dbPilot === '1';
  const stats = { started: performance.now(), requested: 0, rendered: 0, byView: {}, errors: [] };
  let booting = true, frame = 0;
  function activeView() {
    return pilot ? '__pilot__' : (document.querySelector('.tab.active')?.dataset.view || 'executivo');
  }
  function flush() {
    frame = 0;
    if (booting) return;
    const active = activeView();
    for (const [name, entry] of registry) {
      if (!dirty.has(name) || entry.view !== active) continue;
      dirty.delete(name);
      try {
        entry.fn.apply(entry.self, entry.args || []);
        stats.rendered++;
        stats.byView[active] = (stats.byView[active] || 0) + 1;
      } catch (error) {
        stats.errors.push(name + ': ' + String(error));
        console.error('Dashboard render failed: ' + name, error);
      }
    }
  }
  function schedule() { if (!booting && !frame) frame = requestAnimationFrame(flush); }
  window.DB_FAST = {
    stats,
    wrap(name, view, fn) {
      if (typeof fn !== 'function') throw new Error('Missing renderer: ' + name);
      const entry = { view, fn, self: window, args: [] };
      registry.set(name, entry); dirty.add(name);
      return function (...args) {
        stats.requested++; entry.self = this; entry.args = args;
        dirty.add(name); schedule();
      };
    },
    requestAll() {
      stats.requested++;
      for (const name of registry.keys()) dirty.add(name);
      schedule();
    },
    finish() {
      booting = false;
      this.requestAll(); flush();
      document.documentElement.classList.remove('db-booting');
      document.getElementById('db-boot-screen')?.remove();
      stats.ready = performance.now();
      document.documentElement.dataset.fastReady = '1';
      window.dispatchEvent(new CustomEvent('dashboard-ready'));
    },
    fail(message) {
      stats.errors.push(String(message));
      const status = document.querySelector('.db-boot-status');
      if (status) status.textContent = 'Nao foi possivel carregar os dados. Atualize a pagina para tentar novamente.';
    }
  };
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.tab,.clean-sub-btn,.clean-primary-btn')) {
      for (const [name, entry] of registry) if (entry.view === activeView()) dirty.add(name);
      schedule();
    }
  });
  window.addEventListener('error', event => { if (booting) window.DB_FAST.fail(event.message || 'Arquivo indisponivel'); });
})();
