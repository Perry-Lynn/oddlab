import assert from 'node:assert/strict';
import {
  createDispatchState, validateLoadout, validateAction, legalActions, stepDispatch,
  simulatePlan, projectDragonRoute, evaluateDispatch, snapshotDispatchTurn,
  restoreDispatchTurn, DRAGONS, ORDERS, LEVELS, getDispatchLevel, currentLoad,
} from './dispatch-logic.mjs';
import { dispatchCopies, copyForDispatchLevel } from './dispatch-copy.mjs';
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
  const returnCopy = copyForDispatchLevel(lang, 'return');
  assert.deepEqual(Object.keys(copy.error).sort(), Object.keys(dispatchCopies.en.error).sort(), `${lang} error copy is complete`);
  assert.deepEqual(Object.keys(copy.event).sort(), Object.keys(dispatchCopies.en.event).sort(), `${lang} event copy is complete`);
  assert.deepEqual(Object.keys(copy.planner).sort(), Object.keys(dispatchCopies.en.planner).sort(), `${lang} planner and result copy is complete`);
  assert.equal(copy.guideRules.length, dispatchCopies.en.guideRules.length);
  assert.ok(copy.resultTurn && !/completed|completado|完了/.test(copy.resultTurn), `${lang} terminal turn label is neutral`);
  assert.ok(copy.planner.finalDeliveries && copy.planner.tryOtherSplit && copy.planner.statusConflict);
  for (const key of ['responsible', 'pickupTurn', 'deliveryTurn', 'notPickedUp', 'pickupWarnings']) {
    assert.ok(returnCopy[key], `${lang} Return copy provides ${key}`);
  }
  for (const id of Object.keys(LEVELS.return.orders)) {
    assert.ok(returnCopy.orders[id]?.name && returnCopy.orders[id]?.recipient && returnCopy.orders[id]?.detail, `${lang} Return order ${id} is fully localized`);
  }
  assert.ok(!returnCopy.orders.ice.recipient.includes('Archive') && !returnCopy.orders.eggs.recipient.includes('Marsh'), `${lang} Return destinations use this level's recipients`);
  assert.ok(!returnCopy.readyAfter.includes('undefined') && !returnCopy.sourceWaiting.includes('undefined'));
  assert.ok(!returnCopy.returnGoalEggs.includes('antes del turno {turn}'), 'Spanish deadline copy includes the deadline turn');
  const lateCopy = formatDispatchIssue({ code: 'order_late', order: 'soup', deadline: 2 }, copy);
  assert.ok(lateCopy.includes(copy.orders.soup.name));
  assert.ok(!lateCopy.includes('order_late') && !lateCopy.includes('soup'));
  const homeCopy = formatDispatchIssue({ code: 'not_home', locations: { Ember: 'M', Gale: 'K' } }, copy);
  assert.ok(homeCopy.includes(copy.dragons.Ember) && homeCopy.includes(copy.locations.M));
  const deliveryCopy = formatDispatchEvent({ code: 'order_delivered', dragon: 'Ember', order: 'soup', recipient: 'giant', location: 'T', turn: 2, deadline: 2 }, copy);
  assert.ok(deliveryCopy.includes(copy.orders.soup.name) && deliveryCopy.includes(copy.locations.T));
  assert.ok(!deliveryCopy.includes('order_delivered') && !deliveryCopy.includes('soup'));
  const returnDeliveryCopy = formatDispatchEvent({ code: 'order_delivered', dragon: 'Ember', order: 'ice', location: 'M', turn: 5, deadline: 6 }, returnCopy);
  assert.ok(returnDeliveryCopy.includes(returnCopy.orders.ice.name) && returnDeliveryCopy.includes(returnCopy.orders.ice.recipient) && returnDeliveryCopy.includes(returnCopy.locations.M), `${lang} Return delivery log localizes parcel and destination`);
  const returnPickupCopy = formatDispatchEvent({ code: 'order_picked_up', dragon: 'Ember', order: 'eggs', location: 'M', turn: 3 }, returnCopy);
  assert.ok(returnPickupCopy.includes(returnCopy.orders.eggs.name) && returnPickupCopy.includes(returnCopy.locations.M), `${lang} Return pickup log localizes parcel and source`);
  const returnWarningCopy = formatDispatchEvent({ code: 'pickup_over_capacity', dragon: 'Ember', order: 'ice', location: 'A', currentWeight: 2, parcelWeight: 2, capacity: 3 }, returnCopy);
  assert.ok(returnWarningCopy.includes(returnCopy.orders.ice.name) && returnWarningCopy.includes(returnCopy.locations.A), `${lang} Return warnings localize parcel and source`);
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

assert.equal(getDispatchLevel('__proto__').id, 'first');
assert.equal(getDispatchLevel('constructor').id, 'first');
assert.equal(getDispatchLevel('').id, 'first');
assert.equal(getDispatchLevel('return').id, 'return');
assert.deepEqual(Object.keys(LEVELS.return.orders), ['soup', 'ice', 'eggs']);

const returnAssignment = (ember, gale, sealedIce = false) => ({ levelId: 'return', assignments: { Ember: ember, Gale: gale }, sealedIce });
const returnA = createDispatchState(returnAssignment(['soup', 'eggs'], ['ice']));
const returnPlanA = {
  Ember: route(['C', 'T', 'C', 'M', 'C', 'K']),
  Gale: [{ type: 'wait' }, ...route(['C']), { type: 'ration' }, ...route(['A', 'C', 'M', 'C', 'K'])],
};
const returnB = createDispatchState(returnAssignment(['ice', 'eggs'], ['soup'], true));
const returnPlanB = {
  Ember: [...route(['C', 'M', 'A']), { type: 'wait' }, ...route(['M', 'C', 'K'])],
  Gale: route(['C', 'T', 'C', 'K']),
};
for (const [name, state, plan, deliveries, pickups, expectedTurn, stamina, ration, sealUsed] of [
  ['return A', returnA, returnPlanA, { soup: 2, ice: 6, eggs: 6 }, { soup: 0, ice: 4, eggs: 4 }, 8, { Ember: 0, Gale: 0 }, false, false],
  ['return B', returnB, returnPlanB, { soup: 2, ice: 5, eggs: 7 }, { soup: 0, ice: 4, eggs: 5 }, 7, { Ember: 0, Gale: 1 }, true, true],
]) {
  const before = structuredClone(state);
  const forecast = simulatePlan(state, plan);
  assert.equal(forecast.state.status, 'won', `${name} must win`);
  assert.equal(forecast.state.turn, expectedTurn);
  assert.deepEqual(Object.fromEntries(Object.entries(deliveries).map(([id]) => [id, forecast.state.delivered[id].turn])), deliveries);
  assert.deepEqual(Object.fromEntries(Object.entries(pickups).map(([id]) => [id, forecast.state.pickedUp[id].turn])), pickups);
  assert.deepEqual(forecast.state.stamina, stamina);
  assert.equal(forecast.state.rationAvailable, ration);
  assert.equal(forecast.state.sealedIce && forecast.state.pickedUp.ice.dragon === 'Ember', sealUsed);
  assert.equal(forecast.state.orderStatus.soup, 'delivered');
  assert.equal(forecast.state.orderStatus.ice, 'delivered');
  assert.equal(forecast.state.orderStatus.eggs, 'delivered');
  assert.deepEqual(state, before, 'return planning must not mutate input');
  assert.equal(forecast.issues.length, 0);
}
assert.equal(returnA.held.Ember.length, 1, 'only the initially ready soup is aboard');
assert.equal(currentLoad(returnA, 'Ember'), 2);
assert.ok(validateLoadout({ Ember: ['ice', 'eggs'], Gale: ['soup'] }, true, 'return').valid, 'future responsibility weight does not count toward current capacity');
assert.equal(validateLoadout({ Ember: ['ice'], Gale: ['soup', 'eggs'] }, false, 'return').issues[0].code, 'ice_unsealed');
assert.equal(validateLoadout({ Ember: ['ice', 'eggs'], Gale: ['soup'] }, false, 'return').issues[0].code, 'ice_unsealed');
assert.equal(validateLoadout({ Ember: ['ice', 'ice', 'eggs'], Gale: ['soup'] }, true, 'return').issues[0].code, 'duplicate_order');
assert.equal(validateLoadout({ Ember: ['ice', 'eggs'], Gale: ['soup', 'mystery'] }, true, 'return').issues[0].code, 'unknown_order');

const projectedReturn = projectDragonRoute(returnA, 'Ember', returnPlanA.Ember);
assert.equal(projectedReturn.issues.length, 0);
assert.deepEqual(projectedReturn.state.pickedUp, { soup: { dragon: 'Ember', turn: 0, location: 'K' }, eggs: { dragon: 'Ember', turn: 4, location: 'M' } });
assert.deepEqual(projectedReturn.state.delivered.eggs, { dragon: 'Ember', turn: 6, destination: 'K' });
assert.deepEqual(returnA.pickedUp, { soup: { dragon: 'Ember', turn: 0, location: 'K' } }, 'independent pickup preview must not mutate the source');
const sameStop = simulatePlan(returnB, returnPlanB);
const eventsAtFive = sameStop.timeline.find(row => row.turn === 5).warnings;
assert.equal(eventsAtFive.length, 0);
const sameStopEvents = sameStop.events.filter(event => event.turn === 5 && ['order_delivered', 'order_picked_up'].includes(event.code));
assert.deepEqual(sameStopEvents.map(event => [event.code, event.order]), [['order_delivered', 'ice'], ['order_picked_up', 'eggs']], 'delivery must free capacity before pickup at the same stop');
const sameStopRound = sameStop.timeline.find(row => row.turn === 5);
assert.deepEqual(sameStopRound.held.Ember, ['eggs']);
assert.equal(sameStopRound.held.Ember.reduce((sum, id) => sum + LEVELS.return.orders[id].weight, 0), 2, 'cargo must not exceed capacity after same-stop exchange');

// Ready timing and responsibility are checked at the end of each action, after moving.
const readyAtM = createDispatchState(returnAssignment(['eggs'], ['soup', 'ice'], false));
readyAtM.delivered.soup = { dragon: 'Gale', turn: 1, destination: 'T' };
readyAtM.held.Gale = [];
readyAtM.orderStatus.soup = 'delivered';
readyAtM.turn = 1; readyAtM.locations.Ember = 'M';
const eggsTooEarly = stepDispatch(readyAtM, { Ember: { type: 'wait' }, Gale: { type: 'wait' } });
assert.equal(eggsTooEarly.state.orderStatus.eggs, 'waiting_pickup', 'eggs are unavailable at the end of turn 2');
const eggsReady = stepDispatch(eggsTooEarly.state, { Ember: { type: 'wait' }, Gale: { type: 'wait' } });
assert.equal(eggsReady.state.pickedUp.eggs.turn, 3, 'eggs are available at the end of turn 3');

const iceReadyState = createDispatchState(returnAssignment(['ice'], ['soup', 'eggs'], true));
iceReadyState.delivered.soup = { dragon: 'Gale', turn: 1, destination: 'T' };
iceReadyState.held.Gale = [];
iceReadyState.orderStatus.soup = 'delivered';
iceReadyState.turn = 2; iceReadyState.locations.Ember = 'A';
const iceTooEarly = stepDispatch(iceReadyState, { Ember: { type: 'wait' }, Gale: { type: 'wait' } });
assert.equal(iceTooEarly.state.orderStatus.ice, 'waiting_pickup', 'ice is unavailable at the end of turn 3');
const iceReady = stepDispatch(iceTooEarly.state, { Ember: { type: 'wait' }, Gale: { type: 'wait' } });
assert.equal(iceReady.state.pickedUp.ice.turn, 4, 'ice is available at the end of turn 4');
const leaveBeforePickup = stepDispatch(iceTooEarly.state, { Ember: { type: 'move', to: 'M' }, Gale: { type: 'wait' } });
assert.equal(leaveBeforePickup.state.locations.Ember, 'M');
assert.equal(leaveBeforePickup.state.orderStatus.ice, 'waiting_pickup', 'leaving the source on its ready turn does not pick up');

const notOwner = createDispatchState(returnAssignment(['eggs'], ['soup', 'ice'], true));
notOwner.delivered.soup = { dragon: 'Gale', turn: 1, destination: 'T' };
notOwner.held.Gale = [];
notOwner.orderStatus.soup = 'delivered';
notOwner.turn = 3; notOwner.locations.Ember = 'A';
const wrongDragon = stepDispatch(notOwner, { Ember: { type: 'wait' }, Gale: { type: 'wait' } });
assert.equal(wrongDragon.state.orderStatus.ice, 'waiting_pickup', 'a non-responsible dragon cannot collect ice');

// Oversize parcels remain at the source; the legal move is not rolled back or rejected.
const trap = createDispatchState(returnAssignment(['ice', 'eggs'], ['soup'], true));
const trapPlan = { Ember: [...route(['C', 'M']), { type: 'wait' }, ...route(['A', 'M', 'C', 'K'])], Gale: returnPlanB.Gale };
const trapRun = simulatePlan(trap, trapPlan);
assert.equal(trapRun.timeline.find(row => row.turn === 4).locations.Ember, 'A');
assert.equal(trapRun.timeline.find(row => row.turn === 4).orderStatus.ice, 'waiting_pickup');
assert.ok(trapRun.warnings.some(w => w.turn === 4 && w.dragon === 'Ember' && w.order === 'ice' && w.currentWeight === 2 && w.parcelWeight === 2 && w.capacity === 3));
assert.equal(trapRun.issues.length, 0, 'over-capacity pickup is a warning, not an illegal move');
assert.equal(trapRun.state.status, 'lost');
assert.deepEqual(trapRun.state.result, { code: 'order_late', order: 'ice', deadline: 6, turn: 6 });
const missedReady = createDispatchState(returnAssignment(['ice', 'eggs'], ['soup'], true));
const missedReadyRun = simulatePlan(missedReady, { Ember: route(['C', 'M', 'A', 'M', 'C', 'K']), Gale: returnPlanB.Gale });
assert.equal(missedReadyRun.state.status, 'lost');
assert.equal(missedReadyRun.state.result.order, 'ice', 'leaving the source without waiting until round 4 misses ice');
assert.equal(missedReadyRun.state.pickedUp.ice, undefined);

// Turn 8 accepts an all-delivered homecoming; being away at that boundary fails.
const roundEightHome = createDispatchState(returnAssignment(['soup', 'eggs'], ['ice']));
roundEightHome.turn = 7;
roundEightHome.delivered = { soup: { dragon: 'Ember', turn: 2 }, ice: { dragon: 'Gale', turn: 6 }, eggs: { dragon: 'Ember', turn: 6 } };
roundEightHome.orderStatus = { soup: 'delivered', ice: 'delivered', eggs: 'delivered' };
roundEightHome.held = { Ember: [], Gale: [] };
roundEightHome.locations = { Ember: 'K', Gale: 'K' };
assert.equal(stepDispatch(roundEightHome, { Ember: { type: 'wait' }, Gale: { type: 'wait' } }).state.status, 'won');
const roundEightAway = structuredClone(roundEightHome);
roundEightAway.locations.Ember = 'C';
assert.equal(stepDispatch(roundEightAway, { Ember: { type: 'wait' }, Gale: { type: 'wait' } }).state.result.code, 'not_home');

const pendingAtHome = createDispatchState(returnAssignment(['ice'], ['soup', 'eggs'], true));
const pendingPlan = simulatePlan(pendingAtHome, { Gale: [{ type: 'wait' }] });
assert.deepEqual(pendingPlan.issues[0], { code: 'unplanned_action', dragon: 'Ember', turn: 1 }, 'home with a pending responsible parcel is not automatically idle');

// Undo fully restores pickup timing, aboard cargo, and both action queues.
const undoReturn = createDispatchState(returnAssignment(['soup', 'eggs'], ['ice']));
const undoReturnPlan = { Ember: [...route(['C', 'M']), { type: 'wait' }], Gale: [{ type: 'wait' }, ...route(['C'])] };
undoReturn.delivered.soup = { dragon: 'Ember', turn: 1, destination: 'T' };
undoReturn.orderStatus.soup = 'delivered';
undoReturn.held.Ember = [];
let undoBeforePickup = undoReturn, undoSnapshot;
for (let round = 1; round <= 2; round++) undoBeforePickup = stepDispatch(undoBeforePickup, { Ember: undoReturnPlan.Ember[round - 1], Gale: undoReturnPlan.Gale[round - 1] }).state;
undoSnapshot = snapshotDispatchTurn(undoBeforePickup, { Ember: undoReturnPlan.Ember.slice(2), Gale: undoReturnPlan.Gale.slice(2) });
const afterPickup = stepDispatch(undoBeforePickup, { Ember: undoReturnPlan.Ember[2], Gale: { type: 'wait' } });
assert.equal(afterPickup.state.pickedUp.eggs.turn, 3);
const undoReturnRestored = restoreDispatchTurn(undoSnapshot);
assert.equal(undoReturnRestored.state.orderStatus.eggs, 'waiting_pickup');
assert.equal(undoReturnRestored.state.pickedUp.eggs, undefined);
assert.deepEqual(undoReturnRestored.state.held, undoBeforePickup.held);
assert.deepEqual(undoReturnRestored.plan, { Ember: undoReturnPlan.Ember.slice(2), Gale: undoReturnPlan.Gale.slice(2) });

// Enumerate real joint-action states for all eight responsibility splits.
function returnStateKey(state) {
  return JSON.stringify({
    turn: state.turn, locations: state.locations, stamina: state.stamina,
    held: Object.fromEntries(DRAGONS.map(d => [d, [...state.held[d]].sort()])),
    delivered: Object.fromEntries(Object.entries(state.delivered).sort(([a], [b]) => a.localeCompare(b))),
    pickedUp: Object.fromEntries(Object.entries(state.pickedUp).sort(([a], [b]) => a.localeCompare(b))),
    orderStatus: state.orderStatus, assignments: state.assignments,
    rationAvailable: state.rationAvailable, sealedIce: state.sealedIce, status: state.status,
  });
}
const returnSuccessfulSplits = [];
let returnExploredStates = 0;
for (let mask = 0; mask < 8; mask++) {
  const assignments = { Ember: [], Gale: [] };
  ['soup', 'ice', 'eggs'].forEach((id, i) => assignments[(mask & (1 << i)) ? 'Ember' : 'Gale'].push(id));
  const sealedIce = assignments.Ember.includes('ice');
  if (!validateLoadout(assignments, sealedIce, 'return').valid) continue;
  const start = createDispatchState({ levelId: 'return', assignments, sealedIce });
  const queue = [start], seen = new Set([returnStateKey(start)]);
  let solved = false;
  for (let cursor = 0; cursor < queue.length && !solved; cursor++) {
    const state = queue[cursor]; returnExploredStates++;
    if (state.status !== 'playing' || state.turn >= LEVELS.return.turnLimit) continue;
    const emberActions = legalActions(state, 'Ember');
    const galeActions = legalActions(state, 'Gale');
    for (const ember of emberActions) for (const gale of galeActions) {
      const next = stepDispatch(state, { Ember: ember, Gale: gale });
      if (!next.ok || next.state.status === 'lost') continue;
      if (next.state.status === 'won') { solved = true; break; }
      const key = returnStateKey(next.state);
      if (!seen.has(key)) {
        seen.add(key);
        next.state.logs = [];
        queue.push(next.state);
      }
    }
    assert.ok(seen.size < 150000, 'return split search stays bounded');
  }
  if (solved) returnSuccessfulSplits.push(assignments);
}
assert.equal(returnSuccessfulSplits.length, 3, `three Return splits should be solvable; found ${JSON.stringify(returnSuccessfulSplits)}`);
assert.ok(returnSuccessfulSplits.some(x => x.Ember.includes('soup') && x.Ember.includes('eggs') && x.Gale.includes('ice')));
assert.ok(returnSuccessfulSplits.some(x => x.Ember.includes('ice') && x.Ember.includes('eggs') && x.Gale.includes('soup')));
assert.ok(returnSuccessfulSplits.some(x => x.Ember.includes('ice') && x.Gale.includes('soup') && x.Gale.includes('eggs')));

console.log(`PASS: first-level fixtures and weather, Return fixtures A/B, dynamic level fallback, responsibility/pickup timing, over-capacity warnings, same-stop deliver-before-pickup, deadline/turn-8 edges, undo, four-language copy and planner priority; actual joint-action search explored ${returnExploredStates} nonterminal states and found exactly 3 solvable Return splits (${exploredStates} first-level states; 2 winning splits).`);
