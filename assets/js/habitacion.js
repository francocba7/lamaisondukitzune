document.addEventListener("DOMContentLoaded", () => {
  'use strict';
  const $ = s => document.querySelector(s);
  const room = $('#room'), frame = $('#frame'), photo = $('#photo'), desktop = $('#desktop'), help = $('#help'), content = $('#content');
  // Portrait tablets use the vertical photo too, so no object is cropped out of view.
  const mobileQuery = matchMedia('(max-width:700px)'), sceneQuery = matchMedia('(orientation:portrait) and (max-width:1100px)'), reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
  // Coordinates are normalized to each ORIGINAL photo. Image and hit areas share one frame.
  const scenes = {
    desktop:{width:1280,height:960,objects:{computer:[.389,.614,.09,.10],speaker:[.321,.614,.061,.094],lamp:[.234,.474,.065,.12],bed:[.75,.732,.26,.18],window:[.768,.407,.17,.25],view:[.445,.42,.065,.07],chair:[.47,.73,.08,.09],floor:[.62,.85,.13,.08]}},
    mobile:{width:720,height:1280,objects:{computer:[.398,.612,.11,.067],speaker:[.324,.607,.065,.065],lamp:[.231,.537,.075,.065],bed:[.79,.676,.25,.12],window:[.895,.483,.13,.15],view:[.446,.501,.075,.045],chair:[.639,.675,.075,.045],floor:[.45,.83,.24,.075]}}
  };
  // Vista cercana del escritorio (foto de Maico, 1500×2000 normalizada).
  const closeScene = {width:1500,height:2000,objects:{screen:[.487,.605,.29,.135],speaker:[.197,.615,.26,.21],lamp:[.055,.25,.1,.16]}};
  const MIN_HIT = 44;
  let lastFocus = null, toastTimer, activeTab = 'projects', interacted = false, introTimer, nudgeTimer;

  // ---- Content (from window.SITE) ----
  // Todo se valida aquí: lo inválido se omite con aviso (consola siempre; en pantalla solo con review:true).
  // Nada se inventa y nada se recorta en silencio.
  const SITE = window.SITE || {}, REVIEW = SITE.review !== false;
  const LIMITS = {projects:6, tracks:5, gallery:12}; // máximos del alcance v1
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const str = v => typeof v === 'string' ? v.trim() : '';
  const pad = n => String(n).padStart(2, '0');
  const notes = {projects:[], gallery:[], music:[], about:[], contact:[], merch:[]};
  const warn = (sec, msg) => {notes[sec].push(msg);console.warn(`[La Maison · ${sec}] ${msg}`)};
  const fileUrl = u => {u = str(u);return u && !u.startsWith('//') && (/^https?:\/\//i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u)) ? u : ''};
  const imgUrl = u => {u = str(u);return /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(u) ? u : fileUrl(u)};
  const linkUrl = u => {u = str(u);return /^https?:\/\/[^\s<>"]+$/i.test(u) ? u : ''};
  const pick = (sec, what, raw, fn) => {const v = fn(raw);if(raw != null && raw !== '' && !v)warn(sec, `${what}: «${String(raw).slice(0, 60)}» no es válido y se ignora.`);return v};
  const asList = (sec, v, what) => {if(v != null && !Array.isArray(v))warn(sec, `«${what}» debe ser una lista [ ].`);return Array.isArray(v) ? v : []};
  const capped = (sec, items, max, what) => {if(items.length > max)warn(sec, `Hay ${items.length} ${what} y el máximo acordado es ${max}: solo se muestran los ${max} primeros. Lo que exceda es una ampliación a cotizar.`);return items.slice(0, max)};
  const linkList = (sec, raw, what) => asList(sec, raw, what).flatMap((l, i) => {
    const href = pick(sec, `${what} nº ${i+1} (url)`, l?.url, linkUrl);
    if (!href){if(!str(l?.url))warn(sec, `${what} nº ${i+1} omitido: falta «url».`);return []}
    let label = str(l.label);if(!label){try{label = new URL(href).hostname.replace(/^www\./, '')}catch(e){label = href}}
    return [{label, url:href}];
  });
  const projects = capped('projects', asList('projects', SITE.projects, 'projects').flatMap((p, i) => {
    if (!str(p?.title)){warn('projects', `Proyecto nº ${i+1} omitido: falta «title».`);return []}
    return [{title:str(p.title), category:str(p.category), year:str(p.year), summary:str(p.summary), description:str(p.description), alt:str(p.alt), linkLabel:str(p.linkLabel),
      image:pick('projects', `«${p.title}» image`, p.image, imgUrl), link:pick('projects', `«${p.title}» link`, p.link, linkUrl)}];
  }), LIMITS.projects, 'proyectos');
  const gallery = capped('gallery', asList('gallery', SITE.gallery, 'gallery').flatMap((g, i) => {
    const src = pick('gallery', `Foto nº ${i+1} (src)`, g?.src, imgUrl);
    if (!src){if(!str(g?.src))warn('gallery', `Foto nº ${i+1} omitida: falta «src».`);return []}
    return [{src, alt:str(g.alt), caption:str(g.caption), broken:false}];
  }), LIMITS.gallery, 'fotografías');
  const profiles = linkList('music', SITE.music?.profiles, 'Perfil');
  const tracks = capped('music', asList('music', SITE.music?.tracks, 'tracks').flatMap((t, i) => {
    const title = str(t?.title);
    if (!title){warn('music', `Tema nº ${i+1} omitido: falta «title».`);return []}
    const src = pick('music', `«${title}» src`, t.src, fileUrl), links = linkList('music', t.links, `«${title}» enlace`);
    if (!src && !links.length){warn('music', `Tema «${title}» omitido: necesita «src» (audio) o al menos un enlace en «links».`);return []}
    return [{title, subtitle:str(t.subtitle), cover:pick('music', `«${title}» cover`, t.cover, imgUrl), src, links}];
  }), LIMITS.tracks, 'temas');
  // Solo en revisión y solo si no hay audio real: una pista generada para probar el reproductor. Nunca llega a la versión pública.
  if (REVIEW && !tracks.some(t => t.src)) tracks.push({title:'Pista de prueba', subtitle:'Audio generado por Serviswebs para probar el reproductor. No es música del artista.', cover:'', src:'', links:[], demo:true});
  const realCount = tracks.filter(t => !t.demo).length;
  const socials = linkList('about', SITE.socials, 'Red');
  // Merch (silla): fotos de los productos y, si existe, un enlace a la tienda. Sin carrito ni pagos.
  const merch = {label:str(SITE.merch?.label) || 'Merch', note:str(SITE.merch?.note), url:pick('merch', '«merch.url»', SITE.merch?.url, linkUrl), items:capped('merch', asList('merch', SITE.merch?.items, 'merch.items').flatMap((m, i) => {
    const src = pick('merch', `Merch nº ${i+1} (src)`, m?.src, imgUrl);
    if (!src){if(!str(m?.src))warn('merch', `Merch nº ${i+1} omitido: falta «src».`);return []}
    return [{src, alt:str(m.alt), caption:str(m.caption), broken:false}];
  }), 12, 'fotos de merch')};
  const about = {title:str(SITE.about?.title) || 'Sobre mí.', text:asList('about', SITE.about?.text, 'about.text').map(str).filter(Boolean), quote:str(SITE.about?.quote), tags:asList('about', SITE.about?.tags, 'about.tags').map(str).filter(Boolean)};
  const mailRaw = str(SITE.contact?.email), mail = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(mailRaw) ? mailRaw : '', contactNote = str(SITE.contact?.note);
  if (mailRaw && !mail) warn('contact', `«email»: «${mailRaw}» no es un correo válido y se ignora.`);
  if (!REVIEW){
    const gaps = [!projects.length && 'proyectos', !gallery.length && 'galería', !tracks.some(t => t.src) && 'música (audio)', !about.text.length && 'texto personal', !socials.length && 'redes', !mail && 'correo'].filter(Boolean);
    if (gaps.length) console.info(`[La Maison] Material pendiente: ${gaps.join(', ')}. Las secciones sin contenido no se muestran.`);
  }
  // Versión pública: una sección sin contenido no aparece (ni su pestaña). En revisión se ven todas con sus pendientes.
  const filled = {projects:projects.length > 0, gallery:gallery.length > 0, about:!!(about.text.length || about.quote || about.tags.length || socials.length),
    music:!!(tracks.length || profiles.length), merch:merch.items.length > 0, contact:!!(mail || socials.length)};
  const shown = tab => REVIEW || filled[tab];
  const TAB_NAMES = {projects:'Proyectos', gallery:'Galería', contact:'Contacto'};
  const laptopTabs = ['projects','gallery','contact'].filter(shown);
  const firstTab = (...order) => order.find(shown) || order.concat(['projects','gallery','about','music','contact']).find(shown) || 'projects';
  document.querySelectorAll('[data-tab]').forEach(b => {b.hidden = !shown(b.dataset.tab)});
  {const pc = $('[data-object="computer"]'), list = laptopTabs.map(t => TAB_NAMES[t].toLowerCase());
    pc.querySelector('.hint').innerHTML = `<span>01</span> ${laptopTabs.length ? TAB_NAMES[laptopTabs[0]] : 'Portfolio'}`;
    if (list.length) pc.setAttribute('aria-label', `Portátil: ${list.length > 1 ? list.slice(0, -1).join(', ')+' y '+list.at(-1) : list[0]}`);
    const hp = $('#helpLaptop');if(hp && list.length)hp.textContent = `El portátil guarda ${list.length > 1 ? list.slice(0, -1).join(', ')+' y '+list.at(-1) : list[0]}.`}
  // Silla (merch) y suelo: enlaces externos. Sin URL válida el objeto no aparece; los números de las pistas siguen el orden visible.
  {const c = $('[data-object="chair"]');c.querySelector('.hint b').textContent = merch.label;
    if (merch.items.length){c.querySelector('.hint i')?.remove();c.setAttribute('aria-label', `Silla: ${merch.label}`);c.setAttribute('aria-haspopup', 'dialog')}
    else if (merch.url) c.setAttribute('aria-label', `Silla: abrir ${merch.label} en una pestaña nueva`);
    else c.hidden = true}
  const extLinks = {floor:pick('about', '«floor.url»', SITE.floor?.url, linkUrl)};
  for (const [name, url] of Object.entries(extLinks)){
    const b = $(`[data-object="${name}"]`);if(!b)continue;
    if (!url){b.hidden = true;continue}
    b.href = url;
    const label = str(SITE.floor?.label);if(label){b.querySelector('.hint b').textContent = label;b.setAttribute('aria-label', `Suelo: abrir ${label} en una pestaña nueva`)}
  }
  const roomSpots = () => [...frame.querySelectorAll('.hotspot:not([hidden])')];
  roomSpots().forEach((b, i) => {const n = b.querySelector('.hint > span');if(n)n.textContent = pad(i+1)});
  // iOS/iPadOS no permiten fijar el volumen desde la página: se detecta y no se muestra un control que no hace nada.
  const volumeOk = (() => {try{const a = new Audio();a.volume = .5;return a.volume === .5}catch(e){return false}})();
  const ext = u => /^https?:/i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : '';
  const links = items => items.map(l => `<a class="chip" href="${esc(l.url)}"${ext(l.url)}>${esc(l.label)} <span aria-hidden="true">↗</span></a>`).join('');
  const pend = (what, detail = '') => REVIEW ? `<div class="pending-block"><span class="pending-tag">Pendiente</span><strong>${what}</strong>${detail ? `<small>${detail}</small>` : ''}</div>` : '';
  const showNotes = sec => REVIEW ? notes[sec].map(n => `<div class="pending-block is-warn"><span class="pending-tag">Aviso</span><strong>${esc(n)}</strong></div>`).join('') : '';
  const empty = text => REVIEW ? '' : `<p class="empty-state">${text}</p>`;
  const top = (label, missing) => `<div class="section-topline"><span class="eyebrow">${label}</span>${REVIEW && missing ? '<span class="demo-tag">Material pendiente</span>' : ''}</div>`;
  const ROOM = photo.getAttribute('src'); // the room photo, reused for placeholder crops (no extra weight)
  if (REVIEW) document.body.classList.add('is-review');
  $('#windowStatus').textContent = REVIEW ? 'portfolio / revisión' : 'portfolio';
  const counts = {projects:projects.length, gallery:gallery.length, music:realCount, merch:merch.items.length};
  document.querySelectorAll('[data-tab] .nav-count').forEach(c => {const n = counts[c.parentNode.dataset.tab];c.textContent = n ? pad(n) : ''});

  // Places a photo frame and its hotspots. Portrait: whole photo (contain). Landscape: cover, or zoomed out just enough
  // for every object to fit between header and footer (maxSpan), sliding the photo so no object touches an edge.
  function layoutScene(fr, scene, attr, portrait, maxSpan){
    const W = room.clientWidth, H = room.clientHeight, objs = Object.entries(scene.objects).filter(([n]) => !$(`[${attr}="${n}"]`)?.hidden);
    let scale = (portrait ? Math.min : Math.max)(W/scene.width, H/scene.height);
    // margins keep objects clear of header (top) and footer (bottom); smaller on short screens
    const mTop = Math.min(90, H*.15), mBot = Math.min(110, H*.2);
    if (!portrait && maxSpan) scale = Math.max(Math.min(W/scene.width, H/scene.height), Math.min(scale, H/(maxSpan[1]*scene.height)));
    else if (!portrait){ // zoom out just enough for every object to fit between header and footer (the blurred copy fills the sides)
      const ys = objs.map(([, o]) => o[1]), span = (Math.max(...ys)-Math.min(...ys))*scene.height;
      if (span*scale > H-mTop-mBot) scale = Math.max(Math.min(W/scene.width, H/scene.height), (H-mTop-mBot)/span);
    }
    const width = scene.width*scale, height = scene.height*scale;
    let left = (W-width)/2, top = (H-height)/2;
    if (!portrait && maxSpan) top = Math.min(0, Math.max(H-height, H/2-maxSpan[0]*height));
    else if (!portrait){ // slide the photo so every object stays clear of the edges, header and footer
      const fit = (v, lo, hi, min, max) => Math.min(max, Math.max(min, lo > hi ? (lo+hi)/2 : Math.min(hi, Math.max(lo, v))));
      const xs = objs.map(([, o]) => o[0]*width), ys = objs.map(([, o]) => o[1]*height);
      left = fit(left, W-70-Math.max(...xs), 70-Math.min(...xs), Math.min(W-width, (W-width)/2), Math.max(0, (W-width)/2));
      top = fit(top, H-mBot-Math.max(...ys), mTop-Math.min(...ys), Math.min(H-height, (H-height)/2), Math.max(0, (H-height)/2));
    }
    Object.assign(fr.style, {width:width+'px', height:height+'px', left:left+'px', top:top+'px'});
    // The minimum touch size grows around the object's centre, so the dot never drifts from its coordinates.
    const boxes = objs.map(([name, [x, y, w, h]]) => {const bw = Math.max(w*width, MIN_HIT), bh = Math.max(h*height, MIN_HIT), cx = x*width, cy = y*height;return {name, cx, l:cx-bw/2, r:cx+bw/2, t:cy-bh/2, b:cy+bh/2}});
    // Objects that sit close together (laptop and speaker on a phone) split the space between them instead of overlapping;
    // each keeps the minimum width by growing away from its neighbour, and the dot stays on the object.
    for (const a of boxes) for (const c of boxes){
      if (a.cx >= c.cx || a.r <= c.l || a.t >= c.b || c.t >= a.b) continue;
      const mid = (a.cx+c.cx)/2;a.r = Math.min(a.r, mid);c.l = Math.max(c.l, mid);
      if (a.r-a.l < MIN_HIT) a.l = a.r-MIN_HIT;if(c.r-c.l < MIN_HIT)c.r = c.l+MIN_HIT;
    }
    for (const {name, cx, l, r, t, b: bt} of boxes){
      const b = $(`[${attr}="${name}"]`);
      Object.assign(b.style, {left:l/width*100+'%', top:t/height*100+'%', width:(r-l)/width*100+'%', height:(bt-t)/height*100+'%'});
      b.style.setProperty('--dx', (cx-(l+r)/2).toFixed(1)+'px');
    }
  }
  function fitScene(){
    const portrait = sceneQuery.matches, scene = scenes[portrait ? 'mobile' : 'desktop'];
    layoutScene(frame, scene, 'data-object', portrait);
    for (const [name, key] of [['lamp','lamp'],['window','win']]){
      frame.style.setProperty(`--${key}-x`, scene.objects[name][0]*100+'%');
      frame.style.setProperty(`--${key}-y`, scene.objects[name][1]*100+'%');
    }
    layoutScene($('#cuFrame'), closeScene, 'data-cu', portrait, [.53, .7]); // apaisado: centrado en el escritorio, ~70 % del alto de la foto visible
  }
  new ResizeObserver(fitScene).observe(room); sceneQuery.addEventListener('change', fitScene); fitScene();
  function reveal(){
    room.classList.add('ready');
    const inv = $('.invitation');
    if (reducedMotion.matches){startNudge();return}
    inv.classList.add('show');
    introTimer = setTimeout(() => {inv.classList.remove('show');startNudge()}, 3700);
  }
  // After the intro the laptop label shows once, so there is always an obvious place to start (also on touch).
  function startNudge(){const b = $('[data-object="computer"]');if(interacted||!b||room.classList.contains('show-hints'))return;b.classList.add('nudge');nudgeTimer = setTimeout(stopNudge, 9000)}
  function stopNudge(){clearTimeout(nudgeTimer);$('.hotspot.nudge')?.classList.remove('nudge')}
  for (const t of ['pointerdown','keydown']) addEventListener(t, () => {interacted = true;stopNudge()}, {passive:true, capture:true});
  document.querySelectorAll('.hotspot').forEach(b => b.addEventListener('pointerenter', () => {interacted = true;stopNudge()}));
  if (photo.complete && photo.naturalWidth) reveal(); else photo.addEventListener('load', reveal, {once:true});
  photo.addEventListener('error', () => {room.classList.add('ready');notify('No se pudo cargar la fotografía. Vuelve a abrir la página.')});
  function notify(text){$('#toast').textContent = text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600)}
  function setHints(value){room.classList.toggle('show-hints', value);$('#hintsButton').setAttribute('aria-pressed', String(value));$('#hintsButton').innerHTML = (value ? 'Ocultar pistas' : 'Ver pistas')+' <span class="key">H</span>'}
  $('#hintsButton').addEventListener('click', () => setHints(!room.classList.contains('show-hints')));
  function closeDialog(dialog, ms = mobileQuery.matches && dialog === desktop ? 260 : 180){if(!dialog.open||dialog.classList.contains('closing'))return;dialog.classList.add('closing');setTimeout(() => {dialog.close();dialog.classList.remove('closing','swiped');dialog.style.translate = '';dialog.style.transition = '';lastFocus?.focus({preventScroll:true})}, reducedMotion.matches ? 0 : ms)}
  function openWindow(tab, origin){
    $('.invitation').classList.remove('show');lastFocus = origin || document.activeElement;
    render(tab);desktop.showModal();$('#closeWindow').focus({preventScroll:true});
    if (origin){// the window opens from the object that was chosen
      const r = origin.getBoundingClientRect(), left = (innerWidth-desktop.offsetWidth)/2, top = (innerHeight-desktop.offsetHeight)/2;
      desktop.style.setProperty('--ox', (r.x+r.width/2-left)+'px');desktop.style.setProperty('--oy', (r.y+r.height/2-top)+'px');
    }
  }
  $('#closeWindow').addEventListener('click', () => closeDialog(desktop));
  for (const dialog of [desktop, help]){
    // Escape steps back from a project or photo first, then closes the window.
    dialog.addEventListener('cancel', e => {e.preventDefault();if(dialog === desktop && content.dataset.parent){render(content.dataset.parent);return}closeDialog(dialog)});
    dialog.addEventListener('click', e => {if(e.target === dialog){const r = dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog)}});
  }
  $('#helpButton').addEventListener('click', () => {lastFocus = document.activeElement;help.showModal()});
  $('#indexButton').addEventListener('click', e => openWindow(firstTab('projects','gallery','contact'), e.currentTarget));
  $('#closeHelp').addEventListener('click', () => closeDialog(help));$('#startExplore').addEventListener('click', () => {closeDialog(help);setHints(true)});
  document.addEventListener('keydown', e => {
    if (e.ctrlKey||e.metaKey||e.altKey||desktop.open||help.open||e.target.closest?.('input,textarea')) return;
    const close = room.classList.contains('view-close');
    if (e.key === 'Escape' && close){e.preventDefault();exitClose()}
    else if (e.key.toLowerCase() === 'h' && !close){e.preventDefault();setHints(!room.classList.contains('show-hints'))}
    else if (/^[1-9]$/.test(e.key)){e.preventDefault();(close ? [...closeup.querySelectorAll('[data-cu]')] : roomSpots())[Number(e.key)-1]?.click()}
  });
  desktop.addEventListener('keydown', e => {
    if ((content.dataset.parent === 'gallery' || content.dataset.parent === 'merch') && /^Arrow(Left|Right)$/.test(e.key) && !e.target.closest('input')){e.preventDefault();{const s = e.key === 'ArrowLeft' ? -1 : 1;photoView(Number(content.dataset.photo)+s, s, content.dataset.parent)}}
  });
  document.querySelectorAll('.hotspot').forEach(b => b.addEventListener('click', () => {
    switch (b.dataset.object){
      case 'computer':openWindow(firstTab('projects','gallery','contact'), b);break;
      case 'speaker':openWindow(firstTab('music'), b);break;
      case 'bed':openWindow(firstTab('about','contact'), b);break;
      case 'lamp':toggleLamp(b);break;
      case 'view':enterClose();break;
      case 'chair':if(merch.items.length)openWindow('merch', b);else if(merch.url)window.open(merch.url, '_blank', 'noopener');break;
      case 'window':{const night = room.classList.toggle('night');b.setAttribute('aria-pressed', String(night));burst(b);updateAmbience();notify(night ? 'Modo noche. La habitación, después de medianoche.' : 'De vuelta a la luz cálida.');break}
    }
  }));
  // ---- Vista cercana del escritorio: otra foto con sus propios objetos; Escape o «Volver» regresa a la habitación ----
  const closeup = $('#closeup');closeup.inert = true;
  function enterClose(){
    if (room.classList.contains('view-close')) return;
    const v = scenes[sceneQuery.matches ? 'mobile' : 'desktop'].objects.view;
    frame.style.setProperty('--zx', v[0]*100+'%');frame.style.setProperty('--zy', v[1]*100+'%');
    const kb = $('[data-object="view"]').matches(':focus-visible'); // focus ring only for keyboard users
    setHints(false);stopNudge();room.classList.add('view-close');frame.inert = true;closeup.inert = false;
    setTimeout(() => $('[data-cu="screen"]').focus({preventScroll:true, focusVisible:kb}), reducedMotion.matches ? 0 : 500);
  }
  function exitClose(){
    if (!room.classList.contains('view-close')) return;
    room.classList.remove('view-close');frame.inert = false;closeup.inert = true;$('[data-object="view"]').focus({preventScroll:true});
  }
  function toggleLamp(b){
    const off = room.classList.toggle('lamp-off');
    for (const x of [$('[data-object="lamp"]'), $('[data-cu="lamp"]')]) x.setAttribute('aria-pressed', String(!off));
    burst(b);updateAmbience();notify(off ? 'Un poco de calma. Luz apagada.' : 'La luz de siempre.');
  }
  $('#cuBack').addEventListener('click', exitClose);
  closeup.querySelectorAll('[data-cu]').forEach(b => b.addEventListener('click', () => {
    switch (b.dataset.cu){
      case 'screen':openWindow(firstTab('projects','gallery','contact'), b);break;
      case 'speaker':openWindow(firstTab('music'), b);break;
      case 'lamp':toggleLamp(b);break;
    }
  }));
  function burst(b){b.classList.remove('burst');void b.offsetWidth;b.classList.add('burst');setTimeout(() => b.classList.remove('burst'), 850)}
  function updateAmbience(){
    const night = room.classList.contains('night'), off = room.classList.contains('lamp-off'), label = night ? 'Modo noche' : off ? 'Luz tenue' : 'Luz cálida', el = $('#ambienceLabel');
    room.dataset.mood = night ? 'night' : off ? 'dim' : 'warm';
    if (el.textContent !== label){el.textContent = label;el.classList.remove('swap');void el.offsetWidth;el.classList.add('swap')}
  }

  // ---- Pages ----
  const bars = Array.from({length:52}, (_, i) => `<i style="--bar-height:${10+Math.abs(Math.sin(i*1.7)*Math.cos(i*.31))*44}px;--delay:${-(i%9)*.14}s"></i>`).join('');
  const trackRow = (t, i) => {
    const playable = !!(t.src || t.demo), sub = t.demo ? 'Prueba técnica' : t.subtitle || (playable ? '' : 'Solo en plataformas');
    const body = `<span class="tr-num">${pad(i+1)}</span><span class="tr-title">${esc(t.title)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
    return playable ? `<li><button class="track-row" data-track="${i}">${body}<span class="tr-state" aria-hidden="true"></span></button></li>`
      : `<li><div class="track-row is-static">${body}<span class="chip-row">${links(t.links)}</span></div></li>`;
  };
  const pages = {
    projects:() => {
      const cards = projects.length
        ? projects.map((p, i) => `<button class="project-card" data-project="${i}">${p.image ? `<div class="project-image"><img src="${esc(p.image)}" alt="" loading="lazy" decoding="async"></div>` : REVIEW ? '<div class="project-image"><span class="img-missing">Imagen pendiente</span></div>' : ''}<div class="project-meta"><small>${pad(i+1)}${p.category ? ' / '+esc(p.category).toUpperCase() : ''}</small><h3>${esc(p.title)}</h3>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}</div></button>`).join('')
        : REVIEW ? [['desk','01'],['light','02'],['bed','03'],['window','04']].map(([crop, n]) => `<div class="project-card is-pending" aria-hidden="true"><div class="project-image ${crop}"><img src="${ROOM}" alt=""></div><div class="project-meta"><small>${n} / PENDIENTE</small><h3>Proyecto de Maico</h3><p>Imagen, descripción y enlace.</p></div></div>`).join('') : '';
      return `${top('DESDE ESTE ESCRITORIO', !projects.length)}<h2 class="page-title">Ideas que nacen aquí.</h2><p class="page-intro">Un espacio para lo que hago, lo que pruebo y lo que todavía estoy imaginando.</p>${showNotes('projects')}${cards ? `<div class="project-grid">${cards}</div>` : ''}${projects.length ? '' : pend('Hasta 6 proyectos', 'Por cada uno: título (obligatorio), imagen, descripción breve y enlace.')+empty('Los proyectos llegarán pronto.')}`;
    },
    gallery:() => `${top('LO QUE GUARDA ESTA HABITACIÓN', !gallery.length)}<h2 class="page-title">Galería.</h2><p class="page-intro">Fotografías y detalles del universo de La Maison Du Kitzune.</p>${showNotes('gallery')}${gallery.length
      ? `<div class="gallery-grid">${gallery.map((g, i) => `<button class="gallery-item" data-photo="${i}" aria-label="Ver foto ${i+1}${g.alt ? ': '+esc(g.alt) : ''}"><img src="${esc(g.src)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>`
      : (REVIEW ? `<div class="gallery-grid">${Array.from({length:6}, (_, i) => `<div class="gallery-item is-pending" aria-hidden="true"><span>${pad(i+1)}</span></div>`).join('')}</div>` : '')+pend('Hasta 12 fotografías', 'JPG de buena calidad, idealmente 1600 px en el lado mayor, con una breve descripción de cada una.')+empty('La galería llegará pronto.')}`,
    about:() => {
      const body = about.text.length || about.quote || about.tags.length || socials.length;
      return `${top('FUERA DE PANTALLA', !about.text.length || !socials.length)}<h2 class="page-title">${esc(about.title)}</h2>${showNotes('about')}${about.text.map(p => `<p class="page-intro">${esc(p)}</p>`).join('') || pend('Texto personal', 'Un párrafo breve sobre Maico y La Maison Du Kitzune, escrito o aprobado por el cliente.')}${about.quote ? `<blockquote class="about-quote">${esc(about.quote)}</blockquote>` : ''}${about.tags.length ? `<div class="personal-list">${about.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}${socials.length ? `<h3 class="sub-title">Redes</h3><div class="chip-row">${links(socials)}</div>` : pend('Enlaces a redes', 'Los iconos del pie de la web actual llevan a cuentas de ejemplo de Wix; hacen falta los perfiles reales.')}${body ? '' : empty('Esta sección llegará pronto.')}`;
    },
    music:() => {
      const hasPlay = player.sel > -1, vol = volumeOk
        ? `<div class="volume-row"><span>Volumen</span><input id="volume" type="range" min="0" max="1" step=".01" value="${player.volume}" aria-label="Volumen"><span id="volumeLabel">${Math.round(player.volume*100)}%</span></div>`
        : '<p class="volume-note">El volumen se ajusta con los botones del dispositivo.</p>';
      const card = hasPlay ? `<div class="player"><div class="player-head"><div class="cover" id="cover"></div><div class="player-info"><span class="track-label" id="trackLabel"></span><h3 class="track-name" id="trackName"></h3><p class="track-caption" id="trackCaption"></p></div></div><div class="wave" aria-hidden="true">${bars}</div><div class="player-transport"><button id="playButton" class="play-button">▶</button><div class="time-line"><input id="seek" type="range" min="0" max="1" step=".1" value="0" aria-label="Posición de reproducción"><div class="time-labels"><span id="elapsed">0:00</span><span id="duration">–:––</span></div></div></div>${vol}<div class="chip-row" id="trackLinks"></div></div>` : '';
      const list = tracks.length && (tracks.length > 1 || !hasPlay) ? `<ol class="tracklist">${tracks.map(trackRow).join('')}</ol>` : '';
      return `${top('EN LOS ALTAVOCES', !realCount)}<h2 class="page-title">Así suena este espacio.</h2><p class="page-intro">Baja el ritmo. Quédate un rato.</p>${showNotes('music')}${card}${list}${profiles.length ? `<h3 class="sub-title">Escucha en</h3><div class="chip-row">${links(profiles)}</div>` : ''}${tracks.some(t => t.src) ? '' : pend('Hasta 5 temas', 'Por cada uno: título, MP3 y portada cuadrada, o al menos un enlace a plataforma. La pista de prueba desaparece al cargar el primer tema con audio.')}${profiles.length ? '' : pend('Perfiles en plataformas', 'Spotify, Apple Music, YouTube, SoundCloud u otras que use Maico.')}${tracks.length || profiles.length ? '' : empty('La música llegará pronto.')}`;
    },
    merch:() => `${top('EN LA SILLA')}<h2 class="page-title">${esc(merch.label)}.</h2>${merch.note ? `<p class="page-intro">${esc(merch.note)}</p>` : ''}${showNotes('merch')}<div class="gallery-grid merch-grid">${merch.items.map((m, i) => `<button class="gallery-item merch-item" data-photo="${i}" data-kind="merch" aria-label="Ver ${esc(m.alt || m.caption || 'producto '+(i+1))}"><img src="${esc(m.src)}" alt="" loading="lazy" decoding="async">${m.caption ? `<span class="merch-caption">${esc(m.caption)}</span>` : ''}</button>`).join('')}</div>${merch.url ? `<a class="outline-button" href="${esc(merch.url)}"${ext(merch.url)}>Ver tienda ↗</a>` : ''}`,
    contact:() => `${top('SIGAMOS LA CONVERSACIÓN', !mail)}<h2 class="page-title">Un punto de encuentro.</h2><p class="page-intro">Después de recorrer este espacio, la conversación sigue por aquí.</p>${showNotes('contact')}${mail ? `<a class="contact-card" href="mailto:${esc(mail)}"><small>Escríbeme</small>${esc(mail)}</a>` : pend('Correo de contacto', 'La web actual muestra un correo de ejemplo de Wix (info@misitio.com); hace falta el real.')}${contactNote ? `<p class="page-note">${esc(contactNote)}</p>` : ''}${socials.length ? `<h3 class="sub-title">Encuéntrame en</h3><div class="chip-row">${links(socials)}</div>` : ''}${mail || socials.length ? '' : empty('El contacto llegará pronto.')}`
  };
  function render(tab){activeTab = tab;delete content.dataset.parent;document.querySelectorAll('[data-tab]').forEach(b => {b.classList.toggle('active', b.dataset.tab === tab);if(b.dataset.tab === tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});content.innerHTML = `<section class="page">${pages[tab]()}</section>`;content.scrollTop = 0;
    content.querySelectorAll('[data-project]').forEach(b => b.addEventListener('click', () => projectDetail(Number(b.dataset.project))));
    content.querySelectorAll('[data-photo]').forEach(b => b.addEventListener('click', () => photoView(Number(b.dataset.photo), 1, b.dataset.kind || 'gallery')));
    if (tab === 'music') bindPlayer();
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => render(b.dataset.tab)));
  // An image that fails to load never shows a broken icon: hidden for visitors, flagged in review, logged either way.
  content.addEventListener('error', e => {
    const img = e.target;if(!(img instanceof HTMLImageElement) || !content.contains(img))return;
    console.warn('[La Maison] No se pudo cargar la imagen:', img.getAttribute('src'));
    const slot = img.closest('.project-image, .gallery-item, .detail-photo-box, .cover, .photo-view');if(!slot)return;
    const g = slot.dataset.photo !== undefined ? viewers[slot.dataset.kind || content.dataset.parent || 'gallery']?.list[Number(slot.dataset.photo)] : null;if(g)g.broken = true;
    if (slot.classList.contains('photo-view')){ // opened a photo that cannot load: mark it and move on to the next one that can
      const kind = content.dataset.parent, L = viewers[kind].list, cur = Number(content.dataset.photo), dir = Number(content.dataset.dir) || 1;L[cur].broken = true;
      if (L.some(x => !x.broken)){photoView(cur+dir, dir, kind);return}
    }
    img.remove();slot.classList.add('is-broken');
  }, true);
  function projectDetail(i){const p = projects[i];
    content.innerHTML = `<section class="page"><button id="back" class="back-link">← Volver a proyectos</button>${top(`PROYECTO ${pad(i+1)}${p.year ? ' · '+esc(p.year) : ''}`)}<h2 class="page-title">${esc(p.title)}</h2>${p.image ? `<div class="detail-photo-box"><img class="detail-photo" src="${esc(p.image)}" alt="${esc(p.alt || p.title)}"></div>` : pend('Imagen del proyecto')}${p.description || p.summary ? `<p class="page-intro">${esc(p.description || p.summary)}</p>` : pend('Descripción breve')}${p.category ? `<div class="detail-row"><strong>Categoría</strong><span>${esc(p.category)}</span></div>` : ''}${p.link ? `<a class="outline-button" href="${esc(p.link)}"${ext(p.link)}>${esc(p.linkLabel || 'Ver proyecto')} ↗</a>` : pend('Enlace del proyecto')}</section>`;
    content.dataset.parent = 'projects';content.scrollTop = 0;$('#back').addEventListener('click', () => render('projects'));$('#back').focus({preventScroll:true})}
  const viewers = {gallery:{list:gallery, back:'← Volver a la galería', alt:'Fotografía'}, merch:{list:merch.items, back:'← Volver al merch', alt:'Producto'}};
  function photoView(i, dir = 1, kind = 'gallery'){const V = viewers[kind], L = V.list, n = L.length;
    for (let k = 0; k < n; k++){const j = (((i+k*dir) % n)+n) % n;if(!L[j].broken){i = j;break}}
    i = ((i % n)+n) % n;const g = L[i], visible = L.filter(x => !x.broken).length;
    content.innerHTML = `<section class="page"><button id="back" class="back-link">${V.back}</button><figure class="photo-view${kind === 'merch' ? ' is-merch' : ''}"><img src="${esc(g.src)}" alt="${esc(g.alt || `${V.alt} ${i+1}`)}"><figcaption>${esc(g.caption)}<span>${pad(L.slice(0, i+1).filter(x => !x.broken).length)} / ${pad(visible)}</span></figcaption></figure>${visible > 1 ? '<div class="photo-nav"><button class="outline-button" data-step="-1" aria-label="Foto anterior">←</button><button class="outline-button" data-step="1" aria-label="Foto siguiente">→</button></div>' : ''}</section>`;
    content.dataset.parent = kind;content.dataset.photo = i;content.dataset.dir = dir;content.scrollTop = 0;$('#back').addEventListener('click', () => render(kind));
    content.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {const s = Number(b.dataset.step);photoView(i+s, s, kind);content.querySelector(`[data-step="${s}"]`)?.focus({preventScroll:true})}));
    if (!content.contains(document.activeElement) || document.activeElement === content) $('#back').focus({preventScroll:true})}

  // ---- Music: one <audio> element, so two songs can never play at once ----
  const audio = new Audio(), player = {sel:tracks.findIndex(t => t.src || t.demo), loaded:-1, shown:-1, loading:false, volume:.6};
  audio.preload = 'metadata';if(volumeOk)audio.volume = player.volume;
  let seeking = false, demoUrl = null;
  function formatTime(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
  async function demoTrack(){ // the original 48 s demo piece, rendered to WAV so it uses the same player as real songs
    if (demoUrl) return demoUrl;
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;if(!Offline)throw new Error('Audio no disponible');
    const D = 48, R = 22050, off = new Offline(2, R*D, R), master = off.createGain();master.gain.value = .22;master.connect(off.destination);
    const chords = [[130.81,164.81,196],[110,130.81,164.81],[87.31,110,130.81],[98,123.47,146.83]];
    chords.forEach((chord, i) => chord.forEach((hz, j) => {const o = off.createOscillator(), g = off.createGain();o.type = 'sine';o.frequency.value = hz;o.detune.value = j*3-3;g.gain.setValueAtTime(0, i*12);g.gain.linearRampToValueAtTime(.18, i*12+2.5);g.gain.setValueAtTime(.18, i*12+9);g.gain.linearRampToValueAtTime(0, (i+1)*12);o.connect(g);g.connect(master);o.start(i*12);o.stop((i+1)*12)}));
    [523.25,392,329.63,261.63,440,329.63,261.63,220,349.23,261.63,220,174.61,392,293.66,246.94,196].forEach((hz, i) => {const o = off.createOscillator(), g = off.createGain();const t = i*3+.4;o.frequency.value = hz;g.gain.setValueAtTime(0, t);g.gain.linearRampToValueAtTime(.07, t+.12);g.gain.exponentialRampToValueAtTime(.0001, Math.min(t+2.5, D));o.connect(g);g.connect(master);o.start(t);o.stop(Math.min(t+2.6, D))});
    const buf = await off.startRendering(), n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)], v = new DataView(new ArrayBuffer(44+n*4));
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o+i, c.charCodeAt(0)));
    str(0,'RIFF');v.setUint32(4, 36+n*4, true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16, 16, true);v.setUint16(20, 1, true);v.setUint16(22, 2, true);v.setUint32(24, R, true);v.setUint32(28, R*4, true);v.setUint16(32, 4, true);v.setUint16(34, 16, true);str(36,'data');v.setUint32(40, n*4, true);
    for (let i = 0, o = 44; i < n; i++) for (const c of ch){v.setInt16(o, Math.max(-1, Math.min(1, c[i]))*32767, true);o += 2}
    return demoUrl = URL.createObjectURL(new Blob([v], {type:'audio/wav'}));
  }
  async function playTrack(i){
    const t = tracks[i];if(!t || player.loading || !(t.src || t.demo))return;
    player.sel = i;player.loading = true;syncPlayer();
    try{
      if (player.loaded !== i){audio.pause();player.loaded = i;audio.src = t.demo ? await demoTrack() : t.src}
      await audio.play();
    }catch(e){
      if (e.name === 'NotAllowedError') notify('El navegador ha bloqueado el audio. Pulsa play otra vez.');
      else if (e.message === 'Audio no disponible'){player.loaded = -1;notify('El audio no está disponible en este navegador.')}
    }finally{player.loading = false;syncPlayer()}
  }
  function togglePlay(){if(player.loaded === player.sel && !audio.paused)audio.pause();else playTrack(player.sel)}
  for (const ev of ['play','pause','loadedmetadata','durationchange','ended']) audio.addEventListener(ev, syncPlayer);
  audio.addEventListener('timeupdate', () => {if(desktop.open && activeTab === 'music')syncTime();room.classList.toggle('music-on', player.loaded > -1 && (!audio.paused || audio.currentTime > .05))});
  audio.addEventListener('ended', () => {audio.currentTime = 0;syncPlayer()});
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    const t = tracks[player.loaded], name = `“${t?.title || 'el tema'}”`;
    console.warn('[La Maison] No se pudo cargar el audio:', t?.src);
    notify(REVIEW ? `No se pudo cargar ${name}. Comprueba que el archivo existe en media/musica/.` : `No se pudo cargar ${name}. Inténtalo de nuevo más tarde.`);
    player.loaded = -1;audio.removeAttribute('src');audio.load();syncPlayer();
  });
  const fill = el => el.style.setProperty('--fill', (el.value-el.min)/((el.max-el.min) || 1)*100+'%');
  function syncTime(){
    const seek = $('#seek');if(!seek)return;
    const here = player.loaded === player.sel, d = here && isFinite(audio.duration) ? audio.duration : 0, c = here ? audio.currentTime : 0;
    seek.max = d || 1;seek.disabled = !d;if(!seeking)seek.value = c;fill(seek);$('#elapsed').textContent = formatTime(c);$('#duration').textContent = d ? formatTime(d) : '–:––';
  }
  function syncPlayer(){
    // Mini player in the room: visible while playing or paused mid-track, so the music survives closing the window.
    const playing = !audio.paused, t = tracks[player.loaded];
    room.classList.toggle('music-on', !!t && (playing || audio.currentTime > .05));room.classList.toggle('music-playing', playing);
    $('#nowPlaying').setAttribute('aria-label', (playing ? 'Pausar ' : 'Reanudar ')+(t?.title || 'música'));$('#npGlyph').textContent = playing ? 'Ⅱ' : '▶';$('#npTitle').textContent = t?.title || '';
    const b = $('#playButton');if(!b)return;
    const s = tracks[player.sel] || {}, on = player.loaded === player.sel && playing, real = tracks.filter(x => x.src);
    $('.player').classList.toggle('playing', on);
    b.disabled = player.loading;b.textContent = player.loading ? '…' : on ? 'Ⅱ' : '▶';b.setAttribute('aria-label', (on ? 'Pausar ' : 'Reproducir ')+(s.title || 'tema'));
    if (player.shown !== player.sel){ // track info only changes when another song is selected
      player.shown = player.sel;
      $('#trackLabel').textContent = s.demo ? 'PRUEBA TÉCNICA' : real.length > 1 ? `TEMA ${pad(real.indexOf(s)+1)} / ${pad(real.length)}` : 'TEMA';
      $('#trackName').textContent = s.title || '';
      $('#trackCaption').textContent = s.subtitle || '';
      $('#cover').innerHTML = s.cover ? `<img src="${esc(s.cover)}" alt="Portada de ${esc(s.title)}">` : '<span aria-hidden="true">♫</span>';
      $('#trackLinks').innerHTML = links(s.links || []);
    }
    document.querySelectorAll('[data-track]').forEach(r => {const i = Number(r.dataset.track);r.classList.toggle('active', i === player.sel);r.setAttribute('aria-pressed', String(i === player.loaded && playing))});
    syncTime();
  }
  $('#nowPlaying').addEventListener('click', () => {if(!audio.paused)audio.pause();else if(player.loaded > -1)playTrack(player.loaded)});
  function bindPlayer(){
    if (!$('#playButton')) return;
    player.shown = -1;$('#playButton').addEventListener('click', togglePlay);
    const seek = $('#seek'), vol = $('#volume');
    seek.addEventListener('pointerdown', () => seeking = true);seek.addEventListener('change', () => seeking = false);
    seek.addEventListener('input', e => {if(player.loaded === player.sel && isFinite(audio.duration))audio.currentTime = Number(e.target.value);fill(e.target);$('#elapsed').textContent = formatTime(Number(e.target.value))});
    if (vol){fill(vol);vol.addEventListener('input', e => {player.volume = audio.volume = Number(e.target.value);fill(e.target);$('#volumeLabel').textContent = Math.round(player.volume*100)+'%'})}
    content.querySelectorAll('[data-track]').forEach(r => r.addEventListener('click', () => {const i = Number(r.dataset.track);if(i === player.loaded && !audio.paused)audio.pause();else playTrack(i)}));
    syncPlayer();
  }

  // Mouse parallax: the whole frame (photo + hotspots) moves together, so alignment never changes.
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  let tx = 0, ty = 0, px = 0, py = 0, raf = 0;
  function tick(){px += (tx-px)*.08;py += (ty-py)*.08;frame.style.setProperty('--px', (-px*18).toFixed(2)+'px');frame.style.setProperty('--py', (-py*10).toFixed(2)+'px');raf = Math.abs(tx-px) > .0005 || Math.abs(ty-py) > .0005 ? requestAnimationFrame(tick) : 0}
  room.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !finePointer.matches || reducedMotion.matches || desktop.open || help.open) return;
    tx = e.clientX/room.clientWidth-.5;ty = e.clientY/room.clientHeight-.5;
    room.style.setProperty('--mx', e.clientX+'px');room.style.setProperty('--my', e.clientY+'px');room.classList.add('pointer-in');
    if (!raf) raf = requestAnimationFrame(tick);
  });
  room.addEventListener('pointerleave', () => {room.classList.remove('pointer-in');tx = ty = 0;if(!raf && !reducedMotion.matches)raf = requestAnimationFrame(tick)});
  // Mobile: the portfolio is a bottom sheet; dragging its top bar down closes it.
  const bar = $('.window-bar');let drag = null;
  bar.addEventListener('pointerdown', e => {if(!mobileQuery.matches || e.target.closest('button'))return;drag = {id:e.pointerId, y:e.clientY, dy:0};bar.setPointerCapture(e.pointerId);desktop.style.transition = 'none'});
  bar.addEventListener('pointermove', e => {if(!drag || e.pointerId !== drag.id)return;drag.dy = Math.max(0, e.clientY-drag.y);desktop.style.translate = '0 '+drag.dy+'px'});
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;const dy = drag.dy;drag = null;
    if (dy > 110 && e.type === 'pointerup'){desktop.classList.add('swiped');desktop.style.transition = 'translate .22s ease-in';desktop.style.translate = '0 105%';closeDialog(desktop, 230)}
    else {desktop.style.transition = 'translate .3s cubic-bezier(.22,1,.36,1)';desktop.style.translate = '0 0';setTimeout(() => {if(!desktop.classList.contains('closing')){desktop.style.transition = '';desktop.style.translate = ''}}, 320)}
  };
  bar.addEventListener('pointerup', endDrag);bar.addEventListener('pointercancel', endDrag);
});
