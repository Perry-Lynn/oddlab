// Deterministic simulation: browser rendering and audio never advance the rules.
export const TILE = 32;
export const GRID = 13;
export const SIZE = TILE * GRID;
export const DIRECTIONS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
export const ENEMY_TYPES = {
  scout: { speed: 58, hp: 1, points: 100, cooldown: 1.65 },
  runner: { speed: 84, hp: 1, points: 200, cooldown: 1.9 },
  armor: { speed: 43, hp: 2, points: 300, cooldown: 1.35 },
};
export const TANK_MAPS = [
  [
    '.............',
    '.##..###..##.',
    '.##.......##.',
    '.....#.#.....',
    '.SS..#.#..SS.',
    '.............',
    '###..###..###',
    '.............',
    '..##.....##..',
    '..##.###.##..',
    '.............',
    '.....###.....',
    '.....#.#.....',
  ],
  [
    '.............',
    '.##..###..##.',
    '.....~.~.....',
    '.##..~.~..##.',
    '.##.......##.',
    '...~~...~~...',
    '.............',
    '.SS..###..SS.',
    '.....~.~.....',
    '.##..~.~..##.',
    '.##.......##.',
    '.....###.....',
    '.....#.#.....',
  ],
  [
    '.............',
    '..S..###..S..',
    '..S.......S..',
    '..S..S.S..S..',
    '.............',
    '###..###..###',
    '.....S.S.....',
    '.SS.......SS.',
    '.....###.....',
    '.##..#.#..##.',
    '.............',
    '.....###.....',
    '.....#.#.....',
  ],
];
export const WAVES = [12, 16, 20];
const center = n => n * TILE + TILE / 2;
const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const overlaps = (a, b, size = 22) => Math.abs(a.x - b.x) < size && Math.abs(a.y - b.y) < size;
function random(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}
function effect(state, x, y, kind) {
  state.effects.push({ x, y, kind, life: kind === 'blast' ? 0.36 : 0.16, total: kind === 'blast' ? 0.36 : 0.16 });
}
function player() {
  return { id: 'player', team: 'player', x: center(4), y: center(12), dir: 'up', speed: 106, hp: 1, cooldown: 0, shield: 2, tread: 0 };
}
export function createTankGame({ level = 0, seed = 1024, score = 0, lives = 3 } = {}) {
  const index = Number.isInteger(level) && level >= 0 && level < TANK_MAPS.length ? level : 0;
  return {
    level: index, seed: seed >>> 0, grid: TANK_MAPS[index].map(row => [...row]),
    status: 'ready', reason: null, player: player(), enemies: [], bullets: [], effects: [],
    base: { x: center(6), y: center(12), alive: true },
    score, lives, kills: 0, spawned: 0, total: WAVES[index], time: 0,
    spawnTimer: 0.35, spawn: null, nextId: 1, events: [],
  };
}
export function startTankGame(state) {
  if (state.status === 'ready' || state.status === 'paused') state.status = 'playing';
  return state;
}
export function pauseTankGame(state) {
  if (state.status === 'playing') state.status = 'paused';
  return state;
}
export function nextTankLevel(state) {
  if (state.status !== 'clear' || state.level >= TANK_MAPS.length - 1) return null;
  return createTankGame({ level: state.level + 1, seed: state.seed, score: state.score, lives: state.lives });
}
export function canTankOccupy(state, tank, x, y) {
  const radius = 10.5;
  if (x - radius < 0 || y - radius < 0 || x + radius > SIZE || y + radius > SIZE) return false;
  for (let row = Math.floor((y - radius) / TILE); row <= Math.floor((y + radius) / TILE); row++) {
    for (let col = Math.floor((x - radius) / TILE); col <= Math.floor((x + radius) / TILE); col++) {
      if (['#', 'S', '~'].includes(state.grid[row]?.[col])) return false;
    }
  }
  if (state.base.alive && overlaps({ x, y }, state.base, 25)) return false;
  const others = tank.team === 'player' ? state.enemies : [state.player, ...state.enemies];
  return !others.some(other => other !== tank && other.hp > 0 && overlaps({ x, y }, other));
}
function moveTank(state, tank, dir, dt) {
  const vector = DIRECTIONS[dir];
  if (!vector) return false;
  if (dir !== tank.dir && opposite[dir] !== tank.dir) {
    const axis = vector[0] ? 'y' : 'x';
    const snapped = Math.round((tank[axis] - TILE / 2) / TILE) * TILE + TILE / 2;
    const x = axis === 'x' ? snapped : tank.x;
    const y = axis === 'y' ? snapped : tank.y;
    if (Math.abs(snapped - tank[axis]) <= TILE / 2 && canTankOccupy(state, tank, x, y)) tank[axis] = snapped;
  }
  tank.dir = dir;
  const steps = Math.max(1, Math.ceil(tank.speed * dt / 2));
  let moved = false;
  for (let i = 0; i < steps; i++) {
    const x = tank.x + vector[0] * tank.speed * dt / steps;
    const y = tank.y + vector[1] * tank.speed * dt / steps;
    if (!canTankOccupy(state, tank, x, y)) break;
    tank.x = x; tank.y = y; tank.tread += tank.speed * dt / steps; moved = true;
  }
  return moved;
}
export function fireTank(state, tank) {
  if (state.status !== 'playing' || tank.cooldown > 0 || tank.hp <= 0) return false;
  const limit = tank.team === 'player' ? 2 : 1;
  if (state.bullets.filter(bullet => bullet.owner === tank.id).length >= limit) return false;
  const [dx, dy] = DIRECTIONS[tank.dir];
  // Spawn inside the tank, then sweep through the muzzle so adjacent walls still collide.
  state.bullets.push({ id: state.nextId++, owner: tank.id, team: tank.team, x: tank.x, y: tank.y, dx, dy, speed: tank.team === 'player' ? 330 : 190, alive: true });
  tank.cooldown = tank.team === 'player' ? 0.24 : ENEMY_TYPES[tank.type].cooldown + random(state) * 0.6;
  if (tank.team === 'player') state.events.push('shot');
  return true;
}
function hurtPlayer(state) {
  if (state.player.shield > 0) return;
  effect(state, state.player.x, state.player.y, 'blast');
  state.events.push('hurt');
  state.lives--;
  if (state.lives <= 0) { state.status = 'lost'; state.reason = 'lives'; return; }
  state.player = player();
  const candidates = [4, 8, 3, 9, 2, 10, 1, 11, 0, 12];
  for (const col of candidates) {
    const x = center(col), y = center(12);
    if (canTankOccupy(state, state.player, x, y)) { state.player.x = x; state.player.y = y; break; }
  }
  // A respawn shield protects the player, while old hostile shots are removed.
  for (const bullet of state.bullets) if (bullet.team === 'enemy') bullet.alive = false;
}
function moveBullets(state, dt) {
  const steps = Math.max(1, Math.ceil(330 * dt / 2));
  for (let step = 0; step < steps; step++) {
    for (const bullet of state.bullets) {
      if (!bullet.alive) continue;
      bullet.x += bullet.dx * bullet.speed * dt / steps;
      bullet.y += bullet.dy * bullet.speed * dt / steps;
      if (bullet.x < 0 || bullet.y < 0 || bullet.x >= SIZE || bullet.y >= SIZE) { bullet.alive = false; continue; }
      const row = Math.floor(bullet.y / TILE), col = Math.floor(bullet.x / TILE);
      const tile = state.grid[row][col];
      if (tile === '#' || tile === 'S') {
        bullet.alive = false;
        if (tile === '#') state.grid[row][col] = '.';
        effect(state, bullet.x, bullet.y, 'spark');
        state.events.push('wall');
        continue;
      }
      const counter = state.bullets.find(other => other !== bullet && other.alive && other.team !== bullet.team && distance(bullet, other) < 7);
      if (counter) { bullet.alive = false; counter.alive = false; effect(state, bullet.x, bullet.y, 'spark'); continue; }
      if (state.base.alive && overlaps(bullet, state.base, 13)) {
        bullet.alive = false;
        if (bullet.team === 'enemy') {
          state.base.alive = false; state.status = 'lost'; state.reason = 'base';
          effect(state, state.base.x, state.base.y, 'blast'); state.events.push('base');
        }
        continue;
      }
      if (bullet.team === 'enemy') {
        if (overlaps(bullet, state.player, 12)) { bullet.alive = false; hurtPlayer(state); }
      } else {
        const enemy = state.enemies.find(tank => tank.hp > 0 && overlaps(bullet, tank, 12));
        if (enemy) {
          bullet.alive = false;
          if (enemy.shield > 0) continue;
          enemy.hp--;
          effect(state, enemy.x, enemy.y, enemy.hp > 0 ? 'spark' : 'blast');
          state.events.push(enemy.hp > 0 ? 'hit' : 'kill');
          if (enemy.hp === 0) { state.score += ENEMY_TYPES[enemy.type].points; state.kills++; }
        }
      }
      if (state.status === 'lost') return;
    }
  }
}
function spawnEnemies(state, dt) {
  if (state.spawn) {
    state.spawn.life -= dt;
    if (state.spawn.life <= 0) {
      const spawn = state.spawn;
      if (![state.player, ...state.enemies].some(tank => overlaps(tank, spawn, 30))) {
        const type = spawn.type;
        state.enemies.push({ id: state.nextId++, team: 'enemy', type, x: spawn.x, y: spawn.y, dir: 'down', hp: ENEMY_TYPES[type].hp, speed: ENEMY_TYPES[type].speed, cooldown: 1.2, shield: 0.6, turnTimer: 0.5, tread: 0 });
        state.spawned++; state.spawnTimer = Math.max(1.15, 2.1 - state.level * 0.25);
      } else state.spawnTimer = 0.4;
      state.spawn = null;
    }
  } else if (state.spawned < state.total && state.enemies.length < 4) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const col = [0, 6, 12][Math.floor(random(state) * 3)];
      const roll = random(state);
      const type = roll < 0.22 + state.level * 0.05 ? 'armor' : roll < 0.5 ? 'runner' : 'scout';
      state.spawn = { x: center(col), y: center(0), type, life: 0.9 };
    }
  }
}
function enemyTurn(state, enemy) {
  const choices = ['down', 'down', 'down', enemy.x < state.base.x ? 'right' : 'left', enemy.dir, 'up', 'left', 'right'];
  enemy.dir = choices[Math.floor(random(state) * choices.length)];
  enemy.turnTimer = 0.4 + random(state) * 0.9;
}
export function stepTankGame(state, input = {}, dt = 1 / 60) {
  state.events = [];
  if (state.status !== 'playing') return state;
  const elapsed = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
  if (!elapsed) return state;
  state.time += elapsed;
  for (const tank of [state.player, ...state.enemies]) {
    tank.cooldown = Math.max(0, tank.cooldown - elapsed);
    tank.shield = Math.max(0, tank.shield - elapsed);
  }
  if (input.dir) moveTank(state, state.player, input.dir, elapsed);
  if (input.fire) fireTank(state, state.player);
  spawnEnemies(state, elapsed);
  for (const enemy of state.enemies) {
    enemy.turnTimer -= elapsed;
    if (enemy.turnTimer <= 0) enemyTurn(state, enemy);
    if (!moveTank(state, enemy, enemy.dir, elapsed)) {
      // Shoot the obstruction before turning; bricks can open new routes.
      fireTank(state, enemy);
      if (enemy.turnTimer > 0.12) enemy.turnTimer = 0.12;
    } else fireTank(state, enemy);
  }
  moveBullets(state, elapsed);
  state.bullets = state.bullets.filter(bullet => bullet.alive);
  state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
  for (const spark of state.effects) spark.life -= elapsed;
  state.effects = state.effects.filter(spark => spark.life > 0);
  if (state.status === 'playing' && state.spawned === state.total && state.enemies.length === 0) {
    state.status = 'clear'; state.events.push('clear');
    // A defeated enemy's final shell remains dangerous until the round ends.
    state.bullets = []; state.spawn = null;
  }
  return state;
}
