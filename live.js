const phosphor={spark:'asterisk',grid:'squares-four',pill:'pill',radar:'broadcast',bookmark:'bookmark-simple',sliders:'sliders-horizontal',shield:'shield-check',book:'book-open',home:'house',bell:'bell',search:'magnifying-glass',arrow:'arrow-right',plus:'plus',x:'x',clock:'clock',alert:'warning',check:'check',link:'link-simple',download:'download-simple',map:'map-trifold',package:'package'};
const icon=n=>`<i class="ph ph-${phosphor[n]||phosphor.pill}" aria-hidden="true"></i>`;
function icons(){document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon))}

const sourceUrls={nomen:'https://nomenclator.anm.ro/medicamente',dis:'https://www.anm.ro/medicamente-de-uz-uman/autorizare-medicamente/notificari-discontinuitate-medicamente/',ema:'https://esmp.ema.europa.eu/',dhpc:'https://www.anm.ro/medicamente-de-uz-uman/farmacovigilenta/comunicari-directe-catre-profesionistii-din-domeniul-sanatatii-cdpds/'};

function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function strengthSuffix(d){
  const name=String(d?.name||'').trim();
  const strength=String(d?.strength||'').trim();
  if(!strength)return'';
  const nameKey=normal(name).replace(/[\s./-]+/g,'');
  const strengthKey=normal(strength).replace(/[\s./-]+/g,'');
  if(strengthKey&&nameKey.includes(strengthKey))return'';
  return strength;
}
function drugTitle(d){
  const name=String(d?.name||'').trim();
  const strength=strengthSuffix(d);
  return strength?`${name} ${strength}`.trim():name;
}
function debounce(fn,ms){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms)}}
function readStore(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function save(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch{toast('Stocare locală indisponibilă în acest browser.')}}
function normal(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}

async function apiGet(url){
  try{const res=await fetch(url);if(!res.ok)throw new Error('HTTP '+res.status);return await res.json()}catch{return null}
}
async function apiPost(url,body){
  try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok)throw new Error('HTTP '+res.status);return await res.json()}catch{return null}
}

function mapDiscType(type){
  if(type==='temporara'||type==='prelungire')return'temporary';
  if(type==='permanenta')return'permanent';
  return'unknown';
}

function formatDate(iso,raw){
  if(raw)return raw;
  if(!iso)return'';
  const p=String(iso).split('-');
  if(p.length===3){const months=['ian.','feb.','mar.','apr.','mai','iun.','iul.','aug.','sept.','oct.','nov.','dec.'];return`${parseInt(p[2],10)} ${months[parseInt(p[1],10)-1]||p[1]} ${p[0]}`}
  return iso;
}

function parseNameStrength(display,strength){
  const disp=String(display||'').trim();
  const str=String(strength||'').trim();
  if(str)return{name:disp.replace(new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),'').trim()||disp,strength:str};
  const m=disp.match(/^(.+?)\s+(\d[\d.,]*\s*(?:mg|g|μg|mcg|ml|ui|u\.i\.|%)[\w./\s]*)$/i);
  if(m)return{name:m[1].trim(),strength:m[2].trim()};
  return{name:disp,strength:''};
}

function normalizeSearchHit(hit){
  const conc=hit.concentration||'';
  const parsed=parseNameStrength(hit.display,conc);
  const id=hit.brand_key||hit.productId||hit.id||`search:${hit.dciKey||'x'}:${hit.display||Math.random()}`;
  return{
    id:String(id),
    name:parsed.name||hit.display||'',
    strength:conc||parsed.strength||'',
    dci:hit.dci||hit.inn||'',
    form:hit.form||'',
    atc:hit.atc||'',
    status:'unknown',
    date:'',
    note:'',
    event:'',
    group:hit.atc||'',
    dciKey:hit.dciKey||'',
    productId:hit.productId||hit.id||null,
    hasRcp:!!hit.hasRcp,
    brand_key:hit.brand_key||null,
    inn:hit.inn||'',
    holder:hit.holder||'',
    discId:null
  };
}

function normalizeDiscItem(item){
  const parsed=parseNameStrength(item.name,item.strength);
  const parts=[item.typeLabel,item.reasonLabel,item.holder,item.country,item.resumeLabel].filter(Boolean);
  return{
    id:`disc:${item.id}`,
    name:parsed.name||item.name||'',
    strength:parsed.strength||item.strength||'',
    dci:item.dci||'',
    form:item.form||'',
    atc:'',
    status:mapDiscType(item.type),
    date:formatDate(item.noticeDate,item.noticeDateRaw),
    note:parts.join(' · ')||'Notificare ANMDMR de discontinuitate.',
    event:item.typeLabel||'Discontinuitate',
    group:'',
    dciKey:'',
    productId:null,
    hasRcp:false,
    brand_key:null,
    inn:item.dci||'',
    discId:item.id,
    holder:item.holder||'',
    country:item.country||'',
    reasonLabel:item.reasonLabel||''
  };
}

function migrateFollowed(raw){
  if(!Array.isArray(raw))return[];
  if(!raw.length)return[];
  if(typeof raw[0]==='object'&&raw[0]?.id)return raw.filter(d=>d&&d.id);
  return[];
}

let followed=migrateFollowed(readStore('medora-followed-v2',[]));
let prefs=readStore('medora-prefs',{frequency:'daily',temporary:true,permanent:true,resumed:true});
let catalogHits=[];
let alerts=[];
let stats={health:null,disc:null,provenanceTime:''};
let selected=[];
let page='overview',filter='all',query=new URLSearchParams(location.search).get('q')||'';
let alertQuery='';
let alertPage=0;
const ALERTS_PER_PAGE=10;
let stockStats=null;
let stockProduct=null;
let stockSuggest=[];
let stockQuery='';
let romaniaMapSvg='';
let toastTimer;
let initDone=false;
const drugCache=new Map();

const $=s=>document.querySelector(s);
const remember=d=>{if(d?.id)drugCache.set(d.id,d);return d};
const isFollowed=id=>followed.some(d=>d.id===id);
const get=id=>{
  if(drugCache.has(id))return drugCache.get(id);
  const pools=[catalogHits,followed,alerts];
  for(const pool of pools){const hit=pool.find(d=>d.id===id);if(hit)return remember(hit)}
  return null;
};

function money(n,digits=2){
  if(n==null||Number.isNaN(Number(n)))return'—';
  return`${Number(n).toFixed(digits)} RON`;
}

function provenanceLabel(){
  const t=stats.provenanceTime;
  if(!t)return'Verificare live · acum';
  try{
    const d=new Date(t);
    if(Number.isNaN(d.getTime()))return'Verificare live · acum';
    return`Verificare live · ${d.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}`;
  }catch{return'Verificare live · acum'}
}

function interruptionCount(){
  const d=stats.disc||{};
  return(d.temporara||0)+(d.permanenta||0);
}

function radarBadgeCount(){
  const n=interruptionCount();
  if(n)return Math.min(99,n);
  return Math.min(99,alerts.length);
}

function updateNavCounts(){
  const watchEl=$('#navcount');
  if(watchEl)watchEl.textContent=String(followed.length);
  const radarEl=document.querySelector('.nav button[data-page="radar"] .count');
  if(radarEl)radarEl.textContent=String(radarBadgeCount());
}

function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000)}

const badge=d=>`<span class="pill ${d.status==='permanent'?'red':d.status==='resumed'?'green':''}">${({temporary:'Temporară',permanent:'Permanentă',resumed:'Reluată',unknown:'Statut necunoscut'})[d.status]||'Statut necunoscut'}</span>`;

const footer=()=>`<footer class="footer"><span>Medora · Claritate pentru profesioniști</span><span>Date live ANMDMR / CNAS / SER / DDInter. Nu înlocuiește sfatul medicului. &nbsp; <a href="#sources">Despre date ↗</a></span></footer>`;

const head=(title,sub,button='')=>`<div class="heading"><div><div class="eyebrow">SPAȚIUL TĂU CLINIC / ROMÂNIA</div><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p></div>${button}</div>`;

function matchesFollowed(d){
  const hay=normal([d.name,d.dci].join(' '));
  return followed.some(f=>{
    const fn=normal(f.name),fd=normal(f.dci);
    return(fn&&hay.includes(fn))||(fd&&hay.includes(fd))||(fn&&normal(d.name).includes(fn));
  });
}

function filteredAlerts(){
  let list=alerts.filter(d=>d.event);
  if(filter==='resumed')list=[];
  else if(filter!=='all')list=list.filter(d=>d.status===filter);
  const q=normal(alertQuery);
  if(q){
    list=list.filter(d=>normal([d.name,d.dci,d.strength,d.note,d.event].join(' ')).includes(q));
  }
  return list;
}

function pagedAlerts(list){
  const total=list.length;
  const pages=Math.max(1,Math.ceil(total/ALERTS_PER_PAGE)||1);
  if(alertPage>=pages)alertPage=pages-1;
  if(alertPage<0)alertPage=0;
  const start=alertPage*ALERTS_PER_PAGE;
  return{list:list.slice(start,start+ALERTS_PER_PAGE),total,pages,start};
}

function journalSearch(){
  return`<div class="journal-search searchbox">${icon('search')}<input id="alert-query" aria-label="Caută în jurnal" placeholder="Caută medicament, DCI sau notă" value="${esc(alertQuery)}" autocomplete="off"></div>`;
}

function journalPager(total,pages){
  if(total<=ALERTS_PER_PAGE)return`<div class="journal-pager"><span class="journal-pager-meta">${total} rezultate</span></div>`;
  const from=total?alertPage*ALERTS_PER_PAGE+1:0;
  const to=Math.min(total,(alertPage+1)*ALERTS_PER_PAGE);
  return`<div class="journal-pager" role="navigation" aria-label="Paginare jurnal">
    <span class="journal-pager-meta">${from}–${to} din ${total}</span>
    <div class="journal-pager-actions">
      <button type="button" class="btn small" data-alert-page="prev" ${alertPage<=0?'disabled':''}>← Anterior</button>
      <span class="journal-pager-page">Pagina ${alertPage+1} / ${pages}</span>
      <button type="button" class="btn small" data-alert-page="next" ${alertPage>=pages-1?'disabled':''}>Următor →</button>
    </div>
  </div>`;
}

function alertrows(list){
  return list.length?list.map(d=>`<article class="alertrow"><i class="statusdot ${d.status==='permanent'?'red':d.status==='resumed'?'green':''}"></i><div class="alerttext"><div class="rowtitle"><button class="plain" data-detail="${esc(d.id)}">${esc(drugTitle(d))}</button>${d.discId?`<span class="mini">ANMDMR</span>`:''}</div><p>${esc(d.note)}</p><div class="alertmeta">${badge(d)}<span>${esc(d.date)}</span></div></div><button class="rowwatch ${isFollowed(d.id)?'on':''}" data-follow="${esc(d.id)}" aria-label="${isFollowed(d.id)?'Nu mai urmări':'Urmărește'} ${esc(d.name)}" aria-pressed="${isFollowed(d.id)}">${icon(isFollowed(d.id)?'bookmark':'plus')}</button></article>`).join(''):'<div class="empty">Nicio alertă pentru acest filtru.</div>';
}

function journalBlock(opts={}){
  const only=opts.onlyFollowed?($('#only-followed')?.checked||false):false;
  let list=filteredAlerts();
  if(only)list=list.filter(d=>matchesFollowed(d));
  if(opts.preview){
    const limit=opts.limit||3;
    return`<div class="filters">${chips()}</div><div id="alerts">${alertrows(list.slice(0,limit))}</div>`;
  }
  const pageData=pagedAlerts(list);
  const followedToggle=opts.showFollowedToggle
    ?`<label class="journal-only"><input id="only-followed" type="checkbox" class="tick" ${only?'checked':''}>Doar lista mea</label>`
    :'';
  return`<div class="journal-toolbar">${journalSearch()}<div class="filters">${chips()}${followedToggle}</div></div><div id="alerts">${alertrows(pageData.list)}</div>${journalPager(pageData.total,pageData.pages)}`;
}

function watchrows(limit){
  const list=limit?followed.slice(0,limit):followed;
  return list.length?list.map(d=>`<div class="watchrow"><div class="drugicon"><img src="spot-icons/drug-pill.png" alt="" aria-hidden="true"></div><div class="info"><button class="plain" data-detail="${esc(d.id)}">${esc(drugTitle(d))}</button><small>${esc(d.dci)} · ${d.event?esc(d.event):'Statut necunoscut'}</small></div><button class="rowwatch arrow" data-detail="${esc(d.id)}" aria-label="Detalii ${esc(d.name)}">${icon('arrow')}</button></div>`).join(''):'<div class="empty">Urmărește primul medicament din catalog.</div>';
}

function chips(){return[['all','Toate'],['temporary','Temporare'],['permanent','Permanente'],['resumed','Reluate']].map(([id,l])=>`<button class="chip ${filter===id?'active':''}" data-filter="${id}" aria-pressed="${filter===id}">${l}</button>`).join('')}

function overview(){
  const interrupts=interruptionCount();
  const prelung=stats.disc?.prelungire||0;
  const pulseTitle=interrupts?`${interrupts} schimbări necesită verificare.`:'Radar disponibilitate actualizat.';
  const pulseSub=interrupts?`${stats.disc?.temporara||0} temporare, ${stats.disc?.permanenta||0} permanente${prelung?`, ${prelung} prelungiri`:''} în datele ANMDMR.`:'Nu sunt întreruperi active în ultimele notificări încărcate.';
  const provIso=stats.provenanceTime?new Date(stats.provenanceTime).toISOString():new Date().toISOString();
  return head('Situația de azi','Medicamente urmărite, schimbări de disponibilitate și sursele care le confirmă.',`<button class="btn" data-settings>${icon('sliders')}Preferințe alerte</button>`)+`<div class="provenance-rail" aria-label="Starea surselor de date"><div><span class="provenance-dot"></span><strong>Surse monitorizate</strong></div><span>ANMDMR</span><span>EMA</span><span>CNAS</span><time datetime="${esc(provIso)}">${esc(provenanceLabel())}</time></div><div class="hero-grid"><section class="hero" style="background:transparent!important;background-color:transparent!important;box-shadow:none!important;border:0!important;border-radius:0!important"><img class="hero-spot" src="spot-icons/medicine.png" alt="" aria-hidden="true"><div class="hero-copy"><div class="eyebrow">CĂUTARE ÎN NOMENCLATOARE</div><h2>Găsește prezentarea exactă.</h2><form id="hero-search" class="searchbox">${icon('search')}<input name="q" aria-label="Caută medicamente" placeholder="Denumire, substanță activă sau cod ATC" autocomplete="off"><span class="key">↵</span></form><div class="searchhint">Exemple: <button data-search="amoxicilina">amoxicilină</button> &nbsp;·&nbsp; <button data-search="sertralina">sertralină</button> &nbsp;·&nbsp; cod ATC</div></div></section><section class="pulsecard" style="background:transparent!important;background-color:transparent!important;box-shadow:none!important;border:0!important;border-radius:0!important"><img class="pulse-spot" src="spot-icons/radar.png" alt="" aria-hidden="true"><div class="pulse-copy"><div class="eyebrow">${icon('radar')} RADAR DISPONIBILITATE</div><h2>${esc(pulseTitle)}</h2><p>${esc(pulseSub)}</p><button class="btn primary small" data-go="radar">Deschide jurnalul ${icon('arrow')}</button></div></section></div><div class="stats" aria-label="Rezumat operațional"><div class="stat" style="background:transparent!important;background-color:transparent!important;box-shadow:none!important;border:0!important;border-radius:0!important"><img class="stat-spot" src="spot-icons/watchlist.png" alt="" aria-hidden="true"><div><strong>${followed.length}</strong><div class="metriclabel">Sub observație</div><small>prezentări urmărite</small></div></div><div class="stat" style="background:transparent!important;background-color:transparent!important;box-shadow:none!important;border:0!important;border-radius:0!important"><img class="stat-spot" src="spot-icons/compare.png" alt="" aria-hidden="true"><div><strong>${interrupts}</strong><div class="metriclabel">Întreruperi active</div><small>temporare sau permanente</small></div></div><div class="stat" style="background:transparent!important;background-color:transparent!important;box-shadow:none!important;border:0!important;border-radius:0!important"><img class="stat-spot" src="spot-icons/sources.png" alt="" aria-hidden="true"><div><strong>${stats.disc?.total||alerts.length||0}</strong><div class="metriclabel">Notificări ANMDMR</div><small>în baza de date locală</small></div></div></div><div class="lower-grid"><section><div class="section-head"><h2>Jurnal de schimbări</h2><button class="linkbutton" data-go="radar">Vezi jurnalul complet ${icon('arrow')}</button></div><div class="panel">${journalBlock({preview:true,limit:3})}</div></section><section><div class="section-head"><h2>Lista de urmărire</h2><button class="linkbutton" data-go="watch">Gestionează lista ${icon('arrow')}</button></div><div class="panel">${watchrows(4)}<button class="addwatch" data-go="catalog">Adaugă un medicament</button></div><div class="source-note">${icon('shield')}<span>Fiecare schimbare este legată de documentul ANMDMR, data publicării și nomenclatorul oficial. Datele sunt live din backend-ul Medora.</span></div></section></div>`;
}

function catalog(){
  return head('Medicamente','Caută, urmărește și compară prezentări din nomenclatorul ANMDMR.')+`<div class="searchbox catalog-search">${icon('search')}<input id="catalog-query" aria-label="Caută în catalog" placeholder="Denumire, DCI, ATC sau specialitate" value="${esc(query)}"></div><div class="panel tablewrap catalog-tablewrap"><table class="catalog-table"><thead><tr><th>Compară</th><th>Medicament / DCI</th><th>Formă / doză / ATC</th><th>Disponibilitate</th><th>Urmărire</th></tr></thead><tbody id="catalog-rows"></tbody></table></div><div id="compare-bar-wrap"></div><p class="source-note">Statusurile de discontinuitate provin din notificările ANMDMR. Aceeași DCI nu garantează substituția clinică.</p>`;
}

function tableRows(list){
  return list.length?list.map(d=>{
    const dose=d.strength||'—';
    const form=d.form||'—';
    return`<tr class="catalog-row ${selected.includes(d.id)?'is-selected':''}"><td class="col-select"><label class="compare-opt" title="Compară ${esc(d.name)}"><input class="tick" type="checkbox" data-select="${esc(d.id)}" aria-label="Compară ${esc(d.name)}" ${selected.includes(d.id)?'checked':''}><span class="compare-label">Compară</span></label></td><td class="col-drug"><button class="plain drug-title" data-detail="${esc(d.id)}">${esc(String(d.name||'').trim())}${strengthSuffix(d)?` <span class="drug-dose">${esc(strengthSuffix(d))}</span>`:''}</button><small class="drug-dci">${esc(d.dci)}</small></td><td class="col-meta"><span class="meta-form">${esc(form)}</span><span class="meta-separator">·</span><span class="meta-dose">${esc(dose)}</span><span class="meta-separator">·</span><small class="meta-atc">ATC: ${esc(d.atc||'—')}</small></td><td class="col-status">${badge(d)}</td><td class="col-action"><button class="btn small btn-follow ${isFollowed(d.id)?'followed':''}" data-follow="${esc(d.id)}" aria-pressed="${isFollowed(d.id)}">${icon(isFollowed(d.id)?'check':'plus')}<span>${isFollowed(d.id)?'Urmărit':'Urmărește'}</span></button></td></tr>`;
  }).join(''):'<tr class="catalog-row-empty"><td colspan="5"><div class="empty">Niciun rezultat. Încearcă o denumire comercială, DCI sau cod ATC.</div></td></tr>';
}

function renderCompareBar(){
  const el=$('#compare-bar-wrap');
  if(!el)return;
  if(selected.length===0){
    el.innerHTML=`<div class="comparebar comparebar-empty"><div class="compare-icon-wrap">${icon('sliders')}</div><div class="compare-text-wrap"><strong>Compară două medicamente</strong><p>Bifează „Compară” pe 2 produse din catalog pentru a deschide analiza comparativă (DCI, concentrație, disponibilitate, cod ATC).</p></div></div>`;
  }else if(selected.length===1){
    const d1=get(selected[0]);
    el.innerHTML=`<div class="comparebar comparebar-step1"><div class="compare-top"><span class="compare-badge">1 din 2 selectate</span><button class="compare-clear-btn" id="compare-clear">${icon('x')} Anulează</button></div><div class="compare-chips"><span class="compare-chip selected">${esc(d1?.name||'')} ${esc(d1?.strength||'')}</span><span class="compare-chip placeholder">+ Alege încă un medicament</span></div><p class="compare-subtext">Mai bifează încă un produs din listă pentru a activa comparația față în față.</p></div>`;
    $('#compare-clear').onclick=()=>{selected=[];updateCatalog()};
  }else if(selected.length===2){
    const d1=get(selected[0]),d2=get(selected[1]);
    el.innerHTML=`<div class="comparebar comparebar-ready"><div class="compare-top"><span class="compare-badge ready">${icon('check')} 2 din 2 pregătite</span><button class="compare-clear-btn" id="compare-clear">${icon('x')} Resetează</button></div><div class="compare-chips"><span class="compare-chip selected">${esc(d1?.name||'')}</span><span class="compare-vs">vs</span><span class="compare-chip selected">${esc(d2?.name||'')}</span></div><button class="btn primary compare-cta" id="compare">${icon('sliders')} Compară cele două prezentări →</button></div>`;
    $('#compare').onclick=compare;
    $('#compare-clear').onclick=()=>{selected=[];updateCatalog()};
  }
}

async function updateCatalog(){
  const rows=$('#catalog-rows');
  if(!rows)return;
  const q=query.trim();
  if(!q){
    catalogHits=[];
    rows.innerHTML=tableRows([]);
    renderCompareBar();
    return;
  }
  rows.innerHTML='<tr class="catalog-row-empty"><td colspan="5"><div class="empty">Se caută în nomenclator…</div></td></tr>';
  const data=await apiGet(`/api/drugs/search?q=${encodeURIComponent(q)}&limit=40`);
  catalogHits=(data?.results||[]).map(h=>remember(normalizeSearchHit(h)));
  await enrichCatalogStatus(catalogHits);
  rows.innerHTML=tableRows(catalogHits);
  renderCompareBar();
  bindRows();
}

async function enrichCatalogStatus(list){
  if(!list.length)return;
  const pool=alerts.length?alerts:null;
  for(const d of list){
    const hay=normal(d.name);
    if(!hay)continue;
    let hit=null;
    if(pool){
      hit=pool.find(a=>normal(a.name).includes(hay)||hay.includes(normal(a.name)));
    }
    if(!hit&&d.name){
      const disc=await apiGet(`/api/discontinuities?q=${encodeURIComponent(d.name)}&limit=2`);
      const raw=(disc?.results||[])[0];
      if(raw)hit=normalizeDiscItem(raw);
    }
    if(!hit)continue;
    d.status=hit.status||'unknown';
    d.date=hit.date||'';
    d.event=hit.event||'';
    d.note=hit.note||'';
    if(hit.discId)d.discId=hit.discId;
  }
}

const debouncedCatalogSearch=debounce(()=>updateCatalog(),250);

function radar(){
  return head('Radar de disponibilitate','De la notificare la acțiune: ce se schimbă, când și pentru ce prezentare.',`<button class="btn primary" data-settings>${icon('bell')}Configurează alertele</button>`)+`<p class="notice">Notificările provin din tabelul ANMDMR. O discontinuitate notificată nu dovedește absența din fiecare farmacie.</p><div class="panel fullradar">${journalBlock({showFollowedToggle:true,onlyFollowed:true})}</div><div class="source-note">${icon('link')}<a href="${sourceUrls.dis}" target="_blank" rel="noopener">Vezi sursa: notificări de discontinuitate ANMDMR ↗</a></div>`;
}

function watch(){
  return head('Lista mea','Medicamentele importante pentru practica ta. Preferințele se păstrează în acest browser.',`<button class="btn" data-go="catalog">${icon('plus')}Adaugă medicament</button>`)+`<div class="panel">${followed.length?followed.map(d=>`<div class="watchrow"><div class="drugicon"><img src="spot-icons/drug-pill.png" alt="" aria-hidden="true"></div><div class="info"><button class="plain" data-detail="${esc(d.id)}">${esc(drugTitle(d))}</button><small>${esc(d.dci)} · ${esc(d.form||'—')}</small></div>${badge(d)}<button class="iconbtn" data-follow="${esc(d.id)}" aria-label="Elimină ${esc(d.name)} din lista mea">${icon('x')}</button></div>`).join(''):'<div class="empty">Lista este goală. Adaugă medicamente din catalog.</div>'}</div><div class="comparebar"><span>Alerte pentru produsele pe care le urmărești.</span><button class="btn" data-settings>Preferințe ${icon('arrow')}</button></div>`;
}

function substButtons(){
  const dcis=[...new Set(followed.map(d=>d.dci).filter(Boolean))].slice(0,3);
  const defaults=[['Amoxicilină','500 mg'],['Metformină','850 mg'],['Sertralină','50 mg']];
  const items=dcis.length?followed.filter((d,i,a)=>d.dci&&a.findIndex(x=>x.dci===d.dci)===i).slice(0,3).map(d=>[d.dci,d.strength||'']):defaults;
  return items.map(([dci,str])=>`<button class="btn small" style="justify-content:space-between;padding:10px 14px" data-subst="${esc(dci)}"><span>Alternative <strong>${esc(dci)}</strong> ${esc(str)}</span>${icon('arrow')}</button>`).join('');
}

function tools(){
  return head('Instrumente clinice','Calculatoare matematice și utilitare de verificare clinică. Fără recomandări terapeutice directe.')+`<div class="toolsgrid"><section class="panel toolcard"><div class="toolcard-top"><span class="toolcard-badge">CALCUL MATEMATIC · ADULȚI</span><div class="toolcard-icon"><img src="spot-icons/tools.png" alt="" aria-hidden="true"></div></div><div class="toolcard-body"><h2>Indice de masă corporală</h2><p class="sub">Calcul ponderal IMC = greutate (kg) / înălțime² (m²). Util pentru ajustarea preliminară a dozelor.</p><form id="bmi-form"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px"><label class="field" style="margin:0">Greutate (kg)<input type="number" name="weight" min="1" max="500" step="0.1" value="70" required></label><label class="field" style="margin:0">Înălțime (cm)<input type="number" name="height" min="50" max="250" step="0.1" value="175" required></label></div><button class="btn primary" type="submit" style="width:100%;justify-content:center">Calculează IMC ${icon('arrow')}</button></form><div class="result" id="bmi-result" aria-live="polite" style="margin-top:14px">Introdu valorile pentru calcul. Rezultatul nu include interpretare clinică.</div></div></section><section class="panel toolcard"><div class="toolcard-top"><span class="toolcard-badge">SIGURANȚĂ CLINICĂ · LIVE</span><div class="toolcard-icon"><img src="spot-icons/interactions.png" alt="" aria-hidden="true"></div></div><div class="toolcard-body"><h2>Verificator compatibilitate & interacțiuni</h2><p class="sub">Analizează interacțiuni între două substanțe folosind baza DDInter conectată la Medora.</p><form id="interactions-form"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px"><label class="field" style="margin:0">Medicament A<input name="drug1" id="drug1-input" placeholder="Caută denumire sau DCI" autocomplete="off" list="drug1-list"><datalist id="drug1-list"></datalist></label><label class="field" style="margin:0">Medicament B<input name="drug2" id="drug2-input" placeholder="Caută denumire sau DCI" autocomplete="off" list="drug2-list"><datalist id="drug2-list"></datalist></label></div><button class="btn primary" type="submit" style="width:100%;justify-content:center">Verifică asocierea ${icon('arrow')}</button></form><div class="result" id="interactions-result" aria-live="polite" style="margin-top:14px">Alege două produse pentru analiza de interacțiune.</div></div></section><section class="panel toolcard"><div class="toolcard-top"><span class="toolcard-badge">ECHIVALENȚĂ TERAPEUTICĂ</span><div class="toolcard-icon"><img src="spot-icons/substitution.png" alt="" aria-hidden="true"></div></div><div class="toolcard-body"><h2>Finder substituție generică</h2><p class="sub">Găsește rapid alternative cu aceeași DCI în caz de notificare de discontinuitate.</p><div style="display:flex;flex-direction:column;gap:9px;margin-top:4px">${substButtons()}</div><p class="source-note" style="margin-top:14px">Substituția farmaceutică presupune validarea bioechivalenței conform ANMDMR.</p></div></section><section class="panel toolcard"><div class="toolcard-top"><span class="toolcard-badge">GHID DE PRESCRIERE</span><div class="toolcard-icon"><img src="spot-icons/prescription.png" alt="" aria-hidden="true"></div></div><div class="toolcard-body"><h2>Reguli de prescriere & posologie</h2><p class="sub">Informații orientative de administrare, ajustare doze și acces la documentele oficiale RCP.</p><div style="display:flex;flex-direction:column;gap:9px;margin-top:4px"><button class="btn small" style="justify-content:space-between;padding:10px 14px" data-presc="adulti"><span>Ghid adulți: antibioterapie de primă linie</span>${icon('arrow')}</button><button class="btn small" style="justify-content:space-between;padding:10px 14px" data-presc="varstnici"><span>Ajustare doze la pacienți vârstnici / eGFR</span>${icon('arrow')}</button></div><a class="btn-source" href="${sourceUrls.nomen}" target="_blank" rel="noopener" style="margin-top:14px;width:100%"><span>Consultă Nomenclatorul Oficial</span><span class="btn-source-arrow">${icon('arrow')}</span></a></div></section></div>`;
}

function sources(){
  const list=[['NOMENCLATOR','ANMDMR · Identitatea medicamentului','Denumire, DCI, formă, cod CIM, APP și documente oficiale. Autorizarea nu confirmă stocul.',sourceUrls.nomen,'spot-icons/source-nomen.png'],['DISPONIBILITATE','ANMDMR · Discontinuități','Notificări de întrerupere temporară sau permanentă. Fundament pentru alerte personalizate.',sourceUrls.dis,'spot-icons/source-radar.png'],['SIGURANȚĂ','ANMDMR · Comunicări directe','Informații adresate profesioniștilor. Flux distinct de discontinuitățile comerciale.',sourceUrls.dhpc,'spot-icons/source-safety.png'],['EXTINDERE EUROPEANĂ','EMA · Cataloage de discontinuități','Cataloage publice și registre naționale. Fără promisiunea unui inventar european complet.',sourceUrls.ema,'spot-icons/source-europe.png']];
  const loaded=stats.health?.ok?'Conexiune live la backend-ul Medora pe același domeniu.':'Backend parțial disponibil — unele surse pot lipsi temporar.';
  return head('O sursă clară. Pentru fiecare informație.',loaded)+`<div class="sourcesgrid">${list.map(([e,h,p,url,img])=>`<section class="panel sourcecard"><div class="sourcecard-top"><span class="sourcecard-badge">${esc(e)}</span><div class="sourcecard-icon"><img src="${esc(img)}" alt="" aria-hidden="true"></div></div><div class="sourcecard-body"><h3>${esc(h)}</h3><p>${esc(p)}</p></div><div class="sourcecard-footer"><a class="btn-source" href="${esc(url)}" target="_blank" rel="noopener"><span>Deschide sursa</span><span class="btn-source-arrow">${icon('arrow')}</span></a></div></section>`).join('')}</div><div class="panel sourcecard sourcecard-mock"><div class="sourcecard-top"><span class="sourcecard-badge">LIVE · METODOLOGIE</span><div class="sourcecard-icon"><img src="spot-icons/source-research.png" alt="" aria-hidden="true"></div></div><div class="sourcecard-body"><h3>Ce funcționează acum</h3><p>Căutare live în nomenclator, filtre de discontinuitate ANMDMR, listă urmărită persistentă, fișe produs, comparație, verificator DDInter, calculator IMC și preferințe salvate local.</p></div><div class="sourcecard-footer"><a class="btn-source btn-source-primary" href="/research" target="_blank"><span>Citește researchul și prioritățile</span><span class="btn-source-arrow">${icon('arrow')}</span></a></div></div>`;
}

function formatStock(n){
  return new Intl.NumberFormat('ro-RO').format(n||0);
}

function stockLevel(stock,max){
  if(stock<=0)return 0;
  const t=stock/Math.max(max,1);
  if(t<0.12)return 1;
  if(t<0.4)return 2;
  return 3;
}

function stocks(){
  const when=stockStats?.source?.fetchedAt?String(stockStats.source.fetchedAt).slice(0,10):'';
  const meta=stockStats?.loaded
    ?`${formatStock(stockStats.products)} produse · ${formatStock(stockStats.counties)} rânduri județ${when?` · actualizat ${when}`:''}`
    :'Harvest-ul SER este în curs sau lipsește. Reîncearcă în câteva minute.';
  const examples=(stockStats?.examples||[]).map(ex=>`<button type="button" class="chip stock-example" data-stock-id="${esc(String(ex.id))}">${esc(ex.name)}</button>`).join('');
  const suggest=stockSuggest.length
    ?`<ul class="stock-suggest" id="stock-suggest">${stockSuggest.map(item=>`<li><button type="button" data-stock-id="${esc(String(item.id))}"><strong>${esc(item.name)}</strong><span>${esc(item.dci)} · ${esc(item.form)} · ${esc(item.strength)} · ${formatStock(item.stockCountry)} u.</span></button></li>`).join('')}</ul>`
    :'';
  let detail='';
  if(stockProduct){
    const max=stockProduct.maxCountyStock||0;
    const counties=[...(stockProduct.counties||[])].sort((a,b)=>b.stock-a.stock);
    detail=`<div class="stock-detail panel">
      <div class="stock-detail-top">
        <div>
          <div class="eyebrow">${esc(stockProduct.dci||'SER')}</div>
          <h2>${esc(stockProduct.name)}</h2>
          <p class="sub">${esc([stockProduct.form,stockProduct.strength].filter(Boolean).join(' · '))}</p>
        </div>
        <div class="stock-national">
          <strong>${formatStock(stockProduct.stockCountry)}</strong>
          <span>stoc total național</span>
        </div>
      </div>
      <div class="stock-legend" aria-hidden="true">
        <span><i class="swatch lv0"></i>0</span>
        <span><i class="swatch lv1"></i>scăzut</span>
        <span><i class="swatch lv2"></i>mediu</span>
        <span><i class="swatch lv3"></i>ridicat</span>
      </div>
      <div class="stock-map-wrap">
        <div class="stock-map" id="stock-map" aria-label="Hartă interactivă pe județe"></div>
        <div class="stock-tip" id="stock-tip" hidden></div>
      </div>
      <div class="stock-counties" id="stock-counties">${counties.map(c=>{
        const lv=stockLevel(c.stock,max);
        return`<article class="stock-county lv${lv}" data-county-key="${esc(c.key)}"><strong>${esc(c.name)}</strong><span>${formatStock(c.stock)} u.</span></article>`;
      }).join('')}</div>
    </div>`;
  }else{
    detail=`<div class="stock-empty panel">
      <div class="stock-map-wrap stock-map-idle">
        <div class="stock-map" id="stock-map" aria-label="Hartă România"></div>
        <p class="stock-map-hint">Harta se colorează după ce selectezi un medicament</p>
      </div>
    </div>`;
  }
  return head('Stocuri pe județe','Disponibilitate raportată la SER (Ministerul Sănătății), vizualizată pe hartă. Agregat pe județ — nu pe raftul farmaciei.')+`
    <p class="notice">Datele reflectă stocurile raportate de distribuitori și farmacii către SER (OMS 1345/2016). Pot diferi de stocul real din această clipă.</p>
    <p class="stock-meta">${esc(meta)}</p>
    <div class="stock-search-wrap">
      <div class="searchbox catalog-search">${icon('search')}<input id="stock-query" aria-label="Caută stocuri" placeholder="Caută după denumire comercială, DCI sau concentrație" value="${esc(stockQuery)}" autocomplete="off"></div>
      ${suggest}
    </div>
    <div class="stock-examples"><span class="frequent-label">Încearcă de exemplu:</span>${examples||'<span class="sub">Se încarcă exemplele…</span>'}</div>
    ${detail}
    <p class="source-note">${icon('link')}<a href="https://ser.ms.ro/access/user" target="_blank" rel="noopener">Sursă: SER — Ministerul Sănătății ↗</a></p>`;
}

function render(){
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  updateNavCounts();
  $('#crumb').textContent=({overview:'Privire de ansamblu',catalog:'Medicamente',stocks:'Stocuri',radar:'Radar alerte',watch:'Lista mea',tools:'Instrumente',sources:'Surse & transparență'})[page];
  $('#content').innerHTML=({overview,catalog,stocks,radar,watch,tools,sources})[page]()+footer();
  bind();
}

function navigate(next){
  if(!['overview','catalog','stocks','radar','watch','tools','sources'].includes(next))next='overview';
  page=next;
  filter='all';
  alertPage=0;
  location.hash=next;
  render();
  window.scrollTo(0,0);
}

function follow(id){
  const drug=get(id);
  if(!drug){toast('Medicament negăsit.');return}
  if(isFollowed(id)){
    followed=followed.filter(x=>x.id!==id);
    toast('Medicament eliminat din lista mea');
  }else{
    followed=[...followed,remember(drug)];
    toast('Medicament adăugat în lista mea');
  }
  save('medora-followed-v2',followed);
  render();
}

function openModal(title,kicker,body){
  $('#modal-title').textContent=title;
  $('#modal-kicker').textContent=kicker;
  $('#modal-body').innerHTML=body;
  if(!$('#modal').open)$('#modal').showModal();
}

function truncBlock(label,text){
  if(!text)return'';
  const long=text.length>220;
  return`<div><small>${esc(label)}</small><p class="${long?'clamp':''}" style="font-size:12px;color:var(--muted);line-height:1.55">${esc(text)}</p>${long?`<button type="button" class="linkbutton detail-toggle">Vezi tot</button>`:''}</div>`;
}

function bindDetailToggles(){
  document.querySelectorAll('.detail-toggle').forEach(btn=>{
    btn.onclick=()=>{
      const p=btn.previousElementSibling;
      const on=p.classList.toggle('clamp');
      btn.textContent=on?'Vezi tot':'Restrânge';
    };
  });
}

async function detail(id){
  let d=get(id);
  if(!d){toast('Medicament negăsit.');return}
  openModal(drugTitle(d),d.discId?'NOTIFICARE ANMDMR · DISPONIBILITATE':'PREZENTARE · NOMENCLATOR','<p>Se încarcă datele…</p>');
  let product=null,discDetail=null;
  if(d.discId){
    discDetail=await apiGet(`/api/discontinuities/${d.discId}`);
  }
  if(d.hasRcp&&d.dciKey&&d.productId){
    product=await apiGet(`/api/drugs/n-class/${encodeURIComponent(d.dciKey)}/product/${encodeURIComponent(d.productId)}`);
  }else if(d.brand_key){
    const nom=await apiGet(`/api/drugs/nomenclator/${encodeURIComponent(d.brand_key)}`);
    if(nom){
      d=remember({...normalizeSearchHit(nom),id:d.id});
      if(d.hasRcp&&d.dciKey&&d.productId){
        product=await apiGet(`/api/drugs/n-class/${encodeURIComponent(d.dciKey)}/product/${encodeURIComponent(d.productId)}`);
      }
    }
  }
  if(product){
    if(product.form)d.form=product.form;
    if(product.concentration)d.strength=product.concentration;
    if(product.holder)d.holder=product.holder;
    remember(d);
  }
  const formLabel=d.form||product?.form||'—';
  const doseLabel=d.strength||product?.concentration||'—';
  const ficheUrl=(d.hasRcp&&d.dciKey&&d.productId)
    ?`/fisa/${encodeURIComponent(d.dciKey)}/${encodeURIComponent(d.productId)}`
    :'';
  const discBlock=d.discId?`<h3>Notificare discontinuitate</h3><div class="details"><div><small>Tip</small>${esc(d.event)}</div><div><small>Data</small>${esc(d.date)}</div><div><small>Deținător</small>${esc(discDetail?.holder||d.holder||'—')}</div><div><small>Țara</small>${esc(discDetail?.country||d.country||'—')}</div><div><small>Motiv</small>${esc(discDetail?.reasonLabel||d.reasonLabel||'—')}</div><div><small>DCI</small>${esc(d.dci||'—')}</div></div><p style="font-size:12px;color:var(--muted);margin-top:12px">${esc(d.note)}</p><button class="btn" id="disc-search-drug">Caută în nomenclator ${icon('search')}</button>`:'';
  const timeline=d.event&&!d.discId?`<h3>Istoricul disponibilității</h3><div class="timeline"><div><small>${esc(d.date)} · ANMDMR</small>${esc(d.event)}</div></div><p>${esc(d.note)}</p>`:(!d.discId?'<p>Nu avem evenimente de discontinuitate pentru această prezentare. Lipsa unei alerte nu confirmă disponibilitatea.</p>':'');
  const body=`<div class="rowtitle">${badge(d)}</div><p style="font-size:12px;color:var(--muted)">${d.discId?'Notificare publicată de ANMDMR. Verifică stocul local în farmacie.':'Prezentare din nomenclatorul ANMDMR. Detaliile RCP, compensarea și posologia se deschid din ghidul de prescriere.'}</p><div class="details"><div><small>Substanță activă</small>${esc(d.dci||product?.dci||'—')}</div><div><small>Doză / concentrație</small>${esc(doseLabel)}</div><div><small>Formă farmaceutică</small>${esc(formLabel)}</div><div><small>Cod ATC</small>${esc(d.atc||product?.cnas?.atc||'—')}</div><div><small>Deținător</small>${esc(d.holder||product?.holder||'—')}</div><div><small>Identificator</small>${esc(d.brand_key||d.productId||d.id)}</div></div>${discBlock||timeline}<div class="clinical-grid"><div class="clinical-card" style="cursor:pointer" id="detail-subst-card"><img src="spot-icons/substitution.png" alt="" aria-hidden="true"><div><div class="clinical-card-kicker">ALTERNATIVE DCI</div><div class="clinical-card-title">Prezentări cu ${esc(d.dci||'aceeași substanță')}</div></div></div><div class="clinical-card" style="cursor:pointer" id="detail-presc-card"><img src="spot-icons/prescription.png" alt="" aria-hidden="true"><div><div class="clinical-card-kicker">GHID PRESCRIERE</div><div class="clinical-card-title">Posologie & RCP: ${esc(formLabel)}</div></div></div></div><div class="modalfoot"><button id="detail-follow" class="btn primary">${icon(isFollowed(id)?'check':'plus')}${isFollowed(id)?'Nu mai urmări':'Urmărește medicamentul'}</button><button id="same-dci" class="btn">Compară prezentări ${icon('arrow')}</button>${ficheUrl?`<a class="btn" id="open-fiche" href="${esc(ficheUrl)}">Deschide fișa medicamentului ${icon('arrow')}</a>`:`<a class="btn" href="${sourceUrls.nomen}" target="_blank" rel="noopener">Deschide nomenclatorul ↗</a>`}</div>`;
  $('#modal-title').textContent=drugTitle(d);
  $('#modal-kicker').textContent=d.discId?'NOTIFICARE ANMDMR · DISPONIBILITATE':'PREZENTARE · NOMENCLATOR';
  $('#modal-body').innerHTML=body;
  $('#detail-follow').onclick=()=>{follow(id);detail(id)};
  $('#same-dci').onclick=()=>{$('#modal').close();query=d.dci||d.name;selected=[id];navigate('catalog')};
  if($('#detail-subst-card'))$('#detail-subst-card').onclick=()=>{$('#modal').close();query=d.dci||d.name;navigate('catalog')};
  if($('#detail-presc-card'))$('#detail-presc-card').onclick=()=>{
    if(ficheUrl){location.href=ficheUrl;return}
    toast('Fișa RCP nu este disponibilă pentru această prezentare.');
  };
  if($('#disc-search-drug'))$('#disc-search-drug').onclick=()=>{$('#modal').close();query=d.name||d.dci;navigate('catalog')};
}

async function openPrescModal(product,d){
  if(d?.hasRcp&&d?.dciKey&&d?.productId){
    location.href=`/fisa/${encodeURIComponent(d.dciKey)}/${encodeURIComponent(d.productId)}`;
    return;
  }
  if(product?.dciKey&&product?.id){
    location.href=`/fisa/${encodeURIComponent(product.dciKey)}/${encodeURIComponent(product.id)}`;
    return;
  }
  toast(`Fișa RCP nu este disponibilă pentru ${d?.name||'acest produs'}.`);
}

function settings(){
  openModal('Alerte care contează pentru tine','PREFERINȚE · SALVARE LOCALĂ',`<p>Alege tipurile de evenimente pentru lista ta. Notificările se pot previzualiza local.</p><form id="prefs-form"><label class="checkline"><input class="tick" name="temporary" type="checkbox" ${prefs.temporary?'checked':''}>Discontinuități temporare</label><label class="checkline"><input class="tick" name="permanent" type="checkbox" ${prefs.permanent?'checked':''}>Discontinuități permanente</label><label class="checkline"><input class="tick" name="resumed" type="checkbox" ${prefs.resumed?'checked':''}>Reluări de comercializare</label><label class="field">Frecvență dorită<select name="frequency"><option value="daily" ${prefs.frequency==='daily'?'selected':''}>Rezumat zilnic</option><option value="immediate" ${prefs.frequency==='immediate'?'selected':''}>La fiecare schimbare</option><option value="weekly" ${prefs.frequency==='weekly'?'selected':''}>Rezumat săptămânal</option></select></label><button class="btn primary" type="submit">Salvează și previzualizează ${icon('arrow')}</button></form>`);
  $('#prefs-form').onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    prefs={frequency:f.get('frequency'),temporary:f.has('temporary'),permanent:f.has('permanent'),resumed:f.has('resumed')};
    save('medora-prefs',prefs);
    let list=alerts.filter(a=>{
      if(!matchesFollowed(a))return false;
      if(a.status==='temporary'&&!prefs.temporary)return false;
      if(a.status==='permanent'&&!prefs.permanent)return false;
      if(a.status==='resumed'&&!prefs.resumed)return false;
      return true;
    });
    openModal('Preferințe salvate','PREVIZUALIZARE · NU SE TRIMITE',`<p>Ritm selectat: ${({daily:'zilnic',weekly:'săptămânal',immediate:'la fiecare schimbare'})[prefs.frequency]}. ${list.length} evenimente corespund listei și preferințelor tale.</p><div class="panel">${alertrows(list)}</div><p style="margin-top:18px">Trimiterea emailurilor și notificărilor push necesită implementarea serviciului.</p>`);
    bindRows();
  };
}

function compare(){
  if(selected.length!==2)return;
  const a=get(selected[0]),b=get(selected[1]);
  if(!a||!b){toast('Selectează două medicamente valide.');return}
  const isSameDci=normal(a.dci)===normal(b.dci)&&!!a.dci;
  const isSameStrength=a.strength===b.strength;
  const isSameForm=a.form===b.form;
  const interactBtn=!isSameDci?`<button class="btn primary" id="compare-interact">${icon('alert')} Verifică interacțiuni ${esc(a.dci)} + ${esc(b.dci)}</button>`:'';
  openModal('Comparație de prezentări','DATE NOMENCLATOR · FĂRĂ ECHIVALENȚĂ CLINICĂ AUTOMATĂ',`<p>Aceeași substanță, concentrație și formă nu garantează interschimbabilitatea. Comparație administrativă din nomenclator.</p><div class="tablewrap"><table><thead><tr><th>Câmp</th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${[['DCI',a.dci,b.dci],['Concentrație',a.strength,b.strength],['Formă',a.form||'—',b.form||'—'],['ATC',a.atc||'—',b.atc||'—'],['Statut',badge(a),badge(b)],['Stoc local','Necunoscut','Necunoscut']].map(r=>`<tr>${r.map(v=>`<td>${typeof v==='string'?esc(v):v}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="clinical-compare-box"><img src="${isSameDci?'spot-icons/substitution.png':'spot-icons/interactions.png'}" alt="" aria-hidden="true"><div><div class="clinical-card-kicker">${isSameDci?'ANALIZĂ SUBSTITUȚIE BIOECHIVALENȚĂ':'VERIFICARE ASOCIERE & INTERACȚIUNI'}</div><div class="clinical-card-title">${isSameDci?(isSameStrength&&isSameForm?`Potențial de substituție generică directă: ambele conțin ${esc(a.dci)} ${esc(a.strength)}.`:`Aceeași substanță activă (${esc(a.dci)}), dar formele sau concentrațiile diferă.`):`Asociere terapeutică între ${esc(a.dci)} și ${esc(b.dci)}.`}</div><small style="display:block;margin-top:4px;color:var(--theme-muted,#75817a);line-height:1.4">${isSameDci?'Consultați lista oficială a medicamentelor generice interschimbabile aprobată de ANMDMR.':'Poți rula verificarea DDInter pentru această pereche.'}</small></div></div><div class="result" style="margin-top:14px">${isSameDci&&isSameStrength&&isSameForm?'DCI, concentrație și formă coincid.':'Prezentările diferă. Nu sunt marcate drept echivalente.'}</div><div class="modalfoot">${interactBtn}</div>`);
  if($('#compare-interact'))$('#compare-interact').onclick=()=>{$('#modal').close();runInteractions(a.dci||a.name,b.dci||b.name);navigate('tools')};
}

function truncateText(s,max=180){
  const t=String(s||'');
  return t.length>max?t.slice(0,max)+'…':t;
}

async function runInteractions(sub1,sub2){
  navigate('tools');
  await new Promise(r=>setTimeout(r,50));
  const i1=$('#drug1-input'),i2=$('#drug2-input'),res=$('#interactions-result');
  if(i1)i1.value=sub1||'';
  if(i2)i2.value=sub2||'';
  if(!res)return;
  res.textContent='Se verifică interacțiunile…';
  const data=await apiPost('/api/drugs/check-interactions',{substances:[sub1,sub2].filter(Boolean)});
  renderInteractionsResult(data,res,sub1,sub2);
}

function renderInteractionsResult(data,res,sub1,sub2){
  if(!res)return;
  if(!data){res.innerHTML='<strong style="color:#d9534f">Eroare:</strong> Nu am putut contacta serviciul de interacțiuni.';return}
  if(sub1&&sub2&&normal(sub1)===normal(sub2)){
    res.innerHTML=`<strong style="color:#d9534f">Atenție:</strong> Aceeași substanță (<strong>${esc(sub1)}</strong>). Risc de supradozaj prin dublare.`;
    return;
  }
  const major=(data.interactions||[]).filter(x=>x.level==='Major'||x.level==='Moderate');
  if(!major.length){
    res.innerHTML=`<strong style="color:#2b5f3a">Fără interacțiuni majore/moderate semnalate:</strong> Asocierea dintre <strong>${esc(sub1)}</strong> și <strong>${esc(sub2)}</strong> nu are alerte DDInter de severitate majoră/moderată.${data.unresolved?.length?` <span class="sub">Nerezolvate: ${esc(data.unresolved.join(', '))}</span>`:''}`;
    return;
  }
  res.innerHTML=major.map(it=>`<div style="margin-bottom:10px"><strong style="color:${it.level==='Major'?'#d9534f':'#e67e22'}">${esc(it.levelLabel||it.level)}:</strong> <strong>${esc(it.a)}</strong> + <strong>${esc(it.b)}</strong>${it.description?`<br><span class="sub">${esc(truncateText(it.description))}</span>`:''}</div>`).join('')+(data.source?`<p class="sub" style="margin-top:8px">Sursă: ${esc(data.source)}</p>`:'');
}

async function fillDrugDatalist(input,datalist){
  const q=input.value.trim();
  if(q.length<2){datalist.innerHTML='';return}
  const data=await apiGet(`/api/drugs/search?q=${encodeURIComponent(q)}&limit=10`);
  datalist.innerHTML=(data?.results||[]).map(h=>`<option value="${esc(h.dci||h.display)}">${esc(h.display)} · ${esc(h.dci||'')}</option>`).join('');
}

function bindRows(){
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(b.dataset.detail));
  document.querySelectorAll('[data-follow]').forEach(b=>b.onclick=()=>follow(b.dataset.follow));
  document.querySelectorAll('[data-select]').forEach(b=>b.onchange=()=>{
    const id=b.dataset.select;
    if(b.checked&&selected.length===2){b.checked=false;toast('Poți compara două prezentări simultan.');return}
    selected=b.checked?[...selected,id]:selected.filter(x=>x!==id);
    updateCatalog();
  });
}

function filterAlerts(){
  const panel=$('#alerts')?.closest('.panel');
  if(!panel)return;
  if(page==='overview'){
    panel.innerHTML=journalBlock({preview:true,limit:3});
  }else{
    panel.innerHTML=journalBlock({showFollowedToggle:true,onlyFollowed:page==='radar'});
  }
  bindJournalControls();
  bindRows();
}

function bindJournalControls(){
  const input=$('#alert-query');
  if(input){
    input.value=alertQuery;
    input.oninput=debounce((e)=>{
      alertQuery=e.target.value;
      alertPage=0;
      filterAlerts();
      const again=$('#alert-query');
      if(again){again.focus();const len=again.value.length;again.setSelectionRange(len,len)}
    },180);
  }
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=async()=>{
    filter=b.dataset.filter;
    alertPage=0;
    document.querySelectorAll('[data-filter]').forEach(c=>{
      c.classList.toggle('active',c.dataset.filter===filter);
      c.setAttribute('aria-pressed',c.dataset.filter===filter);
    });
    const el=$('#alerts');
    if(el)el.innerHTML='<div class="empty">Se încarcă alertele…</div>';
    await loadAlerts(filter==='all'?null:filter);
    filterAlerts();
  });
  document.querySelectorAll('[data-alert-page]').forEach(b=>{
    b.onclick=()=>{
      if(b.disabled)return;
      if(b.dataset.alertPage==='prev')alertPage=Math.max(0,alertPage-1);
      if(b.dataset.alertPage==='next')alertPage+=1;
      filterAlerts();
    };
  });
  if($('#only-followed'))$('#only-followed').onchange=()=>{alertPage=0;filterAlerts()};
}

async function ensureRomaniaMap(){
  if(romaniaMapSvg)return romaniaMapSvg;
  try{
    const res=await fetch('romania-counties.svg');
    if(!res.ok)throw new Error('map missing');
    romaniaMapSvg=await res.text();
  }catch{
    romaniaMapSvg='';
  }
  return romaniaMapSvg;
}

function colorStockMap(){
  const host=$('#stock-map');
  if(!host)return;
  const tip=$('#stock-tip');
  const byKey=new Map((stockProduct?.counties||[]).map(c=>[c.key,c]));
  const max=stockProduct?.maxCountyStock||0;
  host.querySelectorAll('.ro-county').forEach(path=>{
    const key=path.getAttribute('data-key')||'';
    const county=byKey.get(key);
    const stock=county?.stock||0;
    const lv=stockProduct?stockLevel(stock,max):0;
    path.setAttribute('data-level',String(lv));
    path.classList.remove('lv0','lv1','lv2','lv3','is-hot');
    path.classList.add(`lv${lv}`);
    const label=county?`${county.name}: ${formatStock(stock)} unități`:(path.getAttribute('data-name')||key);
    const title=path.querySelector('title');
    if(title)title.textContent=label;
    path.onmouseenter=()=>{
      if(!tip)return;
      tip.hidden=false;
      tip.textContent=label;
      path.classList.add('is-hot');
    };
    path.onmouseleave=()=>{
      path.classList.remove('is-hot');
      if(tip)tip.hidden=true;
    };
    path.onclick=()=>{
      const el=document.querySelector(`.stock-county[data-county-key="${CSS.escape(key)}"]`);
      if(el){el.scrollIntoView({behavior:'smooth',block:'nearest'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),900)}
    };
  });
}

async function mountStockMap(){
  const host=$('#stock-map');
  if(!host)return;
  const svg=await ensureRomaniaMap();
  if(!svg){host.innerHTML='<p class="empty">Harta nu a putut fi încărcată.</p>';return}
  host.innerHTML=svg;
  const svgEl=host.querySelector('svg');
  if(svgEl){
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.setAttribute('width','100%');
    svgEl.style.maxWidth='100%';
    svgEl.style.height='auto';
    svgEl.style.display='block';
  }
  colorStockMap();
}

async function loadStockStats(){
  const data=await apiGet('/api/stocks/stats');
  stockStats=data||{loaded:false,products:0,counties:0,examples:[],source:{}};
}

async function openStockProduct(id){
  const product=await apiGet(`/api/stocks/${id}`);
  if(!product){toast('Produsul nu a fost găsit în SER.');return}
  stockProduct=product;
  stockQuery=product.name||stockQuery;
  stockSuggest=[];
  if(page==='stocks')render();
  else navigate('stocks');
}

async function searchStocks(q){
  stockQuery=q;
  if(q.trim().length<2){
    stockSuggest=[];
    const list=$('#stock-suggest');
    if(list)list.remove();
    return;
  }
  const data=await apiGet(`/api/stocks/search?q=${encodeURIComponent(q)}&limit=12`);
  stockSuggest=data?.results||[];
  const wrap=$('.stock-search-wrap');
  if(!wrap)return;
  let list=$('#stock-suggest');
  if(!list){
    list=document.createElement('ul');
    list.className='stock-suggest';
    list.id='stock-suggest';
    wrap.appendChild(list);
  }
  if(!stockSuggest.length){list.remove();return}
  list.innerHTML=stockSuggest.map(item=>`<li><button type="button" data-stock-id="${esc(String(item.id))}"><strong>${esc(item.name)}</strong><span>${esc(item.dci)} · ${esc(item.form)} · ${esc(item.strength)} · ${formatStock(item.stockCountry)} u.</span></button></li>`).join('');
  list.querySelectorAll('[data-stock-id]').forEach(b=>b.onclick=()=>openStockProduct(b.dataset.stockId));
}

const debouncedStockSearch=debounce((q)=>searchStocks(q),220);

function bindStocksControls(){
  if(page!=='stocks')return;
  mountStockMap();
  const input=$('#stock-query');
  if(input){
    input.value=stockQuery;
    input.oninput=e=>debouncedStockSearch(e.target.value);
  }
  document.querySelectorAll('[data-stock-id]').forEach(b=>b.onclick=()=>openStockProduct(b.dataset.stockId));
}

function bind(){
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{query='';alertQuery='';alertPage=0;navigate(b.dataset.go)});
  document.querySelectorAll('[data-settings]').forEach(b=>b.onclick=settings);
  bindRows();
  bindJournalControls();
  bindStocksControls();
  if($('#hero-search'))$('#hero-search').onsubmit=e=>{e.preventDefault();query=new FormData(e.target).get('q').trim();navigate('catalog')};
  document.querySelectorAll('[data-search]').forEach(b=>b.onclick=()=>{query=b.dataset.search;navigate('catalog')});
  if($('#catalog-query')){
    $('#catalog-query').value=query;
    $('#catalog-query').oninput=e=>{query=e.target.value;debouncedCatalogSearch()};
    updateCatalog();
  }
  if($('#bmi-form'))$('#bmi-form').onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.target),w=Number(f.get('weight')),h=Number(f.get('height'));
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
    const r=w/((h/100)**2);
    $('#bmi-result').innerHTML=`<strong>${r.toLocaleString('ro-RO',{maximumFractionDigits:1})}</strong> kg/m²<br><span class="sub">${w} kg / (${h/100} m)² · rezultat matematic, fără interpretare clinică.</span>`;
  };
  if($('#interactions-form')){
    const i1=$('#drug1-input'),i2=$('#drug2-input'),l1=$('#drug1-list'),l2=$('#drug2-list');
    if(i1&&l1)i1.oninput=debounce(()=>fillDrugDatalist(i1,l1),250);
    if(i2&&l2)i2.oninput=debounce(()=>fillDrugDatalist(i2,l2),250);
    $('#interactions-form').onsubmit=async e=>{
      e.preventDefault();
      const f=new FormData(e.target),s1=f.get('drug1')?.trim(),s2=f.get('drug2')?.trim(),res=$('#interactions-result');
      if(!s1||!s2){res.textContent='Completează ambele medicamente.';return}
      res.textContent='Se verifică interacțiunile…';
      const data=await apiPost('/api/drugs/check-interactions',{substances:[s1,s2]});
      renderInteractionsResult(data,res,s1,s2);
    };
  }
  document.querySelectorAll('[data-subst]').forEach(b=>{b.onclick=()=>{query=b.dataset.subst;navigate('catalog')}});
  document.querySelectorAll('[data-presc]').forEach(b=>{b.onclick=()=>openPrescGuide(b.dataset.presc)});
}

async function openPrescGuide(mode){
  const candidate=followed.find(d=>d.hasRcp&&d.dciKey&&d.productId)||followed[0];
  if(candidate?.hasRcp&&candidate?.dciKey&&candidate?.productId){
    location.href=`/fisa/${encodeURIComponent(candidate.dciKey)}/${encodeURIComponent(candidate.productId)}`;
    return;
  }
  openModal(mode==='adulti'?'Ghid de prescriere: Antibioterapie primă linie':'Ajustare doze: Pacienți vârstnici / eGFR','GHID CLINIC ORIENTATIV',`<p>${mode==='adulti'?'Recomandări generale pentru prescrierea rațională a antibioticelor și evaluarea antecedentelor alergice.':'Ajustarea posologiei pentru medicamente cu eliminare preponderent renală în funcție de clearance-ul creatininei.'}</p><div class="clinical-compare-box"><img src="spot-icons/prescription.png" alt="" aria-hidden="true"><div><div class="clinical-card-kicker">PROTOCOL TERAPEUTIC</div><div class="clinical-card-title">Consultă RCP din fișa medicamentului</div><small style="display:block;margin-top:4px;color:var(--theme-muted,#75817a)">Adaugă un produs cu RCP în lista ta, apoi deschide ghidul de prescriere din fișa prezentării.</small></div></div><div class="modalfoot"><a class="btn primary" href="/app#catalog">Deschide catalogul</a></div>`);
}

async function seedFollowed(){
  const queries=['sertralina','concerta','amoxicilina'];
  const seeded=[];
  for(const q of queries){
    const data=await apiGet(`/api/drugs/search?q=${encodeURIComponent(q)}&limit=8`);
    const hit=(data?.results||[]).find(h=>h.hasRcp)||(data?.results||[])[0];
    if(hit){
      const drug=normalizeSearchHit(hit);
      if(!seeded.some(d=>d.id===drug.id))seeded.push(remember(drug));
    }
  }
  if(seeded.length){
    followed=seeded;
    save('medora-followed-v2',followed);
  }
}

async function loadAlerts(typeFilter){
  let url='/api/discontinuities?limit=100&sort=noticeDate&order=desc';
  if(typeFilter==='temporary')url+='&type=temporara';
  else if(typeFilter==='permanent')url+='&type=permanenta';
  else if(typeFilter==='resumed'){alerts=[];return}
  const discList=await apiGet(url);
  alerts=(discList?.results||[]).map(i=>remember(normalizeDiscItem(i)));
}

async function loadLiveData(){
  const [health,discStats]=await Promise.all([
    apiGet('/health'),
    apiGet('/api/discontinuities/stats')
  ]);
  stats.health=health;
  stats.disc=discStats||{total:0,temporara:0,permanenta:0,prelungire:0,necunoscut:0};
  stats.provenanceTime=health?.stocks?.source?.fetchedAt||discStats?.source?.importedAt||new Date().toISOString();
  await Promise.all([loadAlerts(filter==='all'?null:filter),loadStockStats()]);
}

function setTopbarDate(){
  const el=document.querySelector('.topright .date');
  if(!el)return;
  const now=new Date();
  el.textContent=now.toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

async function init(){
  icons();
  setTopbarDate();
  await loadLiveData();
  if(!followed.length)await seedFollowed();
  initDone=true;
  try{
    const pending=sessionStorage.getItem('medora-catalog-q');
    if(pending){query=pending;sessionStorage.removeItem('medora-catalog-q');if(!location.hash)location.hash='catalog'}
  }catch{}
  page=['overview','catalog','stocks','radar','watch','tools','sources'].includes(location.hash.slice(1))?location.hash.slice(1):'overview';
  render();
  const initialDrug=new URLSearchParams(location.search).get('drug');
  if(initialDrug){
    const hit=get(initialDrug);
    if(hit)detail(initialDrug);
  }
}

document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{query='';navigate(b.dataset.page)});
$('#notifications').onclick=settings;
$('#close-modal').onclick=()=>$('#modal').close();
$('#modal').onclick=e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close()}};
$('#research-nav').onclick=()=>window.open('/research','_blank');
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(p!==page&&initDone)navigate(p)});

function initUserProfile(){
  try{
    const raw=localStorage.getItem('medora_user');
    const user=raw?JSON.parse(raw):null;
    const nameEl=document.getElementById('user-profile-name');
    const roleEl=document.getElementById('user-profile-role');
    const avatarEl=document.getElementById('user-avatar-widget');
    const fallbackEl=document.getElementById('user-avatar-fallback');
    const defaultGradient='radial-gradient(circle at 32% 28%, #bbf7d0 0%, #38bdf8 36%, #818cf8 68%, #4f46e5 100%)';
    const initials=user?.fallback||(window.getDoctorInitials?window.getDoctorInitials(user?.name):'AP');
    const gradient=user?.gradient||(window.getDoctorGradient?window.getDoctorGradient(user?.name):defaultGradient);
    if(nameEl)nameEl.textContent=user?.name||'Dr. Andrei Popescu';
    if(roleEl)roleEl.textContent=user?.role||'Medicină de familie · Activ';
    if(window.renderMedoraAvatar&&avatarEl){
      window.renderMedoraAvatar(avatarEl,user?.email||user?.name);
    }else{
      if(fallbackEl)fallbackEl.textContent=initials;
      if(avatarEl)avatarEl.style.background=gradient;
    }
    const widget=document.getElementById('user-profile-widget');
    if(widget){
      widget.onclick=()=>{
        const currName=user?.name||'Dr. Andrei Popescu';
        const currRole=user?.role||'Medicină de familie · Activ';
        const currEmail=user?.email||'andrei.popescu@spital.ro';
        openModal(currName,'PROFIL ACTIV MEDORA',`
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:16px;background:var(--theme-wash-1);border-radius:18px;">
            <div class="heroui-avatar heroui-avatar-preview" style="background: ${gradient};">
              <span class="heroui-avatar-fallback">${esc(initials)}</span>
            </div>
            <div>
              <strong style="font-size:16px;color:var(--theme-deep);">${esc(currName)}</strong>
              <div style="font-size:12px;color:var(--theme-muted);">${esc(currRole)}</div>
              <div style="font-size:11px;color:var(--theme-muted);margin-top:2px;">${esc(currEmail)}</div>
            </div>
          </div>
          <p>Contul tău are acces la nomenclatorul ANMDMR, alertele de farmacovigilență și datele live Medora.</p>
          <div class="modalfoot" style="margin-top:24px;">
            <a class="btn primary" href="auth.html" style="text-decoration:none;">Schimbă contul</a>
            <button class="btn" id="logout-btn">Deconectare</button>
          </div>
        `);
        const logoutBtn=document.getElementById('logout-btn');
        if(logoutBtn){
          logoutBtn.onclick=()=>{
            localStorage.removeItem('medora_user');
            location.reload();
          };
        }
      };
    }
  }catch(e){}
}

initUserProfile();
init();
