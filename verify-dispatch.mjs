import assert from 'node:assert/strict';
import {
  createDispatchState, validateLoadout, validateAction, legalActions, stepDispatch,
  simulatePlan, projectDragonRoute, evaluateDispatch, snapshotDispatchTurn,
  restoreDispatchTurn, DRAGONS, ORDERS,
} from './dispatch-logic.mjs';
import { dispatchCopies } from './dispatch-copy.mjs';
import { formatDispatchIssue, formatDispatchEvent, formatPlannerStatus } from './dispatch-ui.mjs';

const route = nodes => nodes.map(to => ({ type: 'move', to }));
const assignment = (ember, gale, sealedIce = false) => ({ assignments: { Ember: ember, Gale: gale }, sealedIce });
const fixtureA = createDispatchState(assignment(['soup', 'eggs'], ['ice']));
const planA = {
  Ember: route(['C', 'T', 'C', 'M', 'C', 'K']),
  Gale: [...route(['C', 'A']), { type: 'ration' }, ...route(['C', 'K'])],
};
const fixtureB = createDispatchState(assignment(['ice', 'eggs'], ['soup'], true));
const planB = {
  Ember: route(['C', 'M', 'A', 'M', 'C', 'K']),
  Gale: route(['C', 'T', 'C', 'K']),
};

for (const [name, state, plan, expected, badge] of [
  ['ice dream early', fixtureA, planA, { soup: 2, ice: 2, eggs: 4 }, 'ice_dream_early'],
  ['on-time chorus', fixtureB, planB, { soup: 2, eggs: 2, ice: 3 }, 'chorus_on_time'],
]) {
  const before = structuredClone(state);
  const forecast = simulatePlan(state, plan);
  assert.equal(forecast.state.status, 'won', `${name} must win`);
  assert.equal(forecast.state.result.badge, badge);
  assert.deepEqual(Object.fromEntries(Object.entries(expected).map(([id]) => [id, forecast.state.delivered[id].turn])), expected);
  assert.equal(forecast.state.locations.Ember, 'K');
  assert.equal(forecast.state.locations.Gale, 'K');
  assert.deepEqual(state, before, 'planning must not mutate the input state');
  assert.equal(forecast.issues.length, 0);
  if (name === 'ice dream early') {
    assert.equal(forecast.state.stamina.Ember, 0);
    assert.equal(forecast.state.stamina.Gale, 2);
    assert.equal(forecast.state.rationAvailable, false);
    assert.equal(forecast.state.sealedIce, false);
  } else {
    assert.equal(forecast.state.stamina.Ember, 0);
    assert.equal(forecast.state.stamina.Gale, 1);
    assert.equal(forecast.state.rationAvailable, true);
    assert.equal(forecast.state.sealedIce, true);
  }
}

assert.equal(validateLoadout({ Ember: ['soup', 'ice'], Gale: ['eggs'] }, false).issues[0].code, 'ice_unsealed');
assert.ok(validateLoadout({ Ember: ['soup', 'ice'], Gale: ['eggs'] }, true).valid);
assert.ok(validateLoadout({ Ember: ['soup', 'eggs'], Gale: ['ice'] }).valid);
assert.ok(validateLoadout({ Ember: ['soup', 'soup', 'eggs'], Gale: ['ice'] }).issues.some(x => x.code === 'duplicate_order'));
assert.ok(validateLoadout({ Ember: ['soup', 'eggs'], Gale: ['ice', 'mystery'] }).issues.some(x => x.code === 'unknown_order'));
assert.ok(validateLoadout({ Ember: ['soup', 'ice', 'eggs'], Gale: [] }).issues.some(x => x.code === 'over_capacity'));

const fixtureRoute = createDispatchState(assignment(['soup', 'eggs'], ['ice']));
const noImplicitWait = simulatePlan(fixtureRoute, { Ember: route(['C']) });
assert.deepEqual(noImplicitWait.issues[0], { code: 'unplanned_action', dragon: 'Gale', turn: 1 });
assert.equal(noImplicitWait.timeline.length, 0);
const longEmberRoute = projectDragonRoute(fixtureRoute, 'Ember', planA.Ember);
assert.equal(longEmberRoute.issues.length, 0, 'a full independent Ember route remains projectable before Gale is planned');
assert.equal(longEmberRoute.state.locations.Ember, 'K');
assert.equal(longEmberRoute.state.stamina.Ember, 0);
assert.equal(longEmberRoute.state.delivered.eggs.turn, 4);

// Publicly known weather boundaries and species-specific roads.
const weather = createDispatchState(assignment(['soup', 'eggs'], ['ice']));
weather.locations.Ember = 'C';
weather.turn = 3;
assert.equal(validateAction(weather, 'Ember', { type: 'move', to: 'T' })?.code, 'ridge_closed');
weather.turn = 4;
assert.equal(validateAction(weather, 'Ember', { type: 'move', to: 'T' })?.code, 'ridge_closed');
weather.turn = 5;
assert.equal(validateAction(weather, 'Ember', { type: 'move', to: 'T' }), null, 'ridge reopens for turn 6');
weather.turn = 2;
assert.equal(validateAction(weather, 'Ember', { type: 'move', to: 'M' }), null, 'Ember crosses the flooded canal on turn 3');
weather.turn = 3;
assert.equal(validateAction(weather, 'Ember', { type: 'move', to: 'M' }), null, 'Ember crosses the flooded canal on turn 4');
weather.locations.Gale = 'C';
assert.equal(validateAction(weather, 'Gale', { type: 'move', to: 'M' })?.code, 'flooded_canal');
weather.turn = 4;
assert.equal(validateAction(weather, 'Gale', { type: 'move', to: 'M' }), null, 'canal reopens on turn 5');
weather.turn = 1;
weather.stamina.Gale = 3;
assert.equal(validateAction(weather, 'Gale', { type: 'move', to: 'A' }), null, 'air route is legal with its turn-2 cost of 3');
weather.stamina.Gale = 2;
assert.equal(validateAction(weather, 'Gale', { type: 'move', to: 'A' })?.code, 'stamina_short');
weather.turn = 2;
weather.stamina.Gale = 1;
assert.equal(validateAction(weather, 'Gale', { type: 'move', to: 'A' })?.code, 'stamina_short', 'air route also costs 3 on turn 3');
weather.turn = 3;
weather.stamina.Gale = 1;
assert.equal(validateAction(weather, 'Gale', { type: 'move', to: 'A' }), null, 'air route returns to cost 1 on turn 4');
weather.locations.Gale = 'M';
assert.equal(validateAction(weather, 'Gale', { type: 'move', to: 'A' })?.code, 'dragon_cannot_tunnel');
weather.locations.Ember = 'C';
assert.equal(validateAction(weather, 'Ember', { type: 'move', to: 'A' })?.code, 'dragon_cannot_fly');
weather.locations.Ember = 'K';
assert.equal(validateAction(weather, 'Ember', { type: 'move', to: 'T' })?.code, 'not_adjacent');

// A dragon may arrive at zero stamina and still deliver, then stay put but not move.
const exhausted = createDispatchState(assignment(['soup', 'eggs'], ['ice']));
exhausted.turn = 3;
exhausted.locations.Ember = 'C';
exhausted.stamina.Ember = 1;
exhausted.held = { Ember: ['eggs'], Gale: [] };
exhausted.delivered = { soup: { dragon: 'Ember', turn: 2, destination: 'T' }, ice: { dragon: 'Gale', turn: 2, destination: 'A' } };
exhausted.orderStatus = { soup: 'delivered', ice: 'delivered', eggs: 'aboard' };
const arrivalAtZero = stepDispatch(exhausted, { Ember: { type: 'move', to: 'M' }, Gale: { type: 'wait' } });
assert.equal(arrivalAtZero.ok, true);
assert.equal(arrivalAtZero.state.stamina.Ember, 0);
assert.equal(arrivalAtZero.state.delivered.eggs.turn, 4);
assert.equal(validateAction(arrivalAtZero.state, 'Ember', { type: 'move', to: 'C' })?.code, 'stamina_short');
const stayAtZero = stepDispatch(arrivalAtZero.state, { Ember: { type: 'wait' }, Gale: { type: 'wait' } });
assert.equal(stayAtZero.ok, true);
assert.equal(stayAtZero.state.stamina.Ember, 0);

// Inclusive deadline and expiry at the end of the due turn.
assert.equal(fixtureA.delivered?.soup, undefined);
const late = createDispatchState(assignment(['soup', 'eggs'], ['ice']));
late.turn = 1;
const lateTurn = stepDispatch(late, { Ember: { type: 'wait' }, Gale: { type: 'wait' } });
assert.equal(lateTurn.state.status, 'lost');
assert.deepEqual(lateTurn.state.result, { code: 'order_late', order: 'soup', deadline: 2, turn: 2 });

// The shared ration cannot be spent twice; one use recovers up to the dragon's cap.
const rationState = createDispatchState(assignment(['soup', 'eggs'], ['ice']));
rationState.stamina.Ember = 2;
const contested = stepDispatch(rationState, { Ember: { type: 'ration' }, Gale: { type: 'ration' } });
assert.equal(contested.ok, false);
assert.equal(contested.issues[0].code, 'ration_contested');
assert.equal(rationState.rationAvailable, true, 'illegal joint actions are atomic');
const singleRation = stepDispatch(rationState, { Ember: { type: 'ration' }, Gale: { type: 'wait' } });
assert.equal(singleRation.state.stamina.Ember, 5);
assert.equal(singleRation.state.rationAvailable, false);
assert.ok(!legalActions(singleRation.state, 'Gale').some(action => action.type === 'ration'));

// Undo snapshots restore the full pre-turn state and queues, including deliveries and shared supplies.
const undoState = createDispatchState(assignment(['soup', 'eggs'], ['ice']));
const undoPlan = { Ember: route(['C']), Gale: route(['C']) };
const snapshot = snapshotDispatchTurn(undoState, undoPlan);
const afterTurn = stepDispatch(undoState, { Ember: undoPlan.Ember[0], Gale: undoPlan.Gale[0] });
assert.equal(afterTurn.state.turn, 1);
const restored = restoreDispatchTurn(snapshot);
assert.deepEqual(restored.state, undoState);
assert.deepEqual(restored.plan, undoPlan);
restored.state.turn = 99;
assert.equal(undoState.turn, 0, 'restored snapshot is independent of its source');

for (const lang of ['en', 'zh', 'ja', 'es']) {
  const copy = dispatchCopies[lang];
  assert.deepEqual(Object.keys(copy.error).sort(), Object.keys(dispatchCopies.en.error).sort(), `${lang} error copy is complete`);
  assert.deepEqual(Object.keys(copy.event).sort(), Object.keys(dispatchCopies.en.event).sort(), `${lang} event copy is complete`);
  assert.deepEqual(Object.keys(copy.planner).sort(), Object.keys(dispatchCopies.en.planner).sort(), `${lang} planner and result copy is complete`);
  assert.equal(copy.guideRules.length, dispatchCopies.en.guideRules.length);
  assert.ok(copy.resultTurn && !/completed|completado|完了/.test(copy.resultTurn), `${lang} terminal turn label is neutral`);
  assert.ok(copy.planner.finalDeliveries && copy.planner.tryOtherSplit && copy.planner.statusConflict);
  const lateCopy = formatDispatchIssue({ code: 'order_late', order: 'soup', deadline: 2 }, copy);
  assert.ok(lateCopy.includes(copy.orders.soup.name));
  assert.ok(!lateCopy.includes('order_late') && !lateCopy.includes('soup'));
  const homeCopy = formatDispatchIssue({ code: 'not_home', locations: { Ember: 'M', Gale: 'K' } }, copy);
  assert.ok(homeCopy.includes(copy.dragons.Ember) && homeCopy.includes(copy.locations.M));
  const deliveryCopy = formatDispatchEvent({ code: 'order_delivered', dragon: 'Ember', order: 'soup', recipient: 'giant', location: 'T', turn: 2, deadline: 2 }, copy);
  assert.ok(deliveryCopy.includes(copy.orders.soup.name) && deliveryCopy.includes(copy.locations.T));
  assert.ok(!deliveryCopy.includes('order_delivered') && !deliveryCopy.includes('soup'));
  const illegalMove = { code: 'dragon_cannot_fly', dragon: 'Ember', turn: 1 };
  const missingGale = { code: 'unplanned_action', dragon: 'Gale', turn: 1 };
  const prioritized = formatPlannerStatus({ gameStatus: 'playing', noticeIssue: illegalMove, forecastIssue: missingGale, copy });
  assert.equal(prioritized.hasIssue, true);
  assert.equal(prioritized.line, copy.planner.statusConflict.replace('{turn}', '1').replace('{detail}', formatDispatchIssue(illegalMove, copy)));
  assert.ok(!prioritized.line.includes('unplanned_action'));
  assert.equal(formatPlannerStatus({ gameStatus: 'playing', forecastIssue: missingGale, copy }).line, copy.planner.statusConflict.replace('{turn}', '1').replace('{detail}', formatDispatchIssue(missingGale, copy)));
  assert.deepEqual(formatPlannerStatus({ gameStatus: 'won', forecastIssue: missingGale, copy }), { line: copy.winTitle, hasIssue: false });
  assert.deepEqual(formatPlannerStatus({ gameStatus: 'lost', forecastIssue: missingGale, copy }), { line: copy.loseTitle, hasIssue: false });
}

// Exhaustively search all eight cargo splits using joint legal actions and memoized states.
function stateKey(state) {
  return JSON.stringify({
    turn: state.turn, locations: state.locations, stamina: state.stamina,
    held: Object.fromEntries(DRAGONS.map(d => [d, [...state.held[d]].sort()])),
    delivered: Object.fromEntries(Object.entries(state.delivered).sort(([a], [b]) => a.localeCompare(b))),
    rationAvailable: state.rationAvailable, sealedIce: state.sealedIce, status: state.status,
  });
}
const successfulSplits = [];
let exploredStates = 0;
for (let mask = 0; mask < 8; mask++) {
  const assignments = { Ember: [], Gale: [] };
  ['soup', 'ice', 'eggs'].forEach((id, i) => assignments[(mask & (1 << i)) ? 'Ember' : 'Gale'].push(id));
  const sealedIce = assignments.Ember.includes('ice');
  if (!validateLoadout(assignments, sealedIce).valid) continue;
  const start = createDispatchState({ assignments, sealedIce });
  const queue = [start], seen = new Set([stateKey(start)]);
  let solved = false;
  for (let cursor = 0; cursor < queue.length && !solved; cursor++) {
    const state = queue[cursor]; exploredStates++;
    if (state.status === 'won') { solved = true; break; }
    if (state.status !== 'playing' || state.turn >= 6) continue;
    const emberActions = legalActions(state, 'Ember');
    const galeActions = legalActions(state, 'Gale');
    for (const ember of emberActions) for (const gale of galeActions) {
      const next = stepDispatch(state, { Ember: ember, Gale: gale });
      if (!next.ok || next.state.status === 'lost') continue;
      if (next.state.status === 'won') { solved = true; break; }
      const key = stateKey(next.state);
      if (!seen.has(key)) { seen.add(key); queue.push(next.state); }
    }
    assert.ok(seen.size < 150000, 'state search stays bounded');
  }
  if (solved) successfulSplits.push(assignments);
}
assert.equal(successfulSplits.length, 2, `only two cargo splits should be solvable; found ${JSON.stringify(successfulSplits)}`);
assert.ok(successfulSplits.some(x => x.Ember.includes('soup') && x.Ember.includes('eggs') && x.Gale.includes('ice')));
assert.ok(successfulSplits.some(x => x.Ember.includes('ice') && x.Ember.includes('eggs') && x.Gale.includes('soup')));

console.log(`PASS: fixtures A/B, cargo validation, unplanned turns, weather boundaries, stamina, inclusive deadlines, shared ration, undo, four-language copy and planner status priority, and exhaustive split search (${exploredStates} states; 2 winning splits).`);
