// Dragon Dispatch rules. This module is deterministic and has no browser or time dependencies.
export const LOCATIONS = ['K', 'C', 'T', 'M', 'A'];
export const DRAGONS = ['Ember', 'Gale'];
export const LEVELS = {
  first: {
    id: 'first', turnLimit: 6,
    orders: {
      soup: { weight: 2, source: 'K', readyAt: 0, destination: 'T', deadline: 2, cold: false },
      ice: { weight: 1, source: 'K', readyAt: 0, destination: 'A', deadline: 3, cold: true },
      eggs: { weight: 1, source: 'K', readyAt: 0, destination: 'M', deadline: 4, cold: false },
    },
  },
  return: {
    id: 'return', turnLimit: 8, goals: { eggsBy: 6 },
    orders: {
      soup: { weight: 2, source: 'K', readyAt: 0, destination: 'T', deadline: 2, cold: false },
      ice: { weight: 2, source: 'A', readyAt: 4, destination: 'M', deadline: 6, cold: true },
      eggs: { weight: 2, source: 'M', readyAt: 3, destination: 'K', deadline: 7, cold: false },
    },
  },
  market: {
    id: 'market', turnLimit: 9, startLocations: { Ember: 'M', Gale: 'K' },
    orders: {
      soup: { weight: 2, source: 'T', readyAt: 2, destination: 'M', deadline: 5, cold: false },
      ice: { weight: 2, source: 'A', readyAt: 2, destination: 'K', deadline: 6, cold: true },
      eggs: { weight: 2, source: 'M', readyAt: 3, destination: 'T', deadline: 7, cold: false },
    },
  },
  festival: {
    id: 'festival', turnLimit: 7,
    orders: {
      lantern: { weight: 2, source: 'K', readyAt: 0, destination: 'T', deadline: 3, cold: false },
      cake: { weight: 1, source: 'M', readyAt: 2, destination: 'K', deadline: 6, cold: false },
      cracker: { weight: 1, source: 'A', readyAt: 3, destination: 'K', deadline: 7, cold: false },
    },
  },
  storm: {
    id: 'storm', turnLimit: 8, edgeRules: { ridgeClosed: [4, 5, 6] },
    orders: {
      lamp: { weight: 2, source: 'K', readyAt: 0, destination: 'M', deadline: 4, cold: false },
      blanket: { weight: 1, source: 'T', readyAt: 0, destination: 'K', deadline: 6, cold: false },
      radio: { weight: 1, source: 'A', readyAt: 3, destination: 'K', deadline: 7, cold: false },
    },
  },
};
// Keep the original first-level export available to existing callers.
export const ORDERS = LEVELS.first.orders;
export const EDGES = [
  { id: 'K-C', a: 'K', b: 'C', type: 'road', cost: 1 },
  { id: 'C-T', a: 'C', b: 'T', type: 'ridge', cost: 1 },
  { id: 'C-M', a: 'C', b: 'M', type: 'canal', cost: 1 },
  { id: 'M-A', a: 'M', b: 'A', type: 'tunnel', cost: 1 },
  { id: 'C-A', a: 'C', b: 'A', type: 'air', cost: 1 },
];

const clone = value => structuredClone(value);
export function getDispatchLevel(levelId = 'first') { return Object.hasOwn(LEVELS, levelId) ? LEVELS[levelId] : LEVELS.first; }
export function capacityForDragon(dragon) { return dragon === 'Ember' ? 3 : 2; }

// Random weather drawn each game. `clear` has no effect; `headwind` adds +1 to the sky-road cost;
// `flood` extends the flooded-canal window by one extra turn. `?weather=` pins it for testing.
export const WEATHERS = ['clear', 'headwind', 'flood'];
export function pickDispatchWeather(random = Math.random) { return WEATHERS[Math.floor(random() * WEATHERS.length)]; }

const DEFAULT_EDGE_RULES = { ridgeClosed: [4, 5], canalFlood: [3, 4], airBoost: [2, 3], airBoostCost: 3 };
export function resolveEdgeRules(levelId = 'first', weather = 'clear') {
  const level = getDispatchLevel(levelId);
  const rules = { ...DEFAULT_EDGE_RULES, ...(level.edgeRules || {}) };
  if (weather === 'flood') rules.canalFlood = [...rules.canalFlood, 5];
  return rules;
}
export function airCostFor(levelId = 'first', weather = 'clear', round = 0) {
  const rules = resolveEdgeRules(levelId, weather);
  return (rules.airBoost.includes(round) ? rules.airBoostCost : 1) + (weather === 'headwind' ? 1 : 0);
}

// Win is the base star. Keep the shared ration (+1) and finish before the last turn (+1) for up to three stars.
export function dispatchStars(state) {
  if (!state || state.status !== 'won') return 0;
  const turnLimit = getDispatchLevel(state.levelId).turnLimit;
  return 1 + (state.rationAvailable ? 1 : 0) + (turnLimit - state.turn >= 1 ? 1 : 0);
}
const edgeBetween = (from, to) => EDGES.find(e => (e.a === from && e.b === to) || (e.a === to && e.b === from));
export function cargoWeight(orders, levelId = 'first') {
  const specs = getDispatchLevel(levelId).orders;
  return orders.reduce((sum, id) => sum + (specs[id]?.weight || 0), 0);
}
export const currentLoad = (state, dragon) => cargoWeight(state.held[dragon], state.levelId);
const ownersFor = assignments => Object.fromEntries(DRAGONS.map(d => [d, assignments?.[d] || []]));
const ownerOf = (assignments, id) => DRAGONS.find(d => (assignments?.[d] || []).includes(id)) || null;

export function validateLoadout(assignments, sealedIce = false, levelId = 'first') {
  const level = getDispatchLevel(levelId), orders = level.orders, issues = [];
  const owners = Object.fromEntries(Object.keys(orders).map(id => [id, DRAGONS.filter(d => (assignments?.[d] || []).includes(id))]));
  for (const dragon of DRAGONS) {
    const cargo = assignments?.[dragon] || [];
    for (const id of new Set(cargo.filter(x => !orders[x]))) issues.push({ code: 'unknown_order', dragon, order: id });
    for (const id of new Set(cargo.filter(x => orders[x] && cargo.filter(y => y === x).length > 1))) issues.push({ code: 'duplicate_order', dragon, order: id });
  }
  for (const id of Object.keys(orders)) {
    if (owners[id].length !== 1) issues.push({ code: owners[id].length ? 'duplicate_order' : 'missing_order', order: id });
  }
  for (const dragon of DRAGONS) {
    const assigned = assignments?.[dragon] || [];
    const loadAtStart = assigned.filter(id => orders[id]?.source === 'K' && orders[id]?.readyAt === 0);
    const weight = cargoWeight(loadAtStart, level.id), capacity = capacityForDragon(dragon);
    if (weight > capacity) issues.push({ code: 'over_capacity', dragon, weight, capacity });
  }
  if (owners.ice?.length === 1 && owners.ice[0] === 'Ember' && !sealedIce) issues.push({ code: 'ice_unsealed', dragon: 'Ember', order: 'ice' });
  return { valid: issues.length === 0, issues, owners };
}

export function createDispatchState({ assignments = { Ember: [], Gale: [] }, sealedIce = false, levelId = 'first', level: levelAlias, weather = 'clear' } = {}) {
  const level = getDispatchLevel(levelAlias || levelId), copied = { Ember: [...(assignments.Ember || [])], Gale: [...(assignments.Gale || [])] };
  const validation = validateLoadout(copied, sealedIce, level.id);
  const held = { Ember: [], Gale: [] }, orderStatus = {}, pickedUp = {};
  for (const id of Object.keys(level.orders)) {
    const spec = level.orders[id], owner = ownerOf(copied, id);
    if (spec.source === 'K' && spec.readyAt === 0 && owner) {
      held[owner].push(id); orderStatus[id] = 'aboard'; pickedUp[id] = { dragon: owner, turn: 0, location: 'K' };
    } else orderStatus[id] = 'waiting_pickup';
  }
  return {
    levelId: level.id,
    turn: 0,
    locations: { ...(level.startLocations || { Ember: 'K', Gale: 'K' }) },
    stamina: { Ember: 6, Gale: 5 },
    maxStamina: { Ember: 6, Gale: 5 },
    assignments: copied,
    held,
    sealedIce: Boolean(sealedIce),
    weather: WEATHERS.includes(weather) ? weather : 'clear',
    rationAvailable: true,
    delivered: {}, pickedUp, orderStatus,
    status: validation.valid ? 'playing' : 'setup',
    result: null, logs: [],
  };
}

function actionIssue(state, dragon, action, round = state.turn + 1) {
  const level = getDispatchLevel(state.levelId), orders = level.orders;
  if (!DRAGONS.includes(dragon)) return { code: 'unknown_dragon', dragon };
  if (!action || !['move', 'wait', 'ration'].includes(action.type)) return { code: 'unknown_action', dragon };
  if (state.status === 'setup') return { code: 'loadout_incomplete' };
  if (state.status !== 'playing') return { code: 'game_finished', status: state.status };
  if (round > level.turnLimit) return { code: 'turn_limit', turn: round };
  if (action.type === 'wait') return null;
  if (action.type === 'ration') {
    if (!state.rationAvailable) return { code: 'ration_spent', dragon };
    return null;
  }
  const from = state.locations[dragon], to = action.to;
  if (!LOCATIONS.includes(to)) return { code: 'unknown_location', dragon, to };
  const edge = edgeBetween(from, to);
  if (!edge) return { code: 'not_adjacent', dragon, from, to };
  const rules = resolveEdgeRules(state.levelId, state.weather);
  if (edge.type === 'ridge' && rules.ridgeClosed.includes(round)) return { code: 'ridge_closed', dragon, round, from, to };
  if (edge.type === 'canal' && rules.canalFlood.includes(round) && dragon !== 'Ember') return { code: 'flooded_canal', dragon, round, from, to };
  if (edge.type === 'tunnel' && dragon !== 'Ember') return { code: 'dragon_cannot_tunnel', dragon, from, to };
  if (edge.type === 'air' && dragon !== 'Gale') return { code: 'dragon_cannot_fly', dragon, from, to };
  if (edge.type === 'tunnel' && dragon === 'Ember' && state.held.Ember.includes('ice') && orders.ice?.cold && !state.sealedIce) return { code: 'ice_unsealed', dragon: 'Ember', order: 'ice' };
  const cost = edge.type === 'air' ? airCostFor(state.levelId, state.weather, round) : edge.cost;
  if (state.stamina[dragon] < cost) return { code: 'stamina_short', dragon, need: cost, have: state.stamina[dragon], from, to };
  return null;
}

export function legalActions(state, dragon) {
  if (!state || state.status !== 'playing') return [];
  const actions = [{ type: 'wait' }, { type: 'ration' }, ...LOCATIONS.map(to => ({ type: 'move', to }))];
  return actions.filter(action => !actionIssue(state, dragon, action));
}
export function validateAction(state, dragon, action, round = state.turn + 1) { return actionIssue(state, dragon, action, round); }

function settleAtLocation(state, dragon, round, events, warnings) {
  const orders = getDispatchLevel(state.levelId).orders, location = state.locations[dragon];
  // Delivery frees capacity before any parcel waiting at this stop is considered.
  for (const id of [...state.held[dragon]]) {
    if (orders[id].destination !== location) continue;
    state.held[dragon] = state.held[dragon].filter(x => x !== id);
    state.orderStatus[id] = 'delivered';
    state.delivered[id] = { dragon, turn: round, destination: location };
    events.push({ code: 'order_delivered', dragon, order: id, location, turn: round, deadline: orders[id].deadline });
  }
  for (const id of state.assignments[dragon]) {
    const spec = orders[id];
    if (!spec || state.orderStatus[id] !== 'waiting_pickup' || spec.source !== location || spec.readyAt > round) continue;
    const weight = currentLoad(state, dragon), capacity = capacityForDragon(dragon);
    if (weight + spec.weight > capacity) {
      const warning = { code: 'pickup_over_capacity', dragon, order: id, location, turn: round, currentWeight: weight, parcelWeight: spec.weight, capacity };
      warnings.push(warning); events.push(warning);
      continue;
    }
    state.held[dragon].push(id);
    state.orderStatus[id] = 'aboard';
    state.pickedUp[id] = { dragon, turn: round, location };
    events.push({ code: 'order_picked_up', dragon, order: id, location, turn: round, readyAt: spec.readyAt });
  }
}

function applyActionForDragon(state, dragon, action, round, events, warnings) {
  if (action.type === 'move') {
    const from = state.locations[dragon], to = action.to, edge = edgeBetween(from, to);
    const cost = edge.type === 'air' ? airCostFor(state.levelId, state.weather, round) : edge.cost;
    state.locations[dragon] = to;
    state.stamina[dragon] -= cost;
    events.push({ code: 'dragon_moved', dragon, from, to, cost, remaining: state.stamina[dragon], edge: edge.id, turn: round });
  } else if (action.type === 'ration') {
    state.rationAvailable = false;
    const before = state.stamina[dragon];
    state.stamina[dragon] = Math.min(state.maxStamina[dragon], before + 3);
    events.push({ code: 'ration_used', dragon, from: before, to: state.stamina[dragon], turn: round });
  } else {
    events.push({ code: action.automatic ? 'dragon_auto_waited' : 'dragon_waited', dragon, location: state.locations[dragon], turn: round });
  }
  settleAtLocation(state, dragon, round, events, warnings);
}

// Project one dragon's own queue independently; shared pickup/delivery rules remain the same as a joint turn.
export function projectDragonRoute(state, dragon, actions = []) {
  let current = clone(state);
  const events = [], warnings = [], issues = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i], round = current.turn + i + 1;
    const issue = actionIssue(current, dragon, action, round);
    if (issue) { issues.push({ ...issue, turn: round }); break; }
    applyActionForDragon(current, dragon, action, round, events, warnings);
  }
  return { state: current, events, warnings, issues };
}

export function snapshotDispatchTurn(state, plan) { return { state: clone(state), plan: clone(plan) }; }
export function restoreDispatchTurn(snapshot) {
  if (!snapshot?.state || !snapshot?.plan) throw new TypeError('A dispatch turn snapshot needs state and plan.');
  return { state: clone(snapshot.state), plan: clone(snapshot.plan) };
}

function finishRound(state, round, events) {
  const { orders, turnLimit } = getDispatchLevel(state.levelId);
  for (const id of Object.keys(orders)) {
    if (!state.delivered[id] && round >= orders[id].deadline) {
      state.status = 'lost';
      state.result = { code: 'order_late', order: id, deadline: orders[id].deadline, turn: round };
      events.push({ code: 'order_late', order: id, deadline: orders[id].deadline, turn: round });
      return;
    }
  }
  if (Object.keys(orders).every(id => state.delivered[id]) && DRAGONS.every(d => state.locations[d] === 'K')) {
    state.status = 'won';
    const badge = state.levelId === 'first'
      ? (state.delivered.ice.turn < state.delivered.eggs.turn ? 'ice_dream_early' : 'chorus_on_time')
      : state.levelId + '_complete';
    const stars = dispatchStars(state);
    state.result = { code: 'delivered_and_home', badge, turn: round, stars };
    events.push({ code: 'dispatch_won', badge, turn: round, stars });
    return;
  }
  if (round >= turnLimit) {
    state.status = 'lost';
    state.result = { code: 'not_home', turn: round, locations: { ...state.locations } };
    events.push({ code: 'turn_limit_not_home', turn: round, locations: { ...state.locations } });
  }
}

export function stepDispatch(state, jointAction) {
  if (!state || typeof state !== 'object') throw new TypeError('A dispatch state is required.');
  const actions = jointAction || {}, round = state.turn + 1;
  const missing = DRAGONS.find(dragon => !actions[dragon]);
  if (missing) return { ok: false, state, events: [], warnings: [], issues: [{ code: 'unplanned_action', dragon: missing, turn: round }] };
  const pair = { Ember: actions.Ember, Gale: actions.Gale };
  const issues = DRAGONS.map(dragon => actionIssue(state, dragon, pair[dragon], round)).filter(Boolean);
  if (pair.Ember.type === 'ration' && pair.Gale.type === 'ration') issues.push({ code: 'ration_contested', turn: round });
  if (issues.length) return { ok: false, state, events: [], warnings: [], issues };
  const next = clone(state), events = [], warnings = [];
  next.turn = round;
  for (const dragon of DRAGONS) applyActionForDragon(next, dragon, pair[dragon], round, events, warnings);
  finishRound(next, round, events);
  next.logs.push(...events);
  return { ok: true, state: next, events, warnings, issues: [] };
}

function dragonHasFinishedResponsibilities(state, dragon) {
  return state.assignments[dragon].every(id => state.orderStatus[id] === 'delivered');
}
export function simulatePlan(state, plan, { stopOnFailure = true } = {}) {
  let current = clone(state);
  const events = [], warnings = [], timeline = [], issues = [];
  const turnLimit = getDispatchLevel(current.levelId).turnLimit;
  const max = Math.min(turnLimit - current.turn, Math.max(plan?.Ember?.length || 0, plan?.Gale?.length || 0));
  for (let i = 0; i < max && current.status === 'playing'; i++) {
    const before = current;
    const joint = { Ember: plan.Ember?.[i] || null, Gale: plan.Gale?.[i] || null };
    for (const dragon of DRAGONS) {
      if (!joint[dragon] && current.locations[dragon] === 'K' && dragonHasFinishedResponsibilities(current, dragon)) joint[dragon] = { type: 'wait', automatic: true };
    }
    const missing = DRAGONS.find(dragon => !joint[dragon]);
    if (missing) {
      issues.push({ code: 'unplanned_action', dragon: missing, turn: current.turn + 1 });
      break;
    }
    const result = stepDispatch(current, joint);
    if (!result.ok) {
      issues.push({ ...result.issues[0], turn: current.turn + 1 });
      if (stopOnFailure) break;
      current = clone(before);
      break;
    }
    current = result.state;
    events.push(...result.events); warnings.push(...result.warnings);
    timeline.push({ turn: current.turn, actions: clone(joint), stamina: { ...current.stamina }, locations: { ...current.locations }, delivered: { ...current.delivered }, pickedUp: { ...current.pickedUp }, held: clone(current.held), orderStatus: { ...current.orderStatus }, warnings: clone(result.warnings), status: current.status, result: current.result });
  }
  return { state: current, events, warnings, timeline, issues, evaluation: evaluateDispatch(current) };
}

export function evaluateDispatch(state) {
  const level = getDispatchLevel(state.levelId), orders = level.orders;
  const loadout = validateLoadout(state.assignments, state.sealedIce, level.id);
  const deliveries = Object.fromEntries(Object.keys(orders).map(id => [id, state.delivered[id] || null]));
  if (state.status === 'setup') return { status: 'setup', loadout, deliveries, result: null };
  const delivered = Object.keys(orders).every(id => Boolean(state.delivered[id]));
  const deadlinesMet = Object.keys(orders).every(id => state.delivered[id] && state.delivered[id].turn <= orders[id].deadline);
  const home = DRAGONS.every(d => state.locations[d] === 'K');
  return { status: state.status, loadout, deliveries, allDelivered: delivered, deadlinesMet, home, result: state.result };
}
