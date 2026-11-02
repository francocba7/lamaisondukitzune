/* =====================================================================
   LA MAISON DU KITZUNE — ACCESO (panel privado de contenido)

   Cada cambio se guarda como un commit en el repositorio de GitHub de la web
   (archivos en media/ + contenido.js) y GitHub Pages la republica en 1–2 minutos.
   No hay servidor propio ni base de datos: la web sigue siendo estática.

   ENTRADA  · Con la contraseña del cliente: se descifra acceso/clave.json, que guarda
              cifrada (AES-GCM + PBKDF2) una clave de GitHub limitada a este repositorio.
            · Con la clave de GitHub directamente (github_pat_…): para el desarrollador;
              desde ahí se crea o cambia la contraseña del cliente.
   ===================================================================== */
(() => {
'use strict';
const CFG = Object.assign({owner:'francocba7', repo:'lamaisondukitzune', branch:'main'}, (typeof window !== 'undefined' && window.ACCESO_CFG) || {});
const API = 'https://api.github.com';
const LIMITS = {gallery:12, merch:12, tracks:5, projects:6};   // máximos del alcance v1 (los mismos que aplica la web)
const STORE = 'kitzune-acceso';

const utf8 = s => new TextEncoder().encode(s);
const b64ToBytes = b64 => Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0));
const bytesToB64 = bytes => {let s = '';for(let i = 0;i < bytes.length;i += 0x8000)s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));return btoa(s)};

// ---- Repositorio (API de GitHub) ----
function Repo(token, cfg = CFG){
  const base = `${API}/repos/${cfg.owner}/${cfg.repo}`;
  const call = async (path, opts = {}) => {
    const res = await fetch(base + path, {...opts, cache:'no-store', headers:{Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28', ...(opts.body ? {'Content-Type':'application/json'} : {})}});
    if (!res.ok){const e = new Error(`GitHub ${res.status}`);e.status = res.status;try{e.detail = (await res.json()).message}catch(_){}throw e}
    return res.status === 204 ? null : res.json();
  };
  const head = async () => (await call(`/git/ref/heads/${cfg.branch}`)).object.sha;
  return {
    check: () => call(''),
    head,
    async read(path, ref){const r = await call(`/contents/${path}?ref=${ref || cfg.branch}`);return new TextDecoder().decode(b64ToBytes(r.content))},
    // files: [{path, text} | {path, bytes} | {path, remove:true}] → un solo commit.
    async commit(message, files, parent, onStep = () => {}){
      parent = parent || await head();
      const total = files.length + 3;let done = 0;const step = () => onStep(++done, total);
      const baseTree = (await call(`/git/commits/${parent}`)).tree.sha;
      const tree = [];
      for (const f of files){
        if (f.remove) tree.push({path:f.path, mode:'100644', type:'blob', sha:null});
        else {
          const blob = await call('/git/blobs', {method:'POST', body:JSON.stringify({content:bytesToB64(f.bytes || utf8(f.text)), encoding:'base64'})});
          tree.push({path:f.path, mode:'100644', type:'blob', sha:blob.sha});
        }
        step();
      }
      const t = await call('/git/trees', {method:'POST', body:JSON.stringify({base_tree:baseTree, tree})});step();
      const c = await call('/git/commits', {method:'POST', body:JSON.stringify({message, tree:t.sha, parents:[parent]})});step();
      await call(`/git/refs/heads/${cfg.branch}`, {method:'PATCH', body:JSON.stringify({sha:c.sha})});step();
      return c.sha;
    }
  };
}

// ---- contenido.js ↔ objeto ----
// El archivo es JS (window.SITE = {...}); se evalúa aislado y se reescribe como JSON válido,
// conservando el comentario de cabecera con las instrucciones.
const parseSite = text => {const w = {};new Function('window', text)(w);if(!w.SITE || typeof w.SITE !== 'object')throw new Error('contenido.js no define window.SITE');return w.SITE};
const serialize = (original, site) => {
  const i = original.indexOf('window.SITE');
  let header = i > 0 ? original.slice(0, i) : '';
  if (header && !header.includes('/acceso')) header = header.replace('   =====', '   PANEL    También se edita desde https://www.lamaisondukitzune.com/acceso/ (sube fotos,\n            música, enlaces y textos sin tocar este archivo).\n   =====');
  return header + 'window.SITE = ' + JSON.stringify(site, null, 2) + ';\n';
};

// ---- Contraseña del cliente (clave de GitHub cifrada) ----
// clave.json es público: la protección es una contraseña larga (mín. 16, idealmente la generada) + PBKDF2 lento.
const ITERATIONS = 600000;
const deriveKey = async (pass, salt, iterations = ITERATIONS) => crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations, hash:'SHA-256'},
  await crypto.subtle.importKey('raw', utf8(pass), 'PBKDF2', false, ['deriveKey']), {name:'AES-GCM', length:256}, false, ['encrypt', 'decrypt']);
async function lock(token, pass){
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, await deriveKey(pass, salt), utf8(token)));
  return {v:1, it:ITERATIONS, salt:bytesToB64(salt), iv:bytesToB64(iv), data:bytesToB64(data)};
}
async function unlock(box, pass){
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:b64ToBytes(box.iv)}, await deriveKey(pass, b64ToBytes(box.salt), box.it || ITERATIONS), b64ToBytes(box.data));
  return new TextDecoder().decode(plain);
}

if (typeof module === 'object' && module.exports) module.exports = {Repo, parseSite, serialize, lock, unlock, LIMITS};
if (typeof document === 'undefined') return;

// =====================================================================
// Interfaz
// =====================================================================
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const str = v => typeof v === 'string' ? v.trim() : '';
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'archivo';
const isToken = v => /^(github_pat_|ghp_|gho_)[A-Za-z0-9_]{20,}$/.test(v);
const userError = msg => Object.assign(new Error(msg), {user:true});

const state = {repo:null, token:'', site:null, mode:'files', dest:'gallery', queue:[], preview:{}, busy:false};
const DEST = {
  gallery:{accept:'image/jpeg,image/png,image/webp', types:'Tipos admitidos: fotos JPG, PNG o WEBP.', hint:'Las fotos se optimizan solas antes de subir. Escribe un pie de foto si quieres.', folder:'media/galeria'},
  merch:{accept:'image/jpeg,image/png,image/webp', types:'Tipos admitidos: fotos JPG, PNG o WEBP.', hint:'Fotos de los productos. Se ven al tocar la silla.', folder:'media/merch'},
  tracks:{accept:'audio/mpeg,.mp3', types:'Tipos admitidos: audio MP3 (hasta 20 MB).', hint:'Cada MP3 es un tema del reproductor del altavoz. Para Spotify o Apple Music usa «Sitios web».', folder:'media/musica'},
  projects:{accept:'image/jpeg,image/png,image/webp', types:'Tipos admitidos: una foto JPG, PNG o WEBP (opcional).', hint:'Un proyecto por vez: una foto de portada y sus datos.', folder:'media/proyectos'}
};

// Guardado local de la sesión (puede fallar en modo privado: entonces solo dura la pestaña).
const saveToken = (t, remember) => {try{(remember ? localStorage : sessionStorage).setItem(STORE, t)}catch(_){}};
const loadToken = () => {try{return localStorage.getItem(STORE) || sessionStorage.getItem(STORE) || ''}catch(_){return ''}};
const clearToken = () => {try{localStorage.removeItem(STORE);sessionStorage.removeItem(STORE)}catch(_){}};

let toastTimer;
function toast(msg, bad = false){const t = $('#toast');t.textContent = msg;t.classList.toggle('bad', bad);t.classList.add('show');clearTimeout(toastTimer);toastTimer = setTimeout(() => t.classList.remove('show'), bad ? 6000 : 4200)}
function friendly(e){
  if (e.user) return e.message;
  if (e.status === 401) return 'La clave no es válida o ha caducado. Pide una nueva.';
  if (e.status === 403 || e.status === 404) return 'Esta clave no tiene permiso para guardar en la web.';
  if (e.status === 409 || e.status === 422) return 'La web cambió mientras guardabas. Vuelve a intentarlo.';
  if (e.name === 'TypeError') return 'No hay conexión. Revisa internet y vuelve a intentarlo.';
  console.error(e);return 'No se pudo guardar. Vuelve a intentarlo en un momento.';
}
let progressTimer;
function progress(pct, text){
  clearTimeout(progressTimer);
  $('#progress').hidden = false;$('#bar').style.width = Math.max(4, pct) + '%';$('#progressText').textContent = text;
}
const progressDone = () => {progressTimer = setTimeout(() => {$('#progress').hidden = true;$('#bar').style.width = '0'}, 6000)};
function setBusy(b){state.busy = b;$$('#app button, #app input, #app select, #app textarea').forEach(el => {if(b){el.dataset.wasDisabled = el.disabled;el.disabled = true}else{el.disabled = el.dataset.wasDisabled === 'true'}});if(!b)updatePublish()}

// Lee contenido.js actualizado, aplica el cambio y lo publica todo en un commit.
async function apply(message, mutate, files = [], label = 'Guardando…'){
  if (state.busy) return false;
  setBusy(true);progress(6, label);
  try {
    const parent = await state.repo.head();
    const text = await state.repo.read('contenido.js', parent);
    const site = parseSite(text);
    const dropped = (mutate(site) || []).filter(p => typeof p === 'string' && p.startsWith('media/') && !JSON.stringify(site).includes(`"${p}"`));
    const all = [...files, {path:'contenido.js', text:serialize(text, site)}, ...dropped.map(path => ({path, remove:true}))];
    try {await state.repo.commit(message, all, parent, (d, t) => progress(10 + 85 * d / t, label))}
    catch(e){if(e.status !== 422 || !dropped.length)throw e;await state.repo.commit(message, all.filter(f => !f.remove), parent)} // archivo ya borrado: guardar igual
    state.site = site;render();
    progress(100, 'Publicado. La web se actualiza en 1–2 minutos (si no lo ves, recarga la página).');
    toast('Publicado. La web se actualiza en 1–2 minutos.');
    return true;
  } catch(e){progress(0, friendly(e));toast(friendly(e), true);return false}
  finally {setBusy(false);progressDone()}
}

// ---- Entrada ----
async function enter(token, {fromKey = false, remember = true} = {}){
  const repo = Repo(token);
  await repo.check();
  const site = parseSite(await repo.read('contenido.js'));
  Object.assign(state, {repo, token, site});
  saveToken(token, remember);
  $('#login').hidden = true;$('#app').hidden = false;$('#logout').hidden = false;$('#setup').hidden = !fromKey;
  render();fillTexts();setDest(state.dest);
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const v = $('#key').value.trim(), msg = $('#loginMsg'), btn = e.submitter || $('#loginForm .solid');
  msg.className = 'msg';msg.textContent = '';
  if (!v){msg.textContent = 'Escribe tu clave.';return}
  btn.disabled = true;btn.textContent = 'Entrando…';
  try {
    let token = v, fromKey = isToken(v);
    if (!fromKey){
      const res = await fetch('clave.json?t=' + Date.now(), {cache:'no-store'});
      if (!res.ok) throw userError('Todavía no hay contraseña creada para este panel.');
      try {token = await unlock(await res.json(), v)} catch(_){throw userError('Contraseña incorrecta.')}
    }
    await enter(token, {fromKey, remember:$('#remember').checked});
    $('#key').value = '';
  } catch(err){msg.textContent = err.user ? err.message : (err.status ? friendly(err) : 'No se pudo entrar. Revisa la conexión.')}
  finally {btn.disabled = false;btn.textContent = 'Entrar'}
});
$('#logout').addEventListener('click', () => {clearToken();location.reload()});

// Contraseña aleatoria legible (5 grupos de 4, ~100 bits), fácil de copiar por WhatsApp.
$('#genPass').addEventListener('click', () => {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(20));
  const pass = [...r].map(x => abc[x % abc.length]).join('').match(/.{4}/g).join('-');
  $('#newPass').value = $('#newPass2').value = pass;$('#newPass').type = 'text';
  $('#setupMsg').className = 'msg ok';$('#setupMsg').textContent = 'Cópiala ahora y guárdala: ' + pass;
});
$('#setupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const p1 = $('#newPass').value, p2 = $('#newPass2').value, msg = $('#setupMsg');
  msg.className = 'msg';
  if (p1.length < 16){msg.textContent = 'Usa al menos 16 caracteres (o pulsa «Generar una segura»).';return}
  if (p1 !== p2){msg.textContent = 'Las dos contraseñas no coinciden.';return}
  if (state.busy) return;
  setBusy(true);progress(10, 'Guardando la contraseña…');
  try {
    const box = await lock(state.token, p1);
    await state.repo.commit('Acceso: contraseña del cliente', [{path:'acceso/clave.json', text:JSON.stringify(box) + '\n'}], null, (d, t) => progress(10 + 85 * d / t, 'Guardando la contraseña…'));
    $('#newPass').value = $('#newPass2').value = '';
    msg.className = 'msg ok';msg.textContent = 'Listo. En 1–2 minutos funciona: pásale a Maico el enlace de esta página y la contraseña.';
    progress(100, 'Contraseña guardada.');
  } catch(err){msg.textContent = friendly(err);progress(0, friendly(err))}
  finally {setBusy(false);progressDone()}
});

// ---- Pestañas (Subir archivos / Sitios web / Texto copiado) ----
function setMode(mode, focus = false){
  state.mode = mode;
  $$('.chip').forEach(c => {const on = c.dataset.mode === mode;c.setAttribute('aria-selected', on);c.tabIndex = on ? 0 : -1;if(on && focus)c.focus()});
  ['files', 'links', 'text'].forEach(m => $(`#mode-${m}`).hidden = m !== mode);
  if (mode === 'text') fillTexts();
}
$$('.chip').forEach((c, i, all) => {
  c.addEventListener('click', () => setMode(c.dataset.mode));
  c.addEventListener('keydown', e => {const d = {ArrowRight:1, ArrowLeft:-1}[e.key];if(d){e.preventDefault();setMode(all[(i + d + all.length) % all.length].dataset.mode, true)}});
});

// ---- Subir archivos ----
function setDest(dest){
  state.dest = dest;
  $$('.dest button').forEach(b => b.setAttribute('aria-checked', b.dataset.dest === dest));
  const d = DEST[dest];
  $('#fileInput').accept = d.accept;$('#fileInput').multiple = dest !== 'projects';
  $('#dropTypes').textContent = d.types;
  const used = count(dest), max = LIMITS[dest];
  $('#destHint').textContent = `${d.hint} Hay ${used} de ${max}.`;
  $('#projectFields').hidden = dest !== 'projects';
  state.queue.forEach(q => URL.revokeObjectURL(q.url));state.queue = [];renderQueue();
}
$$('.dest button').forEach(b => b.addEventListener('click', () => setDest(b.dataset.dest)));

function addFiles(list){
  const dest = state.dest, audio = dest === 'tracks';
  for (const file of list){
    const ok = audio ? /^audio\/(mpeg|mp3)$/.test(file.type) || /\.mp3$/i.test(file.name) : /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!ok){toast(`«${file.name}» no es ${audio ? 'un MP3' : 'una foto JPG, PNG o WEBP'}.`, true);continue}
    if (audio && file.size > 20 * 1024 * 1024){toast(`«${file.name}» pesa más de 20 MB.`, true);continue}
    if (dest === 'projects'){state.queue.forEach(q => URL.revokeObjectURL(q.url));state.queue = []}
    if (count(dest) + state.queue.length >= LIMITS[dest] && dest !== 'projects'){toast(`Máximo ${LIMITS[dest]} en esta sección (lo acordado). Quita algo antes de añadir más.`, true);break}
    state.queue.push({file, audio, url:audio ? '' : URL.createObjectURL(file), caption:'', title:audio ? file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() : '', subtitle:''});
  }
  renderQueue();
}
function renderQueue(){
  $('#queue').innerHTML = state.queue.map((q, i) => `<li>
    ${q.audio ? '<span class="thumb" aria-hidden="true">♫</span>' : `<img class="thumb" src="${q.url}" alt="">`}
    <div class="q-fields">${q.audio
      ? `<input data-i="${i}" data-k="title" value="${esc(q.title)}" placeholder="Título del tema *" aria-label="Título del tema" maxlength="80"><input data-i="${i}" data-k="subtitle" value="${esc(q.subtitle)}" placeholder="Single · 2026 (opcional)" aria-label="Subtítulo" maxlength="60">`
      : state.dest === 'projects' ? '' : `<input data-i="${i}" data-k="caption" value="${esc(q.caption)}" placeholder="Pie de foto (opcional)" aria-label="Pie de foto de ${esc(q.file.name)}" maxlength="80">`}
      <span class="q-name">${esc(q.file.name)} · ${(q.file.size / 1048576).toFixed(1)} MB</span></div>
    <button class="x" type="button" data-rm="${i}" aria-label="Quitar ${esc(q.file.name)}">×</button></li>`).join('');
  updatePublish();
}
$('#queue').addEventListener('input', e => {const i = e.target.dataset.i;if(i != null){state.queue[i][e.target.dataset.k] = e.target.value;updatePublish()}});
$('#queue').addEventListener('click', e => {const i = e.target.closest('[data-rm]')?.dataset.rm;if(i != null){URL.revokeObjectURL(state.queue[i].url);state.queue.splice(i, 1);renderQueue()}});
$('#pTitle').addEventListener('input', updatePublish);
function updatePublish(){
  const b = $('#publishFiles');if(state.busy)return;
  b.disabled = state.dest === 'projects' ? !str($('#pTitle').value) : !state.queue.length || state.queue.some(q => q.audio && !str(q.title));
  b.textContent = state.dest === 'projects' ? 'Publicar proyecto' : state.queue.length > 1 ? `Publicar ${state.queue.length} archivos` : 'Publicar';
}

const drop = $('#drop');
$('#fileInput').addEventListener('change', e => {addFiles(e.target.files);e.target.value = ''});
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => {e.preventDefault();drop.classList.add('over')}));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
drop.addEventListener('drop', e => {e.preventDefault();addFiles(e.dataTransfer.files)});
window.addEventListener('dragover', e => e.preventDefault());window.addEventListener('drop', e => e.preventDefault());

// Fotos: máx. 1600 px y JPEG 85 % (una foto de móvil de 4 MB queda en ~250 KB).
async function prepImage(file){
  const url = URL.createObjectURL(file), img = new Image();img.src = url;
  try {await img.decode()} catch(_){throw userError(`No se pudo leer «${file.name}».`)}
  const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);URL.revokeObjectURL(url);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  return new Uint8Array(await blob.arrayBuffer());
}
const newPath = (folder, name, i, ext) => `${folder}/${Date.now().toString(36)}${i}-${slug(name)}.${ext}`;

$('#publishFiles').addEventListener('click', async () => {
  const dest = state.dest, d = DEST[dest], queue = state.queue.slice();
  setBusy(true);progress(4, 'Preparando archivos…');
  let files = [];
  try {
    for (const [i, q] of queue.entries()){
      progress(4 + 20 * i / queue.length, `Preparando ${q.file.name}…`);
      const path = newPath(d.folder, q.file.name, i, q.audio ? 'mp3' : 'jpg');
      files.push({path, bytes:q.audio ? new Uint8Array(await q.file.arrayBuffer()) : await prepImage(q.file)});
      if (q.url) state.preview[path] = q.url;
    }
  } catch(e){setBusy(false);progress(0, friendly(e));toast(friendly(e), true);progressDone();return}
  setBusy(false);
  const full = (list, what) => {if(list.length + queue.length > LIMITS[dest])throw userError(`Máximo ${LIMITS[dest]} ${what}. Quita algo antes de añadir más.`)};
  let message, mutate;
  if (dest === 'gallery'){
    message = `Galería: ${queue.length} foto(s) nueva(s)`;
    mutate = s => {s.gallery = s.gallery || [];full(s.gallery, 'fotos en la galería');queue.forEach((q, i) => s.gallery.push({src:files[i].path, alt:str(q.caption) || 'Foto de La Maison Du Kitzune', caption:str(q.caption)}))};
  } else if (dest === 'merch'){
    message = `Merch: ${queue.length} foto(s) nueva(s)`;
    mutate = s => {s.merch = s.merch || {label:'Merch', url:'', note:'', items:[]};s.merch.items = s.merch.items || [];full(s.merch.items, 'fotos de merch');queue.forEach((q, i) => s.merch.items.push({src:files[i].path, alt:str(q.caption) || 'Producto de merch', caption:str(q.caption)}))};
  } else if (dest === 'tracks'){
    message = `Música: ${queue.map(q => str(q.title)).join(', ')}`;
    mutate = s => {s.music = s.music || {};s.music.tracks = s.music.tracks || [];full(s.music.tracks, 'temas');queue.forEach((q, i) => s.music.tracks.push({title:str(q.title), subtitle:str(q.subtitle), src:files[i].path}))};
  } else {
    let link = str($('#pLink').value);if(link && !/^https?:\/\//i.test(link))link = 'https://' + link;
    if (link && !/^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(link)){toast('El enlace del proyecto no es válido.', true);return}
    const p = {title:str($('#pTitle').value), category:str($('#pCategory').value), year:str($('#pYear').value), summary:str($('#pSummary').value), description:str($('#pDescription').value),
      image:files[0]?.path || '', alt:str($('#pTitle').value), link, linkLabel:str($('#pLinkLabel').value) || (link ? 'Ver proyecto' : '')};
    message = `Proyectos: ${p.title}`;
    mutate = s => {s.projects = s.projects || [];if(s.projects.length >= LIMITS.projects)throw userError(`Máximo ${LIMITS.projects} proyectos. Quita uno antes de añadir otro.`);s.projects.push(p)};
  }
  if (await apply(message, mutate, files, 'Subiendo…')){
    state.queue = [];renderQueue();
    if (dest === 'projects') $$('#projectFields input, #projectFields textarea').forEach(el => el.value = '');
    setDest(dest);
  }
});

// ---- Sitios web ----
const lDest = $('#lDest');
function syncLinkForm(){
  const v = lDest.value;
  $('#lLabel').closest('form').querySelector('label[for=lLabel]').hidden = $('#lLabel').hidden = v === 'shop';
  $('#lLabel').placeholder = v === 'profiles' ? 'Spotify, Apple Music, YouTube…' : v === 'floor' ? 'The Okay Ground' : 'Instagram, TikTok, YouTube…';
  $('#linkHint').textContent = {socials:'Aparece en «Sobre mí» y en «Contacto».', profiles:'Aparece junto al reproductor del altavoz.', shop:'Sustituye el enlace de la tienda que se abre desde la silla.', floor:'Sustituye el enlace que se abre al tocar el suelo.'}[v] + ' Pega la dirección completa, empezando por https://';
}
lDest.addEventListener('change', syncLinkForm);
$('#mode-links').addEventListener('submit', async e => {
  e.preventDefault();
  const dest = lDest.value;let url = str($('#lUrl').value), label = str($('#lLabel').value);
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (!/^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(url)){toast('Esa dirección no es válida. Pega el enlace completo.', true);$('#lUrl').focus();return}
  if (!label){try{label = new URL(url).hostname.replace(/^www\./, '')}catch(_){label = url}}
  const mutate = {
    socials:s => {(s.socials = s.socials || []).push({label, url})},
    profiles:s => {s.music = s.music || {};(s.music.profiles = s.music.profiles || []).push({label, url})},
    shop:s => {s.merch = s.merch || {label:'Merch', note:'', items:[]};s.merch.url = url},
    floor:s => {s.floor = {label:label || str(s.floor?.label) || 'The Okay Ground', url}}
  }[dest];
  if (await apply(`Enlace: ${label}`, mutate)){$('#lUrl').value = $('#lLabel').value = ''}
});

// ---- Texto copiado ----
function fillTexts(){
  const s = state.site;if(!s)return;
  $('#aTitle').value = str(s.about?.title);
  $('#aText').value = (s.about?.text || []).join('\n\n');
  $('#aQuote').value = str(s.about?.quote);
  $('#aTags').value = (s.about?.tags || []).join(', ');
  $('#cEmail').value = str(s.contact?.email);
  $('#cNote').value = str(s.contact?.note);
}
$('#mode-text').addEventListener('submit', async e => {
  e.preventDefault();
  const email = str($('#cEmail').value);
  if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)){toast('Ese correo no es válido.', true);$('#cEmail').focus();return}
  const about = {title:str($('#aTitle').value), text:$('#aText').value.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean),
    quote:str($('#aQuote').value), tags:$('#aTags').value.split(',').map(t => t.trim()).filter(Boolean)};
  await apply('Textos: sobre mí y contacto', s => {s.about = {...(s.about || {}), ...about};s.contact = {...(s.contact || {}), email, note:str($('#cNote').value)}});
});

// ---- Lo que hay en la web ----
function count(dest){
  const s = state.site || {};
  return {gallery:s.gallery?.length, merch:s.merch?.items?.length, tracks:s.music?.tracks?.length, projects:s.projects?.length}[dest] || 0;
}
const thumbSrc = p => state.preview[p] || (/^(https?:|data:)/.test(p) ? p : '../' + p);
function render(){
  const s = state.site || {}, m = s.music || {}, merch = s.merch || {};
  const tiles = (list, kind) => list.length ? `<div class="tiles">${list.map((g, i) => `<figure class="tile"><img src="${esc(thumbSrc(g.src))}" alt="${esc(g.alt || '')}" loading="lazy">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}<button class="x" type="button" data-del="${kind}" data-i="${i}" aria-label="Quitar ${esc(g.caption || 'foto ' + (i + 1))}">×</button></figure>`).join('')}</div>` : '<p class="empty">Todavía no hay nada aquí.</p>';
  const rows = (list, kind, main, sub) => list.length ? `<ul class="rows">${list.map((x, i) => `<li><span class="r-main">${esc(main(x))}<small>${esc(sub(x))}</small></span><button class="x" type="button" data-del="${kind}" data-i="${i}" aria-label="Quitar ${esc(main(x))}">×</button></li>`).join('')}</ul>` : '<p class="empty">Todavía no hay nada aquí.</p>';
  const group = (title, n, max, body) => `<section class="group"><h3>${title}<small>${max ? `${n} de ${max}` : n}</small></h3>${body}</section>`;
  const gallery = s.gallery || [], items = merch.items || [], tracks = m.tracks || [], projects = s.projects || [], socials = s.socials || [], profiles = m.profiles || [];
  const extra = [...(merch.url ? [{label:'Tienda de merch', url:merch.url, kind:'shop'}] : []), ...(s.floor?.url ? [{label:`Suelo · ${s.floor.label || 'enlace'}`, url:s.floor.url, kind:'floor'}] : [])];
  $('#current').innerHTML =
    group('Galería', gallery.length, LIMITS.gallery, tiles(gallery, 'gallery')) +
    group('Merch', items.length, LIMITS.merch, tiles(items, 'merch')) +
    group('Música', tracks.length, LIMITS.tracks, rows(tracks, 'tracks', t => t.title, t => t.subtitle || t.src || '')) +
    group('Proyectos', projects.length, LIMITS.projects, rows(projects, 'projects', p => p.title, p => [p.category, p.year].filter(Boolean).join(' · ') || p.summary || '')) +
    group('Enlaces', socials.length + profiles.length + extra.length, 0,
      rows([...socials.map(x => ({...x, kind:'socials'})), ...profiles.map(x => ({...x, kind:'profiles'})), ...extra], 'link', x => x.label, x => x.url).replace(/data-del="link" data-i="(\d+)"/g, (_, i) => {
        const all = [...socials.map((x, j) => ['socials', j]), ...profiles.map((x, j) => ['profiles', j]), ...extra.map(x => [x.kind, 0])];return `data-del="${all[i][0]}" data-i="${all[i][1]}"`;
      })) +
    group('Textos', '', 0, `<ul class="rows"><li><span class="r-main">Sobre mí<small>${s.about?.text?.length ? `${s.about.text.length} párrafo(s)` : 'Sin texto todavía'}</small></span></li><li><span class="r-main">Correo de contacto<small>${esc(s.contact?.email || 'Sin correo todavía')}</small></span></li></ul><button class="ghost small" type="button" id="editTexts">Editar textos →</button>`);
  const n = gallery.length + items.length + tracks.length + projects.length + socials.length + profiles.length;
  $('#totals').textContent = `${n} ${n === 1 ? 'elemento' : 'elementos'} en la web`;
  if (state.mode === 'files') $('#destHint').textContent = `${DEST[state.dest].hint} Hay ${count(state.dest)} de ${LIMITS[state.dest]}.`;
}
$('#current').addEventListener('click', async e => {
  if (e.target.id === 'editTexts'){setMode('text');$('#mode-text').scrollIntoView({behavior:'smooth', block:'start'});return}
  const b = e.target.closest('[data-del]');if(!b || state.busy)return;
  const kind = b.dataset.del, i = +b.dataset.i, s = state.site;
  // Se identifica por contenido (no por posición) para no borrar otra cosa si la web cambió entretanto.
  const pick = {gallery:() => s.gallery[i], merch:() => s.merch.items[i], tracks:() => s.music.tracks[i], projects:() => s.projects[i], socials:() => s.socials[i], profiles:() => s.music.profiles[i], shop:() => ({title:'el enlace de la tienda'}), floor:() => ({title:'el enlace del suelo'})}[kind]();
  const name = pick.caption || pick.title || pick.label || 'esta foto';
  if (!confirm(`¿Quitar «${name}» de la web?`)) return;
  const same = (a, x) => JSON.stringify(a) === JSON.stringify(x);
  const del = (list, x) => {const j = (list || []).findIndex(y => same(y, x));if(j < 0)throw userError('Eso ya no está en la web. Recarga la página.');return list.splice(j, 1)[0]};
  await apply(`Quitar: ${name}`, site => ({
    gallery:() => [del(site.gallery, pick).src], merch:() => [del(site.merch?.items, pick).src], tracks:() => {const t = del(site.music?.tracks, pick);return [t.src, t.cover]},
    projects:() => [del(site.projects, pick).image], socials:() => {del(site.socials, pick)}, profiles:() => {del(site.music?.profiles, pick)},
    shop:() => {site.merch.url = ''}, floor:() => {site.floor = {...site.floor, url:''}}
  }[kind]()), [], 'Quitando…');
});

// ---- Arranque ----
syncLinkForm();
const saved = loadToken();
if (saved){
  $('#loginMsg').textContent = '';
  enter(saved).catch(err => {if(err.status === 401)clearToken();$('#loginMsg').textContent = err.status === 401 ? 'La sesión caducó. Vuelve a entrar.' : 'No se pudo conectar. Revisa internet y recarga.'});
}
})();
