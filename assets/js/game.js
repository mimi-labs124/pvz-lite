import { rows, cols, LEVELS, PLANTS, ZOMBIES } from './config.js';
import { ensureAudio, sfx, audioState } from './audio.js';
import { boardEl, shopEl, mobileShopEl, sunEl, killsEl, waveEl, mowerEl, levelSelect, overlayEl, endTitleEl, endTextEl, sfxValueEl } from './dom.js';

let state;
let loopId;
let lastTime = 0;

function cellKey(r, c) { return `${r}-${c}`; }
function getCellEl(r, c) { return boardEl.children[r]?.children[c]; }
function flash(el) { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 320 }); }

function freshState() {
  const level = LEVELS[levelSelect.value];
  return {
    levelKey: levelSelect.value,
    sun: level.sunStart,
    kills: 0,
    wave: 1,
    selectedPlant: 'peashooter',
    plants: new Map(),
    zombies: [],
    peas: [],
    suns: [],
    booms: [],
    lawnmowers: Array.from({ length: rows }, (_, row) => ({ row, x: -0.25, active: false, used: false })),
    spawnTimer: 0,
    sunTimer: 0,
    gameOver: false,
    nextZombieId: 1,
    nextSunId: 1,
    cooldowns: Object.fromEntries(Object.keys(PLANTS).map(k => [k, 0])),
  };
}

function buildShop() {
  const html = Object.entries(PLANTS).map(([k, p]) => `<div class="card" data-plant="${k}"><div class="row"><strong>${p.emoji} ${p.name}</strong><span>${p.cost} ☀️</span></div><div class="muted">${p.desc}</div><div class="cooldown"></div><div class="cooltxt"></div></div>`).join('');
  shopEl.innerHTML = html;
  mobileShopEl.innerHTML = html;
  [...document.querySelectorAll('.card')].forEach(c => c.addEventListener('click', () => { ensureAudio(); selectPlant(c.dataset.plant); }));
}

function selectPlant(name) {
  state.selectedPlant = name;
  [...document.querySelectorAll('.card')].forEach(c => c.classList.toggle('selected', c.dataset.plant === name));
}

function syncStats() {
  sunEl.textContent = state.sun;
  killsEl.textContent = state.kills;
  waveEl.textContent = state.wave;
  mowerEl.textContent = state.lawnmowers.filter(m => !m.used).length;
}

function updateShop() {
  [...document.querySelectorAll('.card')].forEach(c => {
    const k = c.dataset.plant;
    const p = PLANTS[k];
    const cd = state.cooldowns[k];
    const disabled = state.sun < p.cost || cd > 0;
    c.classList.toggle('disabled', disabled);
    const ov = c.querySelector('.cooldown');
    const txt = c.querySelector('.cooltxt');
    if (cd > 0) {
      ov.style.transform = `scaleY(${Math.min(1, cd / p.cooldown)})`;
      txt.textContent = `${cd.toFixed(1)}s`;
    } else {
      ov.style.transform = 'scaleY(0)';
      txt.textContent = '';
    }
  });
}

function makeBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    const lane = document.createElement('div');
    lane.className = 'lane';
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.innerHTML = `<div class="coord">${r + 1}-${c + 1}</div>`;
      cell.addEventListener('click', () => { ensureAudio(); placePlant(r, c); });
      lane.appendChild(cell);
    }
    boardEl.appendChild(lane);
  }
}

function placePlant(r, c) {
  if (state.gameOver) return;
  const key = cellKey(r, c);
  const type = state.selectedPlant;
  const def = PLANTS[type];
  if (state.plants.has(key)) return;
  if (state.cooldowns[type] > 0) return flash(shopEl);
  if (state.sun < def.cost) return flash(sunEl);
  state.sun -= def.cost;
  state.cooldowns[type] = def.cooldown;
  state.plants.set(key, { type, row: r, col: c, hp: def.hp, maxHp: def.hp, attackTimer: 0, sunTimer: 0, explodeTimer: 0.8 });
  syncStats();
  updateShop();
  sfx(type === 'bomb' ? 'boom' : 'plant');
  render();
}

function addSun(x, y, val = 25, fall = 0.6) {
  state.suns.push({ id: state.nextSunId++, x, y, targetY: y + Math.random() * 40 + 10, value: val, life: 10, fall });
}

function collectSun(id) {
  const i = state.suns.findIndex(s => s.id === id);
  if (i === -1) return;
  state.sun += state.suns[i].value;
  state.suns.splice(i, 1);
  syncStats();
  updateShop();
  sfx('sun');
  render();
}

function zombieKindForWave(w) {
  const pool = ['normal'];
  if (w >= 2) pool.push('cone');
  if (w >= 3) pool.push('paper');
  if (w >= 4) pool.push('fast');
  if (w >= 6) pool.push('bucket');
  if (w >= 9) pool.push('giant');
  return pool[Math.floor(Math.random() * pool.length)];
}

function spawnZombie() {
  const level = LEVELS[state.levelKey];
  const row = Math.floor(Math.random() * rows);
  const kind = zombieKindForWave(state.wave);
  const base = ZOMBIES[kind];
  const hpScale = (1 + (state.wave - 1) * 0.14) * level.hpScale;
  state.zombies.push({ id: state.nextZombieId++, kind, row, x: cols - 0.1, hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale), speed: base.speed * level.speedScale, biteTimer: 0, slowTimer: 0, angry: false });
}

function triggerBomb(p) {
  sfx('boom');
  state.booms.push({ row: p.row, col: p.col, life: 0.22 });
  state.zombies.forEach(z => { if (Math.abs(z.row - p.row) <= 1 && Math.abs(z.x - p.col) <= 1.35) z.hp -= 230; });
  state.plants.delete(cellKey(p.row, p.col));
}

function updatePlants(dt) {
  for (const p of [...state.plants.values()]) {
    if (p.type === 'sunflower') {
      p.sunTimer += dt;
      if (p.sunTimer >= 6.2) { p.sunTimer = 0; addSun(p.col * 95 + 18, p.row * 100 + 10, 25, 0.45); }
    }
    if (['peashooter', 'repeater', 'icepea'].includes(p.type)) {
      const has = state.zombies.some(z => z.row === p.row && z.x >= p.col - 0.1);
      p.attackTimer += dt;
      const rate = p.type === 'repeater' ? 0.9 : 1.1;
      if (has && p.attackTimer >= rate) {
        p.attackTimer = 0;
        const shots = p.type === 'repeater' ? 2 : 1;
        for (let i = 0; i < shots; i++) state.peas.push({ row: p.row, x: p.col + 0.72 - i * 0.12, damage: p.type === 'icepea' ? 18 : 20, speed: 4.8, ice: p.type === 'icepea' });
        sfx(p.type === 'icepea' ? 'ice' : 'pea');
      }
    }
    if (p.type === 'bomb') {
      p.explodeTimer -= dt;
      if (p.explodeTimer <= 0) triggerBomb(p);
    }
  }
}

function updatePeas(dt) {
  state.peas.forEach(p => p.x += p.speed * dt);
  state.peas = state.peas.filter(p => p.x < cols + 0.4);
  for (const pea of state.peas) {
    const hit = state.zombies.find(z => z.row === pea.row && Math.abs(z.x - pea.x) < 0.28);
    if (hit) {
      hit.hp -= pea.damage;
      if (pea.ice) hit.slowTimer = 2.8;
      pea.x = 999;
      sfx('hit');
    }
  }
  state.peas = state.peas.filter(p => p.x < cols + 1);
}

function updateZombies(dt) {
  for (const z of state.zombies) {
    if (z.kind === 'paper' && !z.angry && z.hp < z.maxHp * 0.45) { z.angry = true; z.speed *= 1.9; }
    if (z.slowTimer > 0) z.slowTimer -= dt;
    const eff = z.speed * (z.slowTimer > 0 ? 0.5 : 1);
    const col = Math.floor(z.x);
    const key = cellKey(z.row, Math.max(0, col));
    const plant = state.plants.get(key);
    const mower = state.lawnmowers[z.row];
    if (!mower.used && !mower.active && z.x <= 0.35) { mower.active = true; sfx('mower'); }
    if (mower.active) continue;
    if (plant && z.x < plant.col + 0.95) {
      z.biteTimer += dt;
      if (z.biteTimer >= 0.7) {
        z.biteTimer = 0;
        plant.hp -= ZOMBIES[z.kind].bite;
        if (plant.hp <= 0) state.plants.delete(key);
      }
    } else {
      z.x -= eff * dt;
    }
    if (z.x <= -0.2 && mower.used) { gameEnd(false); break; }
  }
}

function updateMowers(dt) {
  for (const m of state.lawnmowers) {
    if (!m.active) continue;
    m.x += 4.8 * dt;
    state.zombies.forEach(z => { if (z.row === m.row && z.x <= m.x + 0.55 && z.x >= m.x - 0.2) z.hp = -999; });
    if (m.x > cols + 0.6) { m.active = false; m.used = true; }
  }
}

function cleanup(dt) {
  for (const k of Object.keys(state.cooldowns)) state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);
  const before = state.zombies.length;
  state.zombies = state.zombies.filter(z => z.hp > 0);
  const killed = before - state.zombies.length;
  if (killed > 0) {
    state.kills += killed;
    state.sun += killed * 12;
    syncStats();
    updateShop();
  }
  state.suns.forEach(s => { if (s.y < s.targetY) s.y += s.fall; s.life -= dt; });
  state.suns = state.suns.filter(s => s.life > 0);
  state.booms.forEach(b => b.life -= dt);
  state.booms = state.booms.filter(b => b.life > 0);
}

function update(dt) {
  if (state.gameOver) return;
  const level = LEVELS[state.levelKey];
  state.wave = 1 + Math.floor(state.kills / 10);
  state.spawnTimer += dt;
  state.sunTimer += dt;
  const spawnEvery = Math.max(level.spawnBase - state.wave * 0.18, level.spawnMin);
  if (state.spawnTimer >= spawnEvery) {
    state.spawnTimer = 0;
    const burst = state.wave >= level.spawnBurstWave ? 2 : 1;
    for (let i = 0; i < burst; i++) spawnZombie();
  }
  if (state.sunTimer >= level.sunDrop) {
    state.sunTimer = 0;
    const speed = state.levelKey === 'easy' ? 0.35 : state.levelKey === 'hard' ? 0.85 : state.levelKey === 'survival' ? 1.05 : 0.6;
    addSun(Math.random() * (cols * 90 - 50) + 20, 10, 25, speed);
  }
  updatePlants(dt);
  updatePeas(dt);
  updateZombies(dt);
  updateMowers(dt);
  cleanup(dt);
  updateShop();
  if (state.kills >= level.winKills) gameEnd(true);
}

function render() {
  boardEl.querySelectorAll('.plant,.zombie,.pea,.sun,.mower,.boom').forEach(e => e.remove());
  for (const p of state.plants.values()) {
    const cell = getCellEl(p.row, p.col);
    if (!cell) continue;
    const el = document.createElement('div');
    el.className = `plant ${p.type}`;
    el.innerHTML = `${PLANTS[p.type].emoji}<div class="hp"><i style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></i></div>`;
    cell.appendChild(el);
  }
  for (const z of state.zombies) {
    const el = document.createElement('div');
    el.className = `zombie ${ZOMBIES[z.kind].className}${z.angry ? ' angry' : ''}`;
    el.style.left = `${z.x * 95 + 4}px`;
    el.style.top = `${z.row * 100 + (z.kind === 'giant' ? 2 : 10)}px`;
    el.innerHTML = `${ZOMBIES[z.kind].emoji}<div class="hp"><i style="width:${Math.max(0, z.hp / z.maxHp * 100)}%"></i></div>`;
    if (z.slowTimer > 0) el.style.outline = '2px solid rgba(56,189,248,.55)';
    boardEl.appendChild(el);
  }
  for (const p of state.peas) {
    const el = document.createElement('div');
    el.className = `pea${p.ice ? ' ice' : ''}`;
    el.style.left = `${p.x * 95 + 20}px`;
    el.style.top = `${p.row * 100 + 10}px`;
    boardEl.appendChild(el);
  }
  for (const s of state.suns) {
    const el = document.createElement('div');
    el.className = 'sun';
    el.textContent = '☀';
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    el.dataset.sunId = s.id;
    boardEl.appendChild(el);
  }
  for (const m of state.lawnmowers) {
    if (m.used && !m.active) continue;
    const el = document.createElement('div');
    el.className = 'mower';
    el.textContent = '🚜';
    el.style.left = `${m.x * 95 + 2}px`;
    el.style.top = `${m.row * 100 + 28}px`;
    boardEl.appendChild(el);
  }
  for (const b of state.booms) {
    const el = document.createElement('div');
    el.className = 'boom';
    el.style.left = `${b.col * 95 - 34}px`;
    el.style.top = `${b.row * 100 - 6}px`;
    el.style.width = '220px';
    el.style.height = '220px';
    boardEl.appendChild(el);
  }
}

function gameEnd(win) {
  state.gameOver = true;
  overlayEl.classList.add('show');
  endTitleEl.textContent = win ? '你贏了！' : '殭屍進家門了';
  endTextEl.textContent = win ? `通關 ${levelSelect.options[levelSelect.selectedIndex].text}，擊殺 ${state.kills} 隻，打到第 ${state.wave} 波。` : `你撐到第 ${state.wave} 波，擊殺 ${state.kills} 隻。`;
  sfx(win ? 'win' : 'lose');
}

function frame(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.033);
  lastTime = ts;
  update(dt);
  render();
  loopId = requestAnimationFrame(frame);
}

export function startGame() {
  cancelAnimationFrame(loopId);
  state = freshState();
  lastTime = 0;
  makeBoard();
  buildShop();
  syncStats();
  selectPlant('peashooter');
  overlayEl.classList.remove('show');
  updateShop();
  render();
  loopId = requestAnimationFrame(frame);
}

export function bindGameEvents() {
  boardEl.addEventListener('pointerdown', e => {
    const t = e.target.closest('.sun');
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      collectSun(Number(t.dataset.sunId));
    }
  });
}

export function bindAudioUi() {
  sfxValueEl.textContent = `${Math.round(audioState.sfxVolume * 100)}%`;
}
