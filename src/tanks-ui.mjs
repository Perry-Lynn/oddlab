import { SIZE, TILE, GRID, createTankGame, startTankGame, pauseTankGame, nextTankLevel, stepTankGame } from './tanks-logic.mjs';
import { tankCopy } from './tanks-copy.mjs';
import { link } from './hosting.mjs';

const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const recordKey = 'oddlab_tanks_best_v1';
const arrows = { up: '↑', left: '←', down: '↓', right: '→' };
const keys = { ArrowUp: 'up', KeyW: 'up', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left' };
const colors = { player: '#f2cf66', scout: '#dc886b', runner: '#90bbd2', armor: '#c4abd6' };

function pixelTank(ctx, tank) {
  ctx.save();
  ctx.translate(Math.round(tank.x), Math.round(tank.y));
  ctx.rotate(({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 })[tank.dir]);
  const color = tank.team === 'player' ? colors.player : colors[tank.type];
  ctx.fillStyle = '#101f1b'; ctx.fillRect(-12, -11, 7, 23); ctx.fillRect(5, -11, 7, 23);
  ctx.fillStyle = '#52635a';
  for (let y = -9; y < 12; y += 5) { const offset = Math.floor(tank.tread / 3) % 2; ctx.fillRect(-11, y + offset, 4, 2); ctx.fillRect(7, y + offset, 4, 2); }
  ctx.fillStyle = color; ctx.fillRect(-7, -9, 14, 19); ctx.fillRect(-9, -5, 18, 11);
  ctx.fillStyle = '#182b26'; ctx.fillRect(-4, -4, 8, 9);
  ctx.fillStyle = color; ctx.fillRect(-3, -14, 6, 14); ctx.fillRect(-5, -2, 10, 6);
  ctx.fillStyle = '#fff1b5'; ctx.fillRect(-5, -7, 3, 3);
  if (tank.type === 'armor' && tank.hp === 2) { ctx.fillStyle = '#f7e9ff'; ctx.fillRect(-5, 7, 10, 2); }
  if (tank.shield > 0) {
    ctx.strokeStyle = tank.team === 'player' ? '#ffe7a0' : '#e9e6d4';
    ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.strokeRect(-15, -16, 30, 32);
  }
  ctx.restore();
}
function drawBattle(ctx, state, reduced) {
  ctx.fillStyle = '#233a31'; ctx.fillRect(0, 0, SIZE, SIZE);
  for (let row = 0; row < GRID; row++) for (let col = 0; col < GRID; col++) {
    const x = col * TILE, y = row * TILE, tile = state.grid[row][col];
    if (tile === '#') {
      ctx.fillStyle = '#bd8061'; ctx.fillRect(x + 1, y + 1, 30, 30);
      ctx.fillStyle = '#e2aa82'; ctx.fillRect(x + 1, y + 1, 30, 3); ctx.fillRect(x + 1, y + 16, 30, 2);
      ctx.fillStyle = '#694d3c'; ctx.fillRect(x + 15, y + 3, 2, 13); ctx.fillRect(x + 6, y + 18, 2, 13); ctx.fillRect(x + 24, y + 18, 2, 13);
    } else if (tile === 'S') {
      ctx.fillStyle = '#a4b4aa'; ctx.fillRect(x + 1, y + 1, 30, 30);
      ctx.fillStyle = '#d1d9ca'; ctx.fillRect(x + 3, y + 3, 26, 3); ctx.fillRect(x + 3, y + 3, 3, 26);
      ctx.fillStyle = '#576d63'; ctx.fillRect(x + 6, y + 26, 23, 3); ctx.fillRect(x + 26, y + 6, 3, 23);
      ctx.fillStyle = '#354d43'; ctx.fillRect(x + 13, y + 13, 6, 6);
    } else if (tile === '~') {
      ctx.fillStyle = '#426d78'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#78a0a3';
      const phase = reduced ? 0 : Math.floor(state.time * 2) % 3;
      for (let line = 0; line < 3; line++) ctx.fillRect(x + 3 + (line + phase) % 3 * 3, y + 6 + line * 9, 16, 2);
    } else {
      ctx.fillStyle = '#2d4538'; ctx.fillRect(x + 7, y + 9, 2, 2); ctx.fillRect(x + 25, y + 24, 2, 2);
    }
  }
  const base = state.base;
  ctx.fillStyle = '#12251f'; ctx.fillRect(base.x - 14, base.y - 14, 28, 28);
  ctx.fillStyle = base.alive ? '#a9c192' : '#695449'; ctx.fillRect(base.x - 11, base.y - 13, 22, 26);
  ctx.fillStyle = '#24382c'; ctx.fillRect(base.x - 7, base.y - 9, 14, 22);
  if (base.alive) {
    ctx.fillStyle = '#efc96a'; ctx.fillRect(base.x - 5, base.y - 7, 10, 20);
    ctx.fillStyle = '#4c5433'; ctx.fillRect(base.x + 1, base.y + 1, 2, 3);
  } else { ctx.fillStyle = '#d09269'; ctx.fillRect(base.x - 6, base.y + 4, 12, 5); }
  if (state.spawn) {
    ctx.strokeStyle = '#ead1a3'; ctx.lineWidth = 2;
    const radius = 12 + Math.floor(state.spawn.life * 4) % 3 * 3;
    ctx.strokeRect(state.spawn.x - radius, state.spawn.y - radius, radius * 2, radius * 2);
  }
  for (const enemy of state.enemies) pixelTank(ctx, enemy);
  if (state.lives > 0) pixelTank(ctx, state.player);
  for (const bullet of state.bullets) {
    ctx.fillStyle = bullet.team === 'player' ? '#fff1bc' : '#f29a73';
    ctx.fillRect(Math.round(bullet.x) - 2, Math.round(bullet.y) - 3, 4, 6);
  }
  for (const particle of state.effects) {
    const amount = 1 - particle.life / particle.total;
    const r = particle.kind === 'blast' ? 5 + amount * 18 : 3 + amount * 6;
    ctx.globalAlpha = 1 - amount * 0.8; ctx.fillStyle = '#ffdb81';
    ctx.fillRect(Math.round(particle.x - r / 2), Math.round(particle.y - r / 2), r, r);
    ctx.fillStyle = '#df7953';
    for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) ctx.fillRect(Math.round(particle.x + dx * r), Math.round(particle.y + dy * r), 3, 3);
    ctx.globalAlpha = 1;
  }
}
const tankArt = '<svg viewBox="0 0 260 150" aria-hidden="true" shape-rendering="crispEdges"><path fill="#233a31" d="M0 0h260v150H0z"/><path fill="#bd8061" d="M16 16h48v32H16zM164 16h32v48h-32zM212 80h32v48h-32zM16 96h64v32H16z"/><path fill="#e0aa80" d="M16 30h48v3H16zM16 110h64v3H16zM164 32h32v3h-32z"/><g transform="translate(116 87)"><path fill="#10271e" d="M-21-22h11v47h-11zM10-22h11v47H10z"/><path fill="#f2cf66" d="M-12-20h24v42h-24zM-5-33h10V0H-5zM-16-9h32v23h-32z"/><path fill="#fff1b5" d="M-9-16h5v7h-5z"/></g><g transform="translate(218 34) rotate(180)"><path fill="#14291f" d="M-14-14h7v30h-7zM7-14h7v30H7z"/><path fill="#dc886b" d="M-9-14H9v29H-9zM-3-23h6V0h-6z"/></g><path fill="#fff1bc" d="M113 31h6v10h-6zM215 82h6v10h-6z"/><path fill="#adbf9a" d="M154 114h24v29h-24z"/><path fill="#efd16f" d="M160 120h12v23h-12z"/></svg>';
export function tankArcadeCard(lang, href) {
  const c = tankCopy(lang);
  return '<section class="home-arcade" data-no-translate><div class="arcade-heading"><div><span class="eyebrow">ODDLAB / RETRO ARCADE</span><h2>' + esc(({zh:'复古街机',en:'A little retro arcade',ja:'小さなレトロゲーム',es:'Un pequeño arcade retro'})[lang] || 'Retro arcade') + '</h2></div><span>' + esc(c.home) + '</span></div><a class="arcade-card" href="' + esc(href) + '"><div class="arcade-card-art">' + tankArt + '</div><div class="arcade-card-copy"><span class="arcade-badge">01 / PIXEL PLAY</span><h3>' + esc(c.title) + '</h3><p>' + esc(c.intro) + '</p><span class="arcade-card-meta">' + esc(c.preview) + '</span><strong>' + esc(c.play) + ' ↗</strong></div></a></section>';
}
export function mountTankGame(root, lang, existing = null) {
  if (existing?.connected()) { existing.setLanguage(lang); return existing; }
  let c = tankCopy(lang), locale = lang;
  let game = createTankGame(), best = 0, storageOK = true, sound = false, audio = null;
  let raf = 0, last = 0, accumulator = 0, overlayState = '', lastHUD = '', lastTone = 0, disposed = false;
  const pressed = new Map(), pointers = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { const value = Number(localStorage.getItem(recordKey)); best = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0; } catch { storageOK = false; }
  const text = key => '<span data-tank-text="' + key + '">' + esc(c[key]) + '</span>';
  const stat = (key, value) => '<div class="tank-stat">' + text(key) + '<strong data-tank-value="' + key + '">' + value + '</strong></div>';
  root.innerHTML = '<div class="tool-wrap tank-game" data-no-translate><a class="back tank-back" href="' + link('/') + '?lang=' + locale + '">' + esc(c.back) + '</a><div class="tank-heading"><div><div class="eyebrow">' + text('arcade') + '</div><h1>' + text('title') + '</h1><p>' + text('intro') + '</p></div><span class="tank-stamp">1P<br>8 BIT</span></div><div class="tank-layout"><section class="tank-cabinet"><div class="tank-marquee"><span>ODDLAB — TANK CLUB</span><span class="tank-power">● READY</span></div><div class="tank-hud">' + stat('score','00000') + stat('best', String(best).padStart(5,'0')) + stat('lives','3') + stat('enemies',game.total) + '</div><div class="tank-screen"><canvas width="' + SIZE + '" height="' + SIZE + '" tabindex="0" aria-label="' + esc(c.field) + '"></canvas><div class="tank-overlay"></div></div><div class="tank-footer"><span data-tank-value="stage">01 / 03</span><span>PROTECT THE LITTLE DOOR</span></div><div class="tank-touch"><div class="tank-dpad">' + ['up','left','down','right'].map(dir=>'<button type="button" data-tank-dir="' + dir + '" aria-label="' + esc(c[dir]) + '">' + arrows[dir] + '</button>').join('') + '</div><button type="button" class="tank-fire" data-tank-fire>' + text('fire') + '</button></div><p class="tank-touch-hint">' + text('touchHint') + '</p></section><aside class="tank-side"><div class="tank-maps"><div class="tank-side-label">' + text('stage') + '</div>' + c.maps.map((name,i)=>'<button type="button" data-tank-map="' + i + '" class="tank-map ' + (i === 0 ? 'selected' : '') + '"><span>0' + (i+1) + '</span><strong>' + esc(name) + '</strong></button>').join('') + '<p class="tank-theme">' + esc(c.themes[0]) + '</p></div><div class="tank-side-actions"><button type="button" class="button dark" data-tank-action="pause">' + esc(c.pause) + '</button><button type="button" class="button light" data-tank-action="restart">' + text('restart') + '</button><button type="button" class="tank-sound" data-tank-action="sound" aria-pressed="false">' + esc(c.soundOff) + '</button></div><p class="tank-keyboard">' + text('keyboard') + '</p><p class="tank-board-hint">' + text('boardHint') + '</p><div class="tank-legend">' + c.legend.map((label,i)=>'<span><i class="tank-swatch swatch-' + i + '"></i><span data-tank-legend="' + i + '">' + esc(label) + '</span></span>').join('') + '</div><p class="tank-storage" ' + (storageOK ? 'hidden' : '') + '>' + text('storage') + '</p></aside></div><p class="sr-only tank-announcement" aria-live="polite" aria-atomic="true"></p></div>';
  const shell = root.querySelector('.tank-game'), canvas = shell.querySelector('canvas'), ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = SIZE * dpr; canvas.height = SIZE * dpr; ctx.scale(dpr,dpr); ctx.imageSmoothingEnabled = false;
  const overlay = shell.querySelector('.tank-overlay');
  const announce = message => { shell.querySelector('.tank-announcement').textContent = message; };
  function clearInput() {
    pressed.clear(); pointers.clear();
    for (const button of shell.querySelectorAll('.holding')) button.classList.remove('holding');
  }
  function tone(kind) {
    if (!sound || !audio || audio.state !== 'running') return;
    const now = audio.currentTime;
    if (now - lastTone < 0.045) return;
    lastTone = now;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    const frequency = ({shot:420,wall:110,hit:180,kill:75,hurt:50,base:40,clear:660})[kind] || 110;
    oscillator.type = 'square'; oscillator.frequency.setValueAtTime(frequency,now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency / 3),now+0.09);
    gain.gain.setValueAtTime(0.035,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.1);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(now); oscillator.stop(now+0.11);
  }
  function saveBest() {
    if (game.score <= best) return;
    best = game.score;
    try { localStorage.setItem(recordKey,String(best)); } catch { storageOK = false; shell.querySelector('.tank-storage').hidden = false; }
  }
  function syncOverlay(force = false) {
    const id = game.status + ':' + game.level + ':' + locale;
    if (!force && id === overlayState) return;
    overlayState = id;
    overlay.hidden = game.status === 'playing';
    shell.dataset.status = game.status;
    shell.querySelector('.tank-power').textContent = ({playing:'● PLAY',paused:'● PAUSE',ready:'● READY',clear:'● CLEAR',lost:'● END'})[game.status];
    const pauseButton = shell.querySelector('[data-tank-action="pause"]');
    pauseButton.textContent = game.status === 'paused' ? c.resume : c.pause;
    pauseButton.disabled = !['playing','paused'].includes(game.status);
    for (const button of shell.querySelectorAll('[data-tank-map]')) {
      button.disabled = game.status === 'playing' || game.status === 'paused';
      button.classList.toggle('selected', Number(button.dataset.tankMap) === game.level);
      button.setAttribute('aria-pressed', String(Number(button.dataset.tankMap) === game.level));
    }
    if (game.status === 'playing') { overlay.innerHTML = ''; return; }
    let title = c.ready, body = c.readyText, action = 'start', label = c.start;
    if (game.status === 'paused') { title=c.paused; body=c.pausedText; action='resume'; label=c.resume; }
    if (game.status === 'clear') {
      title=game.level === 2 ? c.finished : c.clear; body=game.level === 2 ? c.finishText : c.clearText;
      action=game.level === 2 ? 'restart' : 'next'; label=game.level === 2 ? c.restart : c.next;
    }
    if (game.status === 'lost') { title=c.lost; body=game.reason === 'base' ? c.baseLost : c.livesLost; action='restart'; label=c.restart; }
    overlay.innerHTML = '<div class="tank-overlay-card"><span class="tank-overlay-kicker">' + (game.status === 'clear' ? 'STAGE CLEAR' : game.status === 'lost' ? 'GAME OVER' : game.status === 'paused' ? 'PAUSED' : 'INSERT A LITTLE JOY') + '</span><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p><button type="button" class="tank-start" data-tank-action="' + action + '">' + esc(label) + ' →</button></div>';
    if (game.status === 'clear') announce(c.wonAnnounce);
    if (game.status === 'lost') announce(body);
    // Terminal actions are immediately reachable from keyboard without trapping focus.
    if (['lost','clear'].includes(game.status) && document.activeElement === canvas) overlay.querySelector('button').focus({preventScroll:true});
  }
  function syncHUD(force = false) {
    saveBest();
    const id = [game.level,game.score,best,game.lives,game.total-game.kills,locale].join(':');
    if (force || id !== lastHUD) {
      lastHUD=id;
      for (const [key,value] of Object.entries({score:String(game.score).padStart(5,'0'),best:String(best).padStart(5,'0'),lives:game.lives,enemies:game.total-game.kills,stage:'0'+(game.level+1)+' / 03'})) shell.querySelector('[data-tank-value="' + key + '"]').textContent=value;
      shell.querySelector('.tank-theme').textContent=c.themes[game.level];
    }
    syncOverlay(force);
  }
  function frame(timestamp) {
    raf=0;
    if (disposed || !canvas.isConnected) return;
    if (!last) last=timestamp;
    accumulator += Math.min((timestamp-last)/1000,0.08); last=timestamp;
    while (accumulator >= 1/60 && game.status === 'playing') {
      const values=[...pressed.values(),...pointers.values()];
      stepTankGame(game,{dir:values.filter(value=>value!=='fire').at(-1),fire:values.includes('fire')},1/60);
      const event=['base','hurt','clear','kill','hit','shot','wall'].find(kind=>game.events.includes(kind));
      if(event)tone(event);
      accumulator-=1/60;
    }
    drawBattle(ctx,game,reduced); syncHUD();
    if (game.status === 'playing') raf=requestAnimationFrame(frame); else { clearInput(); last=0; accumulator=0; }
  }
  function run() {
    startTankGame(game); last=0; accumulator=0; syncHUD(); canvas.focus({preventScroll:true});
    announce(c.startAnnounce);
    const cabinet=shell.querySelector('.tank-cabinet'),rect=cabinet.getBoundingClientRect();
    if(rect.height<innerHeight-24&&(rect.bottom>innerHeight-12||rect.top<12))cabinet.scrollIntoView({block:'center',behavior:'instant'});
    if(!raf)raf=requestAnimationFrame(frame);
  }
  function pause() {
    if(game.status !== 'playing')return;
    pauseTankGame(game); clearInput(); cancelAnimationFrame(raf); raf=0; last=0; accumulator=0; syncHUD(); announce(c.pauseAnnounce);
  }
  function reset(level=game.level) {
    cancelAnimationFrame(raf); raf=0; last=0; accumulator=0; clearInput();
    game=createTankGame({level,seed:(Date.now()>>>0)}); overlayState=''; syncHUD(); drawBattle(ctx,game,reduced);
  }
  function action(event) {
    const button=event.target.closest('[data-tank-action],[data-tank-map]');
    if(!button||button.disabled)return;
    if(button.hasAttribute('data-tank-map')){reset(Number(button.dataset.tankMap));return;}
    const value=button.dataset.tankAction;
    if(value==='start'||value==='resume')run();
    else if(value==='pause'){if(game.status==='playing')pause();else if(game.status==='paused')run();}
    else if(value==='restart'){reset();run();}
    else if(value==='next'){
      const next=nextTankLevel(game);
      if(next){game=next;clearInput();overlayState='';run();}
    } else if(value==='sound') {
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)return;
      if(!audio)audio=new AudioContext();
      sound=!sound;
      if(sound)audio.resume().catch(()=>{sound=false;setLanguage(locale);});
      button.textContent=sound?c.soundOn:c.soundOff;button.setAttribute('aria-pressed',String(sound));
    }
  }
  function keyDown(event) {
    if(event.target.closest('input,select,textarea,[contenteditable="true"]')||event.altKey||event.metaKey||event.ctrlKey)return;
    if(event.code==='KeyP'||event.code==='Escape'){
      if(game.status==='playing'){event.preventDefault();pause();}
      else if(game.status==='paused'){event.preventDefault();run();}
      return;
    }
    if(game.status!=='playing'||document.activeElement!==canvas)return;
    const value=keys[event.code]||(['Space','KeyJ'].includes(event.code)?'fire':null);
    if(!value)return;
    if(event.target.closest('button,a')&&event.code==='Space')return;
    // The battlefield owns game keys only after the player explicitly starts it.
    event.preventDefault();
    if(!pressed.has(event.code))pressed.set(event.code,value);
  }
  function keyUp(event){pressed.delete(event.code);}
  function pointerDown(event) {
    const button=event.target.closest('[data-tank-dir],[data-tank-fire]');
    if(!button||game.status!=='playing')return;
    event.preventDefault();canvas.focus({preventScroll:true});
    button.setPointerCapture(event.pointerId);button.classList.add('holding');
    pointers.set(event.pointerId,button.dataset.tankDir||'fire');
  }
  function pointerUp(event){
    pointers.delete(event.pointerId);
    event.target.closest('[data-tank-dir],[data-tank-fire]')?.classList.remove('holding');
  }
  function blur(){pause();clearInput();}
  function visibility(){if(document.hidden)blur();}
  function focus(event){if(event.target.closest('#language'))pause();}
  function dispose(){
    disposed=true;cancelAnimationFrame(raf);clearInput();
    window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);
    document.removeEventListener('visibilitychange',visibility);document.removeEventListener('focusin',focus);
    if(audio)audio.close().catch(()=>{});
  }
  function setLanguage(next) {
    locale=next;c=tankCopy(next);
    for(const element of shell.querySelectorAll('[data-tank-text]'))element.textContent=c[element.dataset.tankText];
    shell.querySelector('.tank-back').href=link('/')+'?lang='+locale;shell.querySelector('.tank-back').textContent=c.back;
    for(const button of shell.querySelectorAll('[data-tank-map]'))button.querySelector('strong').textContent=c.maps[Number(button.dataset.tankMap)];
    for(const button of shell.querySelectorAll('[data-tank-dir]'))button.setAttribute('aria-label',c[button.dataset.tankDir]);
    for(const label of shell.querySelectorAll('[data-tank-legend]'))label.textContent=c.legend[Number(label.dataset.tankLegend)];
    const soundButton=shell.querySelector('[data-tank-action="sound"]');
    soundButton.textContent=sound?c.soundOn:c.soundOff;
    canvas.setAttribute('aria-label',c.field);syncHUD(true);
    announce(game.status==='paused'?c.pauseAnnounce:game.status==='lost'?(game.reason==='base'?c.baseLost:c.livesLost):game.status==='clear'?c.wonAnnounce:'');
  }
  shell.addEventListener('click',action);shell.addEventListener('pointerdown',pointerDown);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])shell.addEventListener(type,pointerUp);
  canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}));
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);
  document.addEventListener('visibilitychange',visibility);document.addEventListener('focusin',focus);
  window.addEventListener('pagehide',dispose,{once:true});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  syncHUD();drawBattle(ctx,game,reduced);
  return {connected:()=>!disposed&&canvas.isConnected,setLanguage};
}
