import assert from 'node:assert/strict';
import { createDispatchState, simulatePlan, validateAction, getDispatchLevel } from '../src/dispatch-logic.mjs';
import { copyForDispatchLevel } from '../src/dispatch-copy.mjs';

const moves = nodes => nodes.map(to => ({ type: 'move', to }));
const wait = { type: 'wait' }, ration = { type: 'ration' };
const planA = {
  Ember: [...moves(['C', 'T', 'C', 'M', 'C', 'T']), ration, ...moves(['C', 'K'])],
  Gale: [...moves(['C']), wait, wait, ...moves(['A', 'C', 'K'])],
};
const planB = {
  Ember: moves(['A']).concat(wait, moves(['M', 'C', 'K'])),
  Gale: [...moves(['C', 'T', 'C']), ration, ...moves(['M', 'C', 'T', 'C', 'K'])],
};
const stateA = createDispatchState({ levelId: 'market', assignments: { Ember: ['soup', 'eggs'], Gale: ['ice'] } });
assert.equal(stateA.status, 'playing');
assert.deepEqual(stateA.locations, { Ember: 'M', Gale: 'K' });
assert.deepEqual(stateA.held, { Ember: [], Gale: [] }, 'all Market parcels begin at their sources');
const resultA = simulatePlan(stateA, planA);
assert.equal(resultA.state.status, 'won');
assert.deepEqual(Object.fromEntries(Object.entries(resultA.state.delivered).map(([id, item]) => [id, item.turn])), { soup: 4, eggs: 6, ice: 6 });
assert.equal(resultA.state.turn, 9);
assert.deepEqual(resultA.state.stamina, { Ember: 1, Gale: 1 });
assert.equal(resultA.state.rationAvailable, false);
assert.equal(resultA.state.sealedIce, false);
const exchangedAtMarsh = resultA.events.filter(event => event.turn === 4 && event.dragon === 'Ember' && ['order_delivered', 'order_picked_up'].includes(event.code));
assert.deepEqual(exchangedAtMarsh.map(event => [event.code, event.order]), [['order_delivered', 'soup'], ['order_picked_up', 'eggs']], 'Market same-stop exchange delivers soup before picking up the eggs');

const stateB = createDispatchState({ levelId: 'market', assignments: { Ember: ['ice'], Gale: ['soup', 'eggs'] }, sealedIce: true });
assert.equal(stateB.status, 'playing');
const resultB = simulatePlan(stateB, planB);
assert.equal(resultB.state.status, 'won');
assert.deepEqual(Object.fromEntries(Object.entries(resultB.state.delivered).map(([id, item]) => [id, item.turn])), { ice: 5, soup: 5, eggs: 7 });
assert.equal(resultB.state.turn, 9);
assert.deepEqual(resultB.state.stamina, { Ember: 2, Gale: 0 });
assert.equal(resultB.state.rationAvailable, false);
assert.equal(resultB.state.sealedIce, true);
assert.equal(resultB.state.pickedUp.ice.dragon, 'Ember');

const flooded = { ...stateB, locations: { ...stateB.locations, Gale: 'C' }, stamina: { ...stateB.stamina } };
assert.equal(validateAction(flooded, 'Gale', { type: 'move', to: 'M' }, 4).code, 'flooded_canal');
assert.equal(validateAction(flooded, 'Gale', { type: 'move', to: 'M' }, 5), null);

const eggsReady = createDispatchState({ levelId: 'market', assignments: { Ember: ['eggs'], Gale: ['soup', 'ice'] } });
let state = eggsReady;
for (let turn = 1; turn <= 3; turn++) {
  const result = (await import('../src/dispatch-logic.mjs')).stepDispatch(state, { Ember: wait, Gale: wait });
  assert.equal(result.ok, true);
  state = result.state;
  assert.equal(state.orderStatus.eggs, turn < 3 ? 'waiting_pickup' : 'aboard');
}
assert.equal(getDispatchLevel('market').turnLimit, 9);
for (const invalidLevel of ['missing', 'constructor', '__proto__', '']) assert.equal(getDispatchLevel(invalidLevel).id, 'first');
for (const lang of ['en', 'zh', 'ja', 'es']) {
  for (const level of ['first', 'return', 'market']) {
    assert.ok(copyForDispatchLevel(lang, level).levelMarket, `${lang}/${level} has a non-empty third-level navigation label`);
  }
  const copy = copyForDispatchLevel(lang, 'market');
  assert.ok(copy.marketDuration, `${lang} has an honest Market difficulty label`);
  assert.match(copy.marketStartLocations, /\{home\}/, `${lang} explicitly includes the return destination`);
  assert.match(copy.marketTutorial[1], /.+/, `${lang} explains pickup timing`);
  assert.match(copy.error.not_home, /\{turn\}/, `${lang} uses the level-specific failure turn`);
  assert.match(copy.event.turn_limit_not_home, /\{turn\}/, `${lang} reports the dynamic turn limit`);
}
const noRation = { ...planA, Ember: [...planA.Ember.slice(0, 6), wait, ...planA.Ember.slice(7)] };
const rationMiss = simulatePlan(stateA, noRation);
assert.equal(rationMiss.issues[0]?.code, 'stamina_short', 'the unrationed route cannot silently execute its exhausted move');
console.log('PASS: Market Relay A/B fixtures, empty starts, pickup timing, flood boundary, seal use, stamina, and the required ration stop.');
