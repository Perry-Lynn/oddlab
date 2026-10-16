// Dragon Dispatch rules. This module is deterministic and has no browser or time dependencies.
export const LOCATIONS = ['K', 'C', 'T', 'M', 'A'];
export const DRAGONS = ['Ember', 'Gale'];
export const ORDERS = {
  soup: { weight: 2, destination: 'T', deadline: 2 },
  ice: { weight: 1, destination: 'A', deadline: 3 },
  eggs: { weight: 1, destination: 'M', deadline: 4 },
};
export const EDGES = [
  { id: 'K-C', a: 'K', b: 'C', type: 'road', cost: 1 },
  { id: 'C-T', a: 'C', b: 'T', type: 'ridge', cost: 1 },
  { id: 'C-M', a: 'C', b: 'M', type: 'canal', cost: 1 },
  { id: 'M-A', a: 'M', b: 'A', type: 'tunnel', cost: 1 },
  { id: 'C-A', a: 'C', b: 'A', type: 'air', cost: 1 },
];

const clone = value => structuredClone(value);
const edgeBetween = (from, to) => EDGES.find(e => (e.a === from && e.b === to) || (e.a === to && e.b === from));
const cargoWeight = orders => orders.reduce((sum, id) => sum + (ORDERS[id]?.weight || 0), 0);

export function validateLoadout(assignments, sealedIce = false) {
  const issues = [];
  const owners = Object.fromEntries(Object.keys(ORDERS).map(id => [id, DRAGONS.filter(d => (assignments?.[d] || []).includes(id))]));
  for (const dragon of DRAGONS) {
    const cargo = assignments?.[dragon] || [];
    for (const id of new Set(cargo.filter(x => !ORDERS[x]))) issues.push({ code: 'unknown_order', dragon, order: id });
    for (const id of new Set(cargo.filter(x => ORDERS[x] && cargo.filter(y => y === x).length > 1))) issues.push({ code: 'duplicate_order', dragon, order: id });
  }
  for (const id of Object.keys(ORDERS)) {
    if (owners[id].length !== 1) issues.push({ code: owners[id].length ? 'duplicate_order' : 'missing_order', order: id });
  }
  for (const dragon of DRAGONS) {
    const cargo = assignments?.[dragon] || [];
    const capacity = dragon === 'Ember' ? 3 : 2;
    if (cargoWeight(cargo) > capacity) issues.push({ code: 'over_capacity', dragon, weight: cargoWeight(cargo), capacity });
  }
  if (owners.ice.length === 1 && owners.ice[0] === 'Ember' && !sealedIce) issues.push({ code: 'ice_unsealed', dragon: 'Ember', order: 'ice' });
  return { valid: issues.length === 0, issues, owners };
}

export function createDispatchState({ assignments = { Ember: [], Gale: [] }, sealedIce = false } = {}) {
  const copied = { Ember: [...(assignments.Ember || [])], Gale: [...(assignments.Gale || [])] };
  const validation = validateLoadout(copied, sealedIce);
  return {
    turn: 0,
    locations: { Ember: 'K', Gale: 'K' },
    stamina: { Ember: 6, Gale: 5 },
    maxStamina: { Ember: 6, Gale: 5 },
    assignments: copied,
    held: { Ember: [...copied.Ember], Gale: [...copied.Gale] },
    sealedIce: Boolean(sealedIce),
    rationAvailable: true,
    delivered: {},
    orderStatus: Object.fromEntries(Object.keys(ORDERS).map(id => [id, 'aboard'])),
    status: validation.valid ? 'playing' : 'setup',
    result: null,
    logs: [],
  };
}

function actionIssue(state, dragon, action, round = state.turn + 1) {
  if (!DRAGONS.includes(dragon)) return { code: 'unknown_dragon', dragon };
  if (!action || !['move', 'wait', 'ration'].includes(action.type)) return { code: 'unknown_action', dragon };
  if (state.status === 'setup') return { code: 'loadout_incomplete' };
  if (state.status !== 'playing') return { code: 'game_finished', status: state.status };
  if (round > 6) return { code: 'turn_limit', turn: round };
  if (action.type === 'wait') return null;
  if (action.type === 'ration') {
    if (!state.rationAvailable) return { code: 'ration_spent', dragon };
    return null;
  }
  const from = state.locations[dragon], to = action.to;
  if (!LOCATIONS.includes(to)) return { code: 'unknown_location', dragon, to };
  const edge = edgeBetween(from, to);
  if (!edge) return { code: 'not_adjacent', dragon, from, to };
  if (edge.type === 'ridge' && [4, 5].includes(round)) return { code: 'ridge_closed', dragon, round, from, to };
  if (edge.type === 'canal' && [3, 4].includes(round) && dragon !== 'Ember') return { code: 'flooded_canal', dragon, round, from, to };
  if (edge.type === 'tunnel' && dragon !== 'Ember') return { code: 'dragon_cannot_tunnel', dragon, from, to };
  if (edge.type === 'air' && dragon !== 'Gale') return { code: 'dragon_cannot_fly', dragon, from, to };
  if (dragon === 'Ember' && to === 'A' && from === 'M' && state.held.Ember.includes('ice') && !state.sealedIce) return { code: 'ice_unsealed', dragon, order: 'ice' };
  const cost = edge.type === 'air' && [2, 3].includes(round) ? 3 : edge.cost;
  if (state.stamina[dragon] < cost) return { code: 'stamina_short', dragon, need: cost, have: state.stamina[dragon], from, to };
  return null;
}

export function legalActions(state, dragon) {
  if (!state || state.status !== 'playing') return [];
  const actions = [{ type: 'wait' }, { type: 'ration' }, ...LOCATIONS.map(to => ({ type: 'move', to }))];
  return actions.filter(action => !actionIssue(state, dragon, action));
}

export function validateAction(state, dragon, action, round = state.turn + 1) {
  return actionIssue(state, dragon, action, round);
}

// Project one dragon's own queue independently; the joint forecast still checks shared resources and deadlines.
export function projectDragonRoute(state, dragon, actions = []) {
  let current = clone(state);
  const events = [], issues = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i], round = current.turn + i + 1;
    const issue = actionIssue(current, dragon, action, round);
    if (issue) { issues.push({ ...issue, turn: round }); break; }
    if (action.type === 'move') {
      const from = current.locations[dragon], to = action.to, edge = edgeBetween(from, to);
      const cost = edge.type === 'air' && [2, 3].includes(round) ? 3 : edge.cost;
      current.locations[dragon] = to;
      current.stamina[dragon] -= cost;
      events.push({ code: 'dragon_moved', dragon, from, to, cost, remaining: current.stamina[dragon], edge: edge.id, turn: round });
      for (const id of [...current.held[dragon]]) if (ORDERS[id].destination === to) {
        current.held[dragon] = current.held[dragon].filter(x => x !== id);
        current.orderStatus[id] = 'delivered';
        current.delivered[id] = { dragon, turn: round, destination: to };
        events.push({ code: 'order_delivered', dragon, order: id, location: to, turn: round, deadline: ORDERS[id].deadline });
      }
    } else if (action.type === 'ration') {
      const from = current.stamina[dragon];
      current.rationAvailable = false;
      current.stamina[dragon] = Math.min(current.maxStamina[dragon], from + 3);
      events.push({ code: 'ration_used', dragon, from, to: current.stamina[dragon], turn: round });
    } else events.push({ code: 'dragon_waited', dragon, location: current.locations[dragon], turn: round });
  }
  return { state: current, events, issues };
}

export function snapshotDispatchTurn(state, plan) {
  return { state: clone(state), plan: clone(plan) };
}

export function restoreDispatchTurn(snapshot) {
  if (!snapshot?.state || !snapshot?.plan) throw new TypeError('A dispatch turn snapshot needs state and plan.');
  return { state: clone(snapshot.state), plan: clone(snapshot.plan) };
}

function deliverAt(state, dragon, round, events) {
  const at = state.locations[dragon];
  for (const id of [...state.held[dragon]]) {
    if (ORDERS[id].destination !== at) continue;
    state.held[dragon] = state.held[dragon].filter(x => x !== id);
    state.orderStatus[id] = 'delivered';
    state.delivered[id] = { dragon, turn: round, destination: at };
    events.push({ code: 'order_delivered', dragon, order: id, location: at, turn: round, deadline: ORDERS[id].deadline });
  }
}

function finishRound(state, round, events) {
  for (const id of Object.keys(ORDERS)) {
    if (!state.delivered[id] && round >= ORDERS[id].deadline) {
      state.status = 'lost';
      state.result = { code: 'order_late', order: id, deadline: ORDERS[id].deadline, turn: round };
      events.push({ code: 'order_late', order: id, deadline: ORDERS[id].deadline, turn: round });
      return;
    }
  }
  if (Object.keys(ORDERS).every(id => state.delivered[id]) && DRAGONS.every(d => state.locations[d] === 'K')) {
    state.status = 'won';
    const badge = state.delivered.ice.turn < state.delivered.eggs.turn ? 'ice_dream_early' : 'chorus_on_time';
    state.result = { code: 'delivered_and_home', badge, turn: round };
    events.push({ code: 'dispatch_won', badge, turn: round });
    return;
  }
  if (round >= 6) {
    state.status = 'lost';
    state.result = { code: 'not_home', turn: round, locations: { ...state.locations } };
    events.push({ code: 'turn_limit_not_home', turn: round, locations: { ...state.locations } });
  }
}

export function stepDispatch(state, jointAction) {
  if (!state || typeof state !== 'object') throw new TypeError('A dispatch state is required.');
  const actions = jointAction || {};
  const round = state.turn + 1;
  const missing = DRAGONS.find(dragon => !actions[dragon]);
  if (missing) return { ok: false, state, events: [], issues: [{ code: 'unplanned_action', dragon: missing, turn: round }] };
  const pair = { Ember: actions.Ember, Gale: actions.Gale };
  const issues = DRAGONS.map(dragon => actionIssue(state, dragon, pair[dragon], round)).filter(Boolean);
  if (pair.Ember.type === 'ration' && pair.Gale.type === 'ration') issues.push({ code: 'ration_contested', turn: round });
  if (issues.length) return { ok: false, state, events: [], issues };

  const next = clone(state), events = [];
  next.turn = round;
  for (const dragon of DRAGONS) {
    const action = pair[dragon];
    if (action.type === 'move') {
      const from = next.locations[dragon], to = action.to, edge = edgeBetween(from, to);
      const cost = edge.type === 'air' && [2, 3].includes(round) ? 3 : edge.cost;
      next.locations[dragon] = to;
      next.stamina[dragon] -= cost;
      events.push({ code: 'dragon_moved', dragon, from, to, cost, remaining: next.stamina[dragon], edge: edge.id, turn: round });
      deliverAt(next, dragon, round, events);
    } else if (action.type === 'ration') {
      next.rationAvailable = false;
      const before = next.stamina[dragon];
      next.stamina[dragon] = Math.min(next.maxStamina[dragon], before + 3);
      events.push({ code: 'ration_used', dragon, from: before, to: next.stamina[dragon], turn: round });
    } else {
      events.push({ code: action.automatic ? 'dragon_auto_waited' : 'dragon_waited', dragon, location: next.locations[dragon], turn: round });
    }
  }
  finishRound(next, round, events);
  next.logs.push(...events);
  return { ok: true, state: next, events, issues: [] };
}

export function simulatePlan(state, plan, { stopOnFailure = true } = {}) {
  let current = clone(state);
  const events = [], timeline = [], issues = [];
  const max = Math.min(6 - current.turn, Math.max(plan?.Ember?.length || 0, plan?.Gale?.length || 0));
  for (let i = 0; i < max && current.status === 'playing'; i++) {
    const before = current;
    const joint = { Ember: plan.Ember?.[i] || null, Gale: plan.Gale?.[i] || null };
    for (const dragon of DRAGONS) if (!joint[dragon] && current.locations[dragon] === 'K' && current.held[dragon].length === 0) joint[dragon] = { type: 'wait', automatic: true };
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
    events.push(...result.events);
    timeline.push({ turn: current.turn, actions: clone(joint), stamina: { ...current.stamina }, locations: { ...current.locations }, delivered: { ...current.delivered }, status: current.status, result: current.result });
  }
  return { state: current, events, timeline, issues, evaluation: evaluateDispatch(current) };
}

export function evaluateDispatch(state) {
  const loadout = validateLoadout(state.assignments, state.sealedIce);
  const deliveries = Object.fromEntries(Object.keys(ORDERS).map(id => [id, state.delivered[id] || null]));
  if (state.status === 'setup') return { status: 'setup', loadout, deliveries, result: null };
  const delivered = Object.keys(ORDERS).every(id => Boolean(state.delivered[id]));
  const deadlinesMet = Object.keys(ORDERS).every(id => state.delivered[id] && state.delivered[id].turn <= ORDERS[id].deadline);
  const home = DRAGONS.every(d => state.locations[d] === 'K');
  return { status: state.status, loadout, deliveries, allDelivered: delivered, deadlinesMet, home, result: state.result };
}

