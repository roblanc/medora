/* Landing preview — mirrors #overview with live data, then routes into /app */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

async function apiGet(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch {
    return null;
  }
}

function moneyStatus(d) {
  return ({ temporary: 'Temporară', permanent: 'Permanentă', resumed: 'Reluată', unknown: 'Statut necunoscut' })[d.status] || 'Statut necunoscut';
}

function normalizeDisc(item) {
  const t = String(item.type || item.status || '').toLowerCase();
  let status = 'unknown';
  if (t.includes('tempor')) status = 'temporary';
  else if (t.includes('perman')) status = 'permanent';
  else if (t.includes('relu') || t.includes('reprise')) status = 'resumed';
  return {
    id: item.id || item.discId || item.name,
    name: item.name || item.productName || '—',
    strength: item.strength || item.concentration || '',
    note: item.note || item.reason || item.description || '',
    date: item.noticeDate || item.date || '',
    status,
    event: true,
  };
}

function provenanceLabel(iso) {
  if (!iso) return 'Verificare live · acum';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Verificare live · acum';
    return `Verificare live · ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return 'Verificare live · acum';
  }
}

function badge(d) {
  return `<span class="pill ${d.status === 'permanent' ? 'red' : d.status === 'resumed' ? 'green' : ''}">${moneyStatus(d)}</span>`;
}

function alertrows(list) {
  if (!list.length) return '<div class="empty">Nicio alertă recentă.</div>';
  return list.map((d) => `
    <article class="alertrow">
      <i class="statusdot ${d.status === 'permanent' ? 'red' : d.status === 'resumed' ? 'green' : ''}"></i>
      <div class="alerttext">
        <div class="rowtitle"><span class="plain">${esc(d.name)} ${esc(d.strength)}</span><span class="mini">ANMDMR</span></div>
        <p>${esc(d.note)}</p>
        <div class="alertmeta">${badge(d)}<span>${esc(d.date)}</span></div>
      </div>
    </article>`).join('');
}

function goApp(hash = 'overview', q = '') {
  if (q) {
    try { sessionStorage.setItem('medora-catalog-q', q); } catch (_) {}
  }
  location.href = `/app#${hash}`;
}

async function render() {
  const root = document.getElementById('landing-root');
  const [health, discStats, discList] = await Promise.all([
    apiGet('/health'),
    apiGet('/api/discontinuities/stats'),
    apiGet('/api/discontinuities?limit=6&sort=noticeDate&order=desc'),
  ]);

  const stats = discStats || { total: 0, temporara: 0, permanenta: 0, prelungire: 0 };
  const interrupts = (stats.temporara || 0) + (stats.permanenta || 0);
  const prelung = stats.prelungire || 0;
  const alerts = (discList?.results || []).map(normalizeDisc);
  const provIso = health?.stocks?.source?.fetchedAt || discStats?.source?.importedAt || new Date().toISOString();
  const pulseTitle = interrupts ? `${interrupts} schimbări necesită verificare.` : 'Radar disponibilitate actualizat.';
  const pulseSub = interrupts
    ? `${stats.temporara || 0} temporare, ${stats.permanenta || 0} permanente${prelung ? `, ${prelung} prelungiri` : ''} în datele ANMDMR.`
    : 'Nu sunt întreruperi active în ultimele notificări încărcate.';

  root.innerHTML = `
    <div class="heading">
      <div>
        <div class="eyebrow">SPAȚIUL TĂU CLINIC / ROMÂNIA</div>
        <h1>Situația de azi</h1>
        <p class="sub">Medicamente urmărite, schimbări de disponibilitate și sursele care le confirmă.</p>
      </div>
      <a class="btn" href="/app#overview">Preferințe alerte</a>
    </div>

    <div class="provenance-rail" aria-label="Starea surselor de date">
      <div><span class="provenance-dot"></span><strong>Surse monitorizate</strong></div>
      <span>ANMDMR</span><span>EMA</span><span>CNAS</span>
      <time datetime="${esc(provIso)}">${esc(provenanceLabel(provIso))}</time>
    </div>

    <div class="hero-grid">
      <section class="hero">
        <img class="hero-spot" src="spot-icons/medicine.png" alt="" aria-hidden="true">
        <div class="hero-copy">
          <div class="eyebrow">CĂUTARE ÎN NOMENCLATOARE</div>
          <h2>Găsește prezentarea exactă.</h2>
          <form id="landing-search" class="searchbox">
            <i class="ph ph-magnifying-glass"></i>
            <input name="q" aria-label="Caută medicamente" placeholder="Denumire, substanță activă sau cod ATC" autocomplete="off">
            <span class="key">↵</span>
          </form>
          <div class="searchhint">Exemple:
            <button type="button" data-search="amoxicilina">amoxicilină</button> ·
            <button type="button" data-search="sertralina">sertralină</button> ·
            cod ATC
          </div>
        </div>
      </section>
      <section class="pulsecard">
        <img class="pulse-spot" src="spot-icons/radar.png" alt="" aria-hidden="true">
        <div class="pulse-copy">
          <div class="eyebrow"><i class="ph ph-broadcast"></i> RADAR DISPONIBILITATE</div>
          <h2>${esc(pulseTitle)}</h2>
          <p>${esc(pulseSub)}</p>
          <a class="btn primary small" href="/app#radar">Deschide jurnalul <i class="ph ph-arrow-right"></i></a>
        </div>
      </section>
    </div>

    <div class="stats" aria-label="Rezumat operațional">
      <div class="stat">
        <img class="stat-spot" src="spot-icons/watchlist.png" alt="" aria-hidden="true">
        <div><strong>4</strong><div class="metriclabel">Sub observație</div><small>prezentări urmărite</small></div>
      </div>
      <div class="stat">
        <img class="stat-spot" src="spot-icons/compare.png" alt="" aria-hidden="true">
        <div><strong>${interrupts}</strong><div class="metriclabel">Întreruperi active</div><small>temporare sau permanente</small></div>
      </div>
      <div class="stat">
        <img class="stat-spot" src="spot-icons/sources.png" alt="" aria-hidden="true">
        <div><strong>${stats.total || alerts.length || 0}</strong><div class="metriclabel">Notificări ANMDMR</div><small>în baza de date locală</small></div>
      </div>
    </div>

    <div class="lower-grid">
      <section>
        <div class="section-head">
          <h2>Jurnal de schimbări</h2>
          <a class="linkbutton" href="/app#radar">Vezi jurnalul complet <i class="ph ph-arrow-right"></i></a>
        </div>
        <div class="panel">
          <div id="alerts">${alertrows(alerts)}</div>
        </div>
      </section>
      <section>
        <div class="section-head">
          <h2>Lista de urmărire</h2>
          <a class="linkbutton" href="/app#watch">Gestionează lista <i class="ph ph-arrow-right"></i></a>
        </div>
        <div class="panel">
          <div class="empty">Intră în aplicație pentru a urmări prezentările din practica ta.</div>
          <a class="addwatch" href="/app#catalog">Adaugă un medicament</a>
        </div>
        <div class="source-note">
          <i class="ph ph-shield-check"></i>
          <span>Fiecare schimbare este legată de documentul ANMDMR. Datele de pe această pagină sunt live.</span>
        </div>
      </section>
    </div>

    <div class="landing-cta-band">
      <div>
        <strong>Gata să lucrezi în spațiul tău clinic?</strong>
        <p>Deschide aplicația pentru catalog, radar complet, listă urmărită și instrumente.</p>
      </div>
      <a class="btn primary" href="/app#overview">Intră în Medora <i class="ph ph-arrow-right"></i></a>
    </div>
  `;

  const form = document.getElementById('landing-search');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const q = new FormData(e.target).get('q')?.trim() || '';
      goApp('catalog', q);
    };
  }
  document.querySelectorAll('[data-search]').forEach((b) => {
    b.onclick = () => goApp('catalog', b.dataset.search);
  });
}

render();
