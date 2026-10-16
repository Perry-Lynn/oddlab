import { createDispatchState, validateLoadout, simulatePlan, projectDragonRoute, stepDispatch, evaluateDispatch, snapshotDispatchTurn, restoreDispatchTurn, getDispatchLevel, capacityForDragon, currentLoad, DRAGONS, LOCATIONS, EDGES } from './dispatch-logic.mjs';
import { dispatchCopy, copyForDispatchLevel } from './dispatch-copy.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const dragonColor = { Ember: '#c45b42', Gale: '#4c7890' };
const point = { K: [130, 280], C: [355, 280], T: [585, 105], M: [585, 455], A: [835, 280] };
const coordinates = { 'K-C': ['M 130 280 L 355 280', 243, 256], 'C-T': ['M 355 280 L 585 105', 475, 175], 'C-M': ['M 355 280 L 585 455', 500, 385], 'M-A': ['M 585 455 L 835 280', 710, 384], 'C-A': ['M 355 280 Q 595 20 835 280', 735, 185] };

let ui = {
  copy: dispatchCopy('en'), lang: 'en',
  state: createDispatchState(), plan: { Ember: [], Gale: [] }, selected: 'Ember',
  history: [], tutorialDismissed: false, notice: '', noticeIssue: null, container: null, pendingFocusKey: null, pendingResultFocus: false,
};

const activeLevel = () => getDispatchLevel(ui.state.levelId);
const activeCopy = () => copyForDispatchLevel(ui.lang, ui.state.levelId);
function responsibilityWeight(dragon) { return ui.state.assignments[dragon].reduce((n, id) => n + (activeLevel().orders[id]?.weight || 0), 0); }
function text(template, vars = {}) { return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? '')); }
export function formatPickupTiming(pickup, c) {
  if (!pickup) return '';
  return pickup.turn === 0 ? c.loadedBeforeDeparture : text(c.pickupTurn, { turn: pickup.turn });
}
export function returnGoalOutcomes(state, eggsGoal) {
  const won = state.status === 'won';
  return {
    eggsByDeadline: won && Number.isFinite(eggsGoal) && (state.delivered.eggs?.turn ?? Infinity) <= eggsGoal,
    rationUnused: won && state.rationAvailable,
  };
}
function names(c) { return { ...(c.locations || {}), ...(c.dragons || {}), ...Object.fromEntries(Object.entries(c.orders || {}).map(([id, order]) => [id, order.name])) }; }
function detailError(issue, c = activeCopy()) {
  if (!issue) return '';
  const template = c.error?.[issue.code] || issue.code;
  const stranded = issue.locations && Object.entries(issue.locations).find(([, location]) => location !== 'K');
  const vars = { ...issue, ...names(c), order: c.orders?.[issue.order]?.name || issue.order };
  if (stranded) { vars.dragon = c.dragons[stranded[0]]; vars.location = c.locations[stranded[1]]; }
  for (const key of ['dragon']) if (issue[key]) vars[key] = c.dragons[issue[key]] || issue[key];
  for (const key of ['from', 'to', 'location']) if (issue[key]) vars[key] = c.locations[issue[key]] || issue[key];
  if (issue.recipient === undefined && issue.order) vars.recipient = c.orders?.[issue.order]?.recipient || '';
  return text(template, vars);
}
function eventText(event, c = activeCopy()) {
  const template = c.event?.[event.code] || event.code;
  const vars = { ...event, ...names(c), recipient: c.orders?.[event.order]?.recipient || '' };
  if (event.dragon) vars.dragon = c.dragons[event.dragon] || event.dragon;
  for (const key of ['from', 'to', 'location']) if (event[key]) vars[key] = c.locations[event[key]] || event[key];
  if (event.order) vars.order = c.orders?.[event.order]?.name || event.order;
  return text(template, vars);
}
export const formatDispatchIssue = detailError;
export const formatDispatchEvent = eventText;
export function formatPlannerStatus({ gameStatus = 'playing', noticeIssue = null, forecastIssue = null, timeline = [], copy }) {
  if (gameStatus === 'won') return { line: copy.winTitle, hasIssue: false };
  if (gameStatus === 'lost') return { line: copy.loseTitle, hasIssue: false };
  const issue = noticeIssue || forecastIssue;
  if (issue) return { line: text(copy.planner.statusConflict, { turn: issue.turn, detail: detailError(issue, copy) }), hasIssue: true };
  if (timeline.length) return { line: text(copy.planner.statusReady, { turn: timeline[0].turn }), hasIssue: false };
  return { line: copy.planner.statusNoActions, hasIssue: false };
}
function actionText(action, c = ui.copy) {
  if (action.type === 'move') return `${c.move} → ${c.locations[action.to]}`;
  return action.type === 'ration' ? c.ration : c.wait;
}
function showNotice(message, issue = null) { ui.notice = message; ui.noticeIssue = issue; render(); }
function orderDetail(spec, c, returnLevel = ui.state.levelId === 'return') {
  if (!returnLevel) return c.orders[Object.keys(activeLevel().orders).find(id => activeLevel().orders[id] === spec)]?.detail || '';
  const ready = spec.readyAt === 0 ? c.readyNow : text(c.readyAfter, { turn: spec.readyAt });
  return text(c.orderFormat, { source: c.locations[spec.source], destination: c.locations[spec.destination], weight: spec.weight, ready, deadline: spec.deadline });
}

function loadoutPanel(c) {
  const level = activeLevel(), returnLevel = level.id === 'return';
  const assigned = DRAGONS.map(d => responsibilityWeight(d));
  const validation = validateLoadout(ui.state.assignments, ui.state.sealedIce, level.id);
  const errors = validation.issues.filter(issue => issue.code !== 'missing_order').map(issue => `<li>${esc(detailError(issue, c))}</li>`).join('');
  const assignmentTitle = returnLevel ? c.returnAssignments : c.assignments;
  const assignmentHint = returnLevel ? c.returnLoadoutHint : c.loadoutMissing;
  const capacities = DRAGONS.map((d, i) => {
    const capacity = capacityForDragon(d), loaded = currentLoad(ui.state, d);
    return `<div class="dispatch-capacity"><span>${esc(c.dragons[d])} · ${esc(c.capacity)}</span><strong class="${loaded > capacity ? 'is-over' : ''}">${loaded} / ${capacity}${returnLevel ? ` · ${esc(c.responsibleLabel)} ${assigned[i]}` : ''}</strong></div>`;
  }).join('');
  return `<section class="dispatch-panel dispatch-loadout" aria-labelledby="dispatch-loadout-title">
    <div class="dispatch-panel-head"><span class="dispatch-step">01</span><div><h2 id="dispatch-loadout-title" tabindex="-1" data-focus-key="loadout-title">${esc(assignmentTitle)}</h2><p>${esc(assignmentHint)}</p></div></div>
    <p class="dispatch-skills"><span>${esc(c.legendEmber)}</span><span>${esc(c.legendGale)}</span></p>
    <div class="dispatch-order-list">${Object.entries(level.orders).map(([id, spec]) => {
      const assignedDragon = validation.owners[id]?.[0]; const order = c.orders[id];
      return `<article class="dispatch-order" data-order="${id}"><div class="dispatch-order-copy"><span class="dispatch-order-mark dispatch-order-${id}">${({ soup:'♨', ice:'✳', eggs:'◌' })[id]}</span><div><h3>${esc(order.name)}</h3><p>${esc(orderDetail(spec, c))}</p>${!assignedDragon ? `<small class="dispatch-assignment-prompt">${esc(c.notAssigned)}</small>` : ''}</div><span class="dispatch-weight">${spec.weight} ⚖</span></div><div class="dispatch-order-pick" role="group" aria-label="${esc(order.name)} · ${esc(c.selectDragon)}">${DRAGONS.map(dragon => `<button type="button" class="dispatch-pick ${assignedDragon === dragon ? `is-${dragon.toLowerCase()}` : ''}" data-action="dispatch-action" data-dispatch-action="assign-order" data-order="${id}" data-dragon="${dragon}" data-focus-key="assign-${id}-${dragon}" data-focus-group="assign-${id}" aria-pressed="${assignedDragon === dragon}">${esc(c.dragons[dragon])}</button>`).join('')}</div></article>`;
    }).join('')}</div>
    <div class="dispatch-capacity-row">${capacities}</div>
    <div class="dispatch-seal-row"><div><strong>${esc(c.seal)}</strong><p>${esc(c.sealHelp)}</p></div><button type="button" class="button ${ui.state.sealedIce ? 'dark' : 'light'}" data-action="dispatch-action" data-dispatch-action="toggle-seal" data-focus-key="toggle-seal" data-focus-group="setup-controls" aria-pressed="${ui.state.sealedIce}">${esc(ui.state.sealedIce ? c.sealOn : c.sealOff)}</button></div>
    ${errors ? `<ul class="dispatch-errors" role="status">${errors}</ul>` : `<p class="dispatch-valid">${esc(validation.valid ? c.loadoutReady : c.loadoutMissing)}</p>`}
    <button type="button" class="button dark dispatch-start" data-action="dispatch-action" data-dispatch-action="start" data-focus-key="start" data-focus-group="setup-controls" ${validation.valid ? '' : 'disabled'}>${esc(c.start)} <span aria-hidden="true">→</span></button>
  </section>`;
}

function edgeStatus(edge, round, c) {
  if (edge.type === 'ridge') return round === 4 || round === 5 ? c.edgeClosedRidge : c.open;
  if (edge.type === 'canal') return round === 3 || round === 4 ? c.edgeFlood : c.open;
  if (edge.type === 'air') return round === 2 || round === 3 ? c.edgeWind : c.open;
  return c.open;
}

function dragonGlyph(dragon, x, y, planned = false) {
  const color = dragonColor[dragon], letter = dragon === 'Ember' ? 'E' : 'G';
  if (planned) return `<g class="dispatch-plan-marker" transform="translate(${x} ${y})" aria-label="${esc(ui.copy.planned)}"><circle r="22" fill="#fffcf6" fill-opacity=".45" stroke="${color}" stroke-width="2" stroke-dasharray="4 4"/><text y="4" text-anchor="middle" fill="${color}" font-size="10" font-weight="800">P</text></g>`;
  return `<g class="dispatch-dragon-marker" transform="translate(${x} ${y})" aria-label="${esc(ui.copy.actual)}"><path d="M -13 -7 Q -23 -19 -8 -17 L 0 -9 Q 9 -21 20 -12 L 10 -3 Q 19 3 10 13 Q 0 20 -9 12 Q -17 4 -13 -7Z" fill="${color}" stroke="#fffaf0" stroke-width="2"/><circle cx="5" cy="-5" r="1.5" fill="#fffaf0"/><text x="0" y="8" text-anchor="middle" fill="#fffaf0" font-size="8" font-weight="800">${letter}</text></g>`;
}

function mapSVG(c, forecast, selectedTurn, projections) {
  const nodeCopy = c.locations, level = activeLevel(), returnLevel = level.id === 'return';
  const lines = EDGES.map(edge => {
    const [path, lx, sourceLy] = coordinates[edge.id];
    // The sky-road badge sits closer to the curve here, while leaving room for the Tower label below it.
    const ly = edge.type === 'air' || edge.type === 'ridge' ? 135 : sourceLy;
    const typeLabel = ({ road: c.legendRoad, ridge: c.legendRidge, canal: c.legendCanal, tunnel: c.legendTunnel, air: c.legendAir })[edge.type];
    const cost = edge.type === 'air' && [2, 3].includes(selectedTurn) ? 3 : edge.cost;
    const status = edgeStatus(edge, selectedTurn, c);
    const hasBadge = status !== c.open || cost !== 1;
    return `<g class="dispatch-edge dispatch-edge-${edge.type} ${hasBadge ? 'has-badge' : ''}"><path d="${path}" class="dispatch-edge-line"/><rect x="${lx - 88}" y="${ly - 27}" width="176" height="54" rx="7" class="dispatch-edge-label-bg"/><text x="${lx}" y="${ly - 7}" class="dispatch-edge-cost ${cost === 1 ? 'is-default-cost' : 'is-variable-cost'}" text-anchor="middle">${cost}⚡${cost === 1 ? '' : ' · 1T'}</text><text x="${lx}" y="${ly + 21}" class="dispatch-edge-note ${status === c.open ? 'is-open' : 'is-special'}" text-anchor="middle">${esc(status)}</text><title>${esc(typeLabel)} — ${esc(status)}</title></g>`;
  }).join('');
  const nodes = LOCATIONS.map(id => {
    const [x, y] = point[id];
    const building = ({ K:'⌂', C:'✣', T:'♜', M:'≈', A:'▤' })[id];
    const actual = DRAGONS.filter(d => ui.state.locations[d] === id).map((d, i) => dragonGlyph(d, x + (DRAGONS.length > 1 && ui.state.locations.Ember === ui.state.locations.Gale ? (d === 'Ember' ? -21 : 21) : 0), y - 45));
    const plannedEmber = projections.Ember.state.locations.Ember, plannedGale = projections.Gale.state.locations.Gale;
    const markers = DRAGONS.map(d => projections[d].state.locations[d] === id ? dragonGlyph(d, x + (plannedEmber === plannedGale ? (d === 'Ember' ? -21 : 21) : 0), y + 47, true) : '').join('');
    const waiting = returnLevel ? Object.entries(level.orders).filter(([orderId, spec]) => spec.source === id && ui.state.orderStatus[orderId] === 'waiting_pickup') : [];
    const waitingText = waiting.map(([orderId, spec]) => `${({ soup:'♨', ice:'✳', eggs:'◌' })[orderId]} R${spec.readyAt}`).join(' · ');
    const waitingLabel = waiting.map(([orderId, spec]) => text(c.sourceWaiting, { order: c.orders[orderId].name, turn: spec.readyAt })).join(' · ');
    const nodeLabel = [nodeCopy[id], waitingLabel].filter(Boolean).join(' · ');
    return `<g class="dispatch-map-node" role="button" tabindex="0" data-action="dispatch-action" data-dispatch-action="map-node" data-node="${id}" data-dragon="${ui.selected}" data-focus-key="map-${id}" data-focus-group="map" aria-label="${esc(nodeLabel)}"><circle cx="${x}" cy="${y}" r="82" fill="transparent" pointer-events="all" class="dispatch-node-hit-target"/><circle cx="${x}" cy="${y}" r="41" class="dispatch-node-ring"/><circle cx="${x}" cy="${y}" r="32" class="dispatch-node-core"/><text x="${x}" y="${y + 9}" class="dispatch-node-icon" text-anchor="middle">${building}</text><text x="${x}" y="${y + 112}" class="dispatch-node-name dispatch-node-name-${id}" text-anchor="middle">${esc(nodeCopy[id])}</text>${waiting.length ? `<g class="dispatch-node-waiting" data-waiting-node="${id}"><rect x="${x - 80}" y="${y + 162}" width="160" height="44" rx="8"/><text x="${x}" y="${y + 191}" text-anchor="middle">${esc(waitingText)}</text></g>` : ''}${actual.join('')}${markers}</g>`;
  }).join('');
  return `<svg class="dispatch-map" viewBox="0 0 960 680" role="group" aria-label="${esc(c.mapTitle)}"><title>${esc(c.mapTitle)}</title><defs><pattern id="dispatch-water" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 Q3 2 6 6T12 6" fill="none" stroke="#87aeb2" stroke-width="1" opacity=".55"/></pattern></defs><path d="M355 286 Q400 380 585 456L835 280" fill="none" stroke="url(#dispatch-water)" stroke-width="28" opacity=".27"/>${lines}${nodes}</svg>`;
}

function projections() { return Object.fromEntries(DRAGONS.map(d => [d, projectDragonRoute(ui.state, d, ui.plan[d])])); }

function cargoLine(dragon, id, c) {
  const spec = activeLevel().orders[id], order = c.orders[id];
  const delivered = ui.state.delivered[id];
  const pickup = ui.state.pickedUp[id];
  const status = delivered ? c.deliveredStatus : ui.state.orderStatus[id] === 'aboard' ? c.aboardStatus : c.waitingPickup;
  const timing = [formatPickupTiming(pickup, c), delivered ? text(c.deliveryTurn, { turn: delivered.turn }) : ''].filter(Boolean).join(' · ');
  return '<span class="dispatch-cargo-line ' + (delivered ? 'delivered' : '') + '"><b>' + esc(order.name) + '</b> <small>' + esc(status) + ' · ' + esc(order.recipient) + '</small><small>' + esc(orderDetail(spec, c)) + '</small>' + (timing ? '<em>' + esc(timing) + '</em>' : '') + '</span>';
}

function mapPanel(c, forecast, routes) {
  const copy = c.planner, level = activeLevel(), returnLevel = level.id === 'return', dragon = ui.selected, own = routes[dragon].state;
  const turnLimit = level.turnLimit, turn = Math.min(turnLimit, ui.state.turn + ui.plan[dragon].length + 1);
  const routeSlots = ui.plan[dragon].map((action, i) => '<li><span>' + esc(c.plannedTurn) + ' ' + (ui.state.turn + i + 1) + '</span><b>' + esc(actionText(action, c)) + '</b></li>').join('');
  const selectedCargo = ui.state.assignments[dragon].map(id => cargoLine(dragon, id, c)).join('') || '<span class="dispatch-cargo-empty">' + esc(c.noCargo) + '</span>';
  const selectors = DRAGONS.map(d => {
    const projected = routes[d].state, count = ui.plan[d].length;
    const cargo = ui.state.assignments[d].map(id => {
      const order = c.orders[id], spec = level.orders[id];
      const status = ui.state.orderStatus[id] === 'delivered' ? c.deliveredStatus : ui.state.orderStatus[id] === 'aboard' ? c.aboardStatus : c.waitingPickup;
      return order.name + ' · ' + status + ' · ' + order.recipient + ' · ' + orderDetail(spec, c);
    }).join(' · ') || c.noCargo;
    const ability = d === 'Ember' ? c.legendEmber : c.legendGale;
    const capacity = capacityForDragon(d), loaded = currentLoad(ui.state, d);
    const ariaLabel = [c.dragons[d], ability, c.actual + ': ' + c.locations[ui.state.locations[d]], c.loadedNow + ' ' + loaded + '/' + capacity, text(copy.plannedSteps, { count, max: turnLimit - ui.state.turn }), c.planned + ': ' + c.locations[projected.locations[d]] + ' · ' + c.staminaNow + ' ' + projected.stamina[d], c.responsible + ': ' + cargo].join(' · ');
    const stateLine = c.staminaNow + ' ' + ui.state.stamina[d] + ' · ' + c.loadedNow + ' ' + loaded + '/' + capacity + ' · ' + text(copy.plannedSteps, { count, max: turnLimit - ui.state.turn });
    return '<button type="button" class="dispatch-select ' + (dragon === d ? 'selected' : '') + '" data-action="dispatch-action" data-dispatch-action="select-dragon" data-dragon="' + d + '" data-focus-key="select-' + d + '" data-focus-group="dragon-select" aria-label="' + esc(ariaLabel) + '" aria-pressed="' + (dragon === d) + '"><strong class="dispatch-dragon-chip ' + d.toLowerCase() + '">' + d + '</strong><span>' + esc(stateLine) + '</span></button>';
  }).join('');
  const rationActions = [...ui.plan.Ember, ...ui.plan.Gale].filter(action => action.type === 'ration').length;
  const rationStatus = !ui.state.rationAvailable ? c.rationSpent : rationActions ? c.rationQueued : c.rationReady;
  const sealOwner = ui.state.sealedIce;
  const supplies = '<div class="dispatch-resource-strip" aria-label="' + esc(c.resources) + '"><strong>' + esc(c.resources) + '</strong><span>' + esc(rationStatus) + ' · +3 ' + esc(c.staminaNow) + '</span><span>' + esc(c.seal) + ' · ' + esc(sealOwner ? c.sealAttached : c.sealReserve) + '</span></div>';
  const routeSummary = '<div class="dispatch-route-summary"><div><strong>' + esc(copy.routeSteps) + '</strong><span>' + esc(text(copy.plannedSteps, { count: ui.plan[dragon].length, max: Math.max(0, turnLimit - ui.state.turn) })) + '</span></div>' + (routeSlots ? '<ol>' + routeSlots + '</ol>' : '<p>' + esc(copy.noRoute) + '</p>') + '<b>' + esc(text(copy.routeTail, { location: c.locations[own.locations[dragon]], stamina: own.stamina[dragon] })) + '</b></div>';
  const controlsFull = ui.state.status !== 'playing' || ui.plan[dragon].length >= turnLimit - ui.state.turn || ui.state.turn >= turnLimit;
  const quickActions = '<div class="dispatch-quick-actions" role="group" aria-label="' + esc(copy.quickActions) + '">' +
    '<button type="button" class="button light" data-action="dispatch-action" data-dispatch-action="queue-wait" data-focus-key="queue-wait" data-focus-group="quick-actions" ' + (controlsFull ? 'disabled' : '') + '>' + esc(c.wait) + '</button>' +
    '<button type="button" class="button light" data-action="dispatch-action" data-dispatch-action="queue-ration" data-focus-key="queue-ration" data-focus-group="quick-actions" ' + (controlsFull || !ui.state.rationAvailable || rationActions > 0 ? 'disabled' : '') + '>' + esc(c.ration) + '</button>' +
    '<button type="button" class="button light" data-action="dispatch-action" data-dispatch-action="queue-remove" data-dragon="' + dragon + '" data-focus-key="queue-remove" data-focus-group="quick-actions" ' + (!ui.plan[dragon].length ? 'disabled' : '') + '>' + esc(c.remove) + '</button>' +
    '<button type="button" class="button light" data-action="dispatch-action" data-dispatch-action="queue-clear" data-dragon="' + dragon + '" data-focus-key="queue-clear" data-focus-group="quick-actions" ' + (!ui.plan[dragon].length ? 'disabled' : '') + '>' + esc(c.clear) + '</button></div>';
  const roadRows = EDGES.map(edge => {
    const label = ({ road: c.legendRoad, ridge: c.legendRidge, canal: c.legendCanal, tunnel: c.legendTunnel, air: c.legendAir })[edge.type];
    const cost = edge.type === 'air' && [2, 3].includes(turn) ? 3 : edge.cost;
    return '<li><span>' + esc(c.locations[edge.a]) + ' ↔ ' + esc(c.locations[edge.b]) + ' · ' + esc(label) + '</span><strong>' + cost + ' ' + esc(c.staminaNow) + ' · 1 ' + esc(c.turnUnit) + ' · ' + esc(edgeStatus(edge, turn, c)) + '</strong></li>';
  }).join('');
  const roadDetails = '<details class="dispatch-road-details" data-details-key="roads"><summary data-focus-key="detail-roads">' + esc(copy.roadsDetails) + '</summary><ul class="dispatch-edge-list" aria-label="' + esc(c.mapEdges) + '">' + roadRows + '</ul></details>';
  const etaRows = Object.entries(level.orders).map(([id, spec]) => {
    const owner = ui.state.assignments.Ember.includes(id) ? 'Ember' : 'Gale';
    const independentPreviewAvailable = !forecast.issues.length || forecast.issues[0]?.code === 'unplanned_action';
    const delivery = ui.state.delivered[id] || forecast.state.delivered[id] || (independentPreviewAvailable ? routes[owner].state.delivered[id] : null);
    const pickup = ui.state.pickedUp[id] || forecast.state.pickedUp[id] || (independentPreviewAvailable ? routes[owner].state.pickedUp[id] : null);
    const value = [formatPickupTiming(pickup, c) || c.waitingPickup, delivery ? text(c.deliveryTurn, { turn: delivery.turn }) : ''].filter(Boolean).join(' → ');
    return '<div class="dispatch-eta-row ' + (delivery ? 'delivered' : '') + '"><span>' + esc(c.orders[id].name) + '<small>' + esc(c.responsible) + ' · ' + esc(c.dragons[owner]) + ' · ' + esc(orderDetail(spec, c)) + '</small></span><strong>' + esc(value) + '</strong></div>';
  }).join('');
  const warningItems = DRAGONS.flatMap(d => routes[d].warnings.map(warning => ({ ...warning, dragon: d })));
  const warningPanel = warningItems.length ? '<div class="dispatch-pickup-warnings" role="status"><strong>' + esc(c.pickupWarnings) + '</strong><ul>' + warningItems.map(warning => '<li>' + esc(eventText(warning, c)) + '</li>').join('') + '</ul></div>' : '';
  const statusInfo = formatPlannerStatus({ gameStatus: ui.state.status, noticeIssue: ui.noticeIssue, forecastIssue: forecast.issues[0], timeline: forecast.timeline, copy: c });
  const canExecute = ui.state.status === 'playing' && forecast.timeline.length > 0;
  const status = '<div class="dispatch-execution-status ' + (statusInfo.hasIssue ? 'has-issue' : '') + '" role="status" aria-live="polite">' + esc(statusInfo.line) + '</div>';
  const forecastState = evaluateDispatch(forecast.state);
  const forecastOutcome = forecast.issues.length ? '' : forecastState.status === 'won'
    ? '<div class="dispatch-success" role="status">' + esc(c.readyWin) + '</div>'
    : '<div class="dispatch-alert subtle" role="status">' + esc(c.unresolved) + '</div>';
  const toolbar = '<div class="dispatch-action-bar ' + (ui.state.status === 'playing' ? '' : 'is-terminal') + '">' + status + (ui.state.status === 'playing'
    ? '<div class="dispatch-action-buttons">' +
      '<button type="button" class="button" data-action="dispatch-action" data-dispatch-action="undo" data-focus-key="run-undo" data-focus-group="execution" ' + (!ui.history.length ? 'disabled' : '') + '>↶ ' + esc(copy.undoShort) + '</button>' +
      '<button type="button" class="button dark" data-action="dispatch-action" data-dispatch-action="run-next" data-focus-key="run-next" data-focus-group="execution" ' + (!canExecute ? 'disabled' : '') + '>' + esc(copy.nextShort) + ' →</button>' +
      '<button type="button" class="button yellow" data-action="dispatch-action" data-dispatch-action="run-plan" data-focus-key="run-plan" data-focus-group="execution" ' + (!canExecute ? 'disabled' : '') + '>' + esc(copy.planShort) + ' ⇥</button></div>'
    : '<div class="dispatch-action-buttons"><button type="button" class="button" data-action="dispatch-action" data-dispatch-action="undo" data-focus-key="run-undo" data-focus-group="execution" ' + (!ui.history.length ? 'disabled' : '') + '>↶ ' + esc(copy.undoShort) + '</button><button type="button" class="button dark" data-action="dispatch-action" data-dispatch-action="restart" data-focus-key="run-replan" data-focus-group="execution">' + esc(copy.replan) + '</button></div>') + '</div>';
  const marker = '<div class="dispatch-map-focus"><span>' + esc(c.actual) + ': <b>' + esc(c.locations[ui.state.locations[dragon]]) + '</b></span><span>' + esc(c.planned) + ': <b>' + esc(c.locations[own.locations[dragon]]) + '</b></span><span>' + esc(c.planningTurn) + ' <strong>' + Math.max(1, Math.min(turnLimit, turn)) + '</strong></span><span>' + esc(c.staminaNow) + ' <strong>' + own.stamina[dragon] + '</strong></span></div>';
  const currentError = ui.noticeIssue ? '<p class="dispatch-map-error" role="alert" aria-live="assertive">' + esc(detailError(ui.noticeIssue, c)) + '</p>' : '';
  const notice = ui.notice && !ui.noticeIssue ? '<p class="dispatch-notice" role="status" aria-live="polite">' + esc(ui.notice) + '</p>' : '';
  return '<section class="dispatch-panel dispatch-map-panel" aria-labelledby="dispatch-map-title"><div class="dispatch-panel-head"><span class="dispatch-step">02</span><div><h2 id="dispatch-map-title" tabindex="-1" data-focus-key="map-title">' + esc(c.mapTitle) + '</h2><p>' + esc(c.mapHint) + '</p></div></div>' +
    '<div class="dispatch-dragon-select" role="group" aria-label="' + esc(c.selectDragon) + '">' + selectors + '</div>' + supplies + marker + mapSVG(c, forecast, turn, routes) +
    '<p class="dispatch-map-turn-legend">' + esc(c.mapTurnLegend) + '</p>' + currentError + '<p class="dispatch-weather-summary"><strong>' + esc(copy.weatherTitle) + '</strong> ' + esc(copy.weatherSummary) + '</p>' + roadDetails +
    (returnLevel ? '<ul class="dispatch-return-rules">' + c.returnRules.map(rule => '<li>' + esc(rule) + '</li>').join('') + '</ul>' : '') +
    '<div class="dispatch-active-cargo"><strong>' + esc(c.cargoAssignment) + ' · ' + esc(c.dragons[dragon]) + ' · ' + esc(c.loadedNow) + ' ' + currentLoad(ui.state, dragon) + '/' + capacityForDragon(dragon) + '</strong>' + selectedCargo + '</div>' +
    routeSummary + quickActions + '<section class="dispatch-compact-preview" aria-labelledby="dispatch-compact-title"><h3 id="dispatch-compact-title">' + esc(c.preview) + '</h3><div class="dispatch-eta-list">' + etaRows + '</div>' + warningPanel + forecastOutcome + (ui.notice ? notice : '') + '</section>' + toolbar + '</section>';
}

function queuePanel(c) {
  const copy = c.planner, turnSlots = Math.max(activeLevel().turnLimit - ui.state.turn, 0);
  const rows = DRAGONS.map(dragon => {
    const projected = projectDragonRoute(ui.state, dragon, ui.plan[dragon]);
    const slots = Array.from({ length: turnSlots }, (_, i) => {
      const action = ui.plan[dragon][i], turn = ui.state.turn + i + 1;
      return '<li class="dispatch-slot ' + (action ? 'filled' : 'unplanned') + '" data-turn="' + turn + '"><span class="dispatch-slot-turn">' + turn + '</span><span class="dispatch-slot-action">' + esc(action ? actionText(action, c) : c.emptySlot) + '</span></li>';
    }).join('');
    return '<section class="dispatch-full-queue-row"><h3>' + esc(c.dragons[dragon]) + ' · ' + esc(c.actual) + ' ' + esc(c.locations[ui.state.locations[dragon]]) + ' → ' + esc(c.locations[projected.state.locations[dragon]]) + ' · ' + esc(c.staminaNow) + ' ' + ui.state.stamina[dragon] + ' → ' + projected.state.stamina[dragon] + '</h3><ol class="dispatch-slots">' + slots + '</ol></section>';
  }).join('');
  return '<details class="dispatch-panel dispatch-queues" data-details-key="queues"><summary data-focus-key="detail-queues">' + esc(copy.fullQueue) + '</summary>' + rows + '</details>';
}

function resultPanel(c) {
  if (ui.state.status === 'playing' || ui.state.status === 'setup') return '';
  const copy = c.planner, level = activeLevel(), returnLevel = level.id === 'return', won = ui.state.status === 'won', result = ui.state.result || {};
  const badge = result.badge === 'ice_dream_early' ? 'ice' : 'chorus';
  const deliveryRows = Object.entries(level.orders).map(([id, spec]) => {
    const delivery = ui.state.delivered[id], pickup = ui.state.pickedUp[id], carrier = delivery?.dragon || (ui.state.assignments.Ember.includes(id) ? 'Ember' : 'Gale');
    const missed = !delivery && result.code === 'order_late' && result.order === id;
    const actual = delivery ? copy.actualDelivery + ' ' + delivery.turn + ' · ' + copy.onTime :
      missed ? text(copy.missedAt, { turn: result.turn || spec.deadline }) : copy.notDelivered;
    const pickupText = formatPickupTiming(pickup, c) || c.notPickedUp;
    return '<li class="dispatch-result-delivery ' + (delivery ? 'delivered' : missed ? 'missed' : '') + '"><div><strong>' + esc(c.orders[id].name) + '</strong><small>' + esc(c.locations[spec.source]) + ' → ' + esc(c.locations[spec.destination]) + ' · ' + esc(c.orders[id].recipient) + '</small></div><span><b>' + esc(copy.carrier) + ':</b> ' + esc(c.dragons[carrier]) + '</span><span><b>' + esc(copy.deadline) + ':</b> ' + spec.deadline + ' · ' + esc(pickupText) + ' · ' + esc(actual) + '</span></li>';
  }).join('');
  const dragonRows = DRAGONS.map(dragon => {
    const home = ui.state.locations[dragon] === 'K';
    return '<li><strong>' + esc(c.dragons[dragon]) + '</strong><span>' + esc(c.locations[ui.state.locations[dragon]]) + ' · ' + esc(home ? c.endHome : c.endAway) + '</span><b>' + esc(c.staminaNow) + ' ' + ui.state.stamina[dragon] + '</b></li>';
  }).join('');
  const ration = ui.state.rationAvailable ? copy.rationKept : copy.rationUsed;
  const sealWasUsed = ui.state.sealedIce && ui.state.pickedUp.ice?.dragon === 'Ember';
  const supplies = '<p><strong>' + esc(ration) + '</strong></p><p><strong>' + esc(sealWasUsed ? copy.sealUsed : copy.sealKept) + '</strong></p>';
  const headline = won ? returnLevel ? c.returnTitle : (badge === 'ice' ? c.badgeIce : c.badgeChorus) : detailError(result, c) || c.planEnded;
  const eggsGoal = level.goals?.eggsBy;
  const goalOutcomes = returnGoalOutcomes(ui.state, eggsGoal);
  const goals = returnLevel ? '<p class="dispatch-result-goal-hint">' + esc(c.bonusGoalHint) + '</p><ul class="dispatch-result-goals">' + [[goalOutcomes.eggsByDeadline, text(c.returnGoalEggs, { turn: eggsGoal })], [goalOutcomes.rationUnused, c.returnGoalRation]].map(([passed, label]) => '<li class="' + (passed ? 'passed' : '') + '"><strong>' + (passed ? '✓' : '○') + '</strong> ' + esc(label) + ' · ' + esc(passed ? c.goalAchieved : c.goalMissed) + '</li>').join('') + '</ul>' : '';
  const badgeCopy = won ? '<p class="dispatch-result-badge">' + esc(headline) + '</p>' + (returnLevel ? '<p>' + esc(c.returnComplete) + '</p>' : '<p>' + esc(badge === 'ice' ? c.badgeIceDesc : c.badgeChorusDesc) + '</p><p class="dispatch-result-invite">' + esc(copy.tryOtherSplit) + '</p>') + goals : '<p class="dispatch-result-cause">' + esc(headline) + '</p>' + goals;
  return '<section class="dispatch-result ' + (won ? 'won' : 'lost') + '" aria-labelledby="dispatch-result-title"><div class="dispatch-result-top"><span class="dispatch-result-art" aria-hidden="true">' + (won ? '✦' : '↺') + '</span><div><span class="dispatch-result-kicker">ODDLAB / DISPATCH ' + ui.state.turn + '</span><h2 id="dispatch-result-title" tabindex="-1" data-focus-key="result-title">' + esc(won ? c.winTitle : c.loseTitle) + '</h2>' + badgeCopy + '<small>' + esc(c.resultTurn) + ' ' + ui.state.turn + ' / ' + level.turnLimit + '.</small></div></div><div class="dispatch-result-grid"><section><h3>' + esc(copy.finalDeliveries) + '</h3><ol class="dispatch-result-deliveries">' + deliveryRows + '</ol></section><section><h3>' + esc(copy.finalDragons) + '</h3><ul class="dispatch-result-dragons">' + dragonRows + '</ul><div class="dispatch-result-supplies"><h3>' + esc(copy.finalSupplies) + '</h3>' + supplies + '</div></section></div></section>';
}

function logPanel(c) {
  const events = ui.state.logs.slice(-14).reverse();
  const body = events.length ? '<ol>' + events.map(event => '<li class="dispatch-log-' + event.code + '"><span class="dispatch-log-turn">' + (event.turn ? esc(c.plannedTurn) + ' ' + event.turn : '!') + '</span><span>' + esc(eventText(event, c)) + '</span></li>').join('') + '</ol>' : '<p class="dispatch-empty-log">' + esc(c.noLog) + '</p>';
  return '<details class="dispatch-panel dispatch-log" data-details-key="log"><summary data-focus-key="detail-log">' + esc(c.logTitle) + ' · ' + ui.state.turn + '/' + activeLevel().turnLimit + '</summary>' + body + '</details>';
}

function rulesPanel(c) {
  const level = activeLevel();
  const rules = ui.state.levelId === 'return'
    ? [c.guideRules[0], c.guideRules[1], c.guideRules[3], c.guideRules[4], c.guideRules[5], ...c.returnRules, text(c.returnWinRule, { turn: level.turnLimit })]
    : c.guideRules;
  return '<details class="dispatch-rules" data-details-key="rules"><summary data-focus-key="detail-rules">' + esc(c.rulesTitle) + '</summary><ol>' + rules.map(rule => '<li>' + esc(rule) + '</li>').join('') + '</ol></details>';
}

function render() {
  const c = activeCopy();
  if (!ui.container) return;
  const active = typeof document === 'undefined' ? null : document.activeElement;
  const hadFocusInside = Boolean(active && ui.container.contains(active));
  const oldFocusKey = hadFocusInside ? active.dataset?.focusKey || null : null;
  const oldFocusGroup = hadFocusInside ? active.dataset?.focusGroup || null : null;
  const scrollPosition = typeof window === 'undefined' ? null : { x: window.scrollX, y: window.scrollY };
  const openDetails = new Set([...ui.container.querySelectorAll('details[open][data-details-key]')].map(node => node.dataset.detailsKey));
  const restoreScroll = position => {
    if (!position || typeof window === 'undefined') return;
    const root = document.documentElement, oldBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(position.x, position.y);
    root.style.scrollBehavior = oldBehavior;
  };
  const isSetup = ui.state.status === 'setup';
  const forecast = isSetup ? { state: ui.state, timeline: [], issues: [] } : simulatePlan(ui.state, ui.plan);
  const routes = isSetup ? null : projections();
  const tutorialCopy = ui.state.levelId === 'return' ? c.returnTutorial.map(rule => text(rule, { turn: activeLevel().turnLimit })) : c.tutorial;
  const tutorialTitle = ui.state.levelId === 'return' ? c.returnTutorialTitle : c.tutorialTitle;
  const tutorial = !ui.tutorialDismissed
    ? '<aside class="dispatch-tutorial"><div><strong>' + esc(tutorialTitle) + '</strong><ol>' + tutorialCopy.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol></div><button type="button" class="text-button" data-action="dispatch-action" data-dispatch-action="skip-tutorial" data-focus-key="skip-tutorial" data-focus-group="tutorial">' + esc(c.skip) + ' ×</button></aside>'
    : '';
  const emblem = '<span class="dispatch-emblem" aria-hidden="true"><svg viewBox="0 0 84 52"><path d="M5 35Q18 6 35 28Q46 3 65 13L79 8L73 20Q84 30 70 39Q55 48 42 35Q26 47 15 39Z" fill="#d1a947" stroke="#294b40" stroke-width="2.5"/><circle cx="65" cy="24" r="2.2" fill="#294b40"/><path d="M22 27Q23 11 37 18M47 20Q52 5 65 14" fill="none" stroke="#294b40" stroke-width="2"/></svg></span>';
  const setup = isSetup ? loadoutPanel(c) : '';
  const board = isSetup ? '' : '<section class="dispatch-workbench" aria-label="' + esc(c.routeBoard) + '">' + resultPanel(c) + mapPanel(c, forecast, routes) + queuePanel(c) + logPanel(c) + '</section>';
  const levelLinks = `<nav class="dispatch-levels" aria-label="${esc(c.chooseLevel)}">${[['first', c.levelFirst], ['return', c.levelReturn]].map(([id, label]) => `<a class="dispatch-level-choice ${ui.state.levelId === id ? 'selected' : ''}" data-dispatch-level="${id}" href="/dispatch${id === 'return' ? '?level=return' : ''}${id === 'return' ? '&' : '?'}lang=${encodeURIComponent(ui.lang)}" ${ui.state.levelId === id ? 'aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</nav>`;
  const title = ui.state.levelId === 'return' ? c.returnTitle : c.title;
  const subtitle = ui.state.levelId === 'return' ? c.returnSubtitle : c.subtitle;
  ui.container.innerHTML = '<div class="tool-wrap dispatch-game"><a class="back" href="/?lang=' + encodeURIComponent(ui.lang) + '">← ' + esc(c.back) + '</a><header class="dispatch-heading"><div class="dispatch-brandline">' + emblem + '<span>ODDLAB / ROUTE PUZZLE</span><span class="dispatch-duration">' + esc(c.duration) + '</span></div><h1>' + esc(title) + '</h1><p class="dispatch-subtitle">' + esc(subtitle) + '</p><p class="dispatch-pitch">' + esc(c.pitch) + '</p></header>' + levelLinks + tutorial + setup + board + rulesPanel(c) + '<button type="button" class="button dark dispatch-share" data-action="dispatch-action" data-dispatch-action="share" data-focus-key="share" data-focus-group="footer">' + esc(c.share) + ' ↗</button><a class="dispatch-archive" href="/life?lang=' + encodeURIComponent(ui.lang) + '">' + esc(c.archive) + '</a></div>';
  for (const node of ui.container.querySelectorAll('details[data-details-key]')) node.open = openDetails.has(node.dataset.detailsKey);
  let target = null;
  if (ui.pendingResultFocus) {
    target = [...ui.container.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === 'result-title') || null;
  } else if (ui.pendingFocusKey) {
    target = [...ui.container.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === ui.pendingFocusKey && !node.disabled) || null;
  } else if (hadFocusInside && oldFocusKey) {
    target = [...ui.container.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === oldFocusKey && !node.disabled) || null;
  }
  if (!target && hadFocusInside && oldFocusKey?.startsWith('assign-')) {
    const orderId = oldFocusKey.split('-')[1];
    target = [...ui.container.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey?.startsWith('assign-' + orderId + '-') && !node.disabled) || null;
  }
  if (!target && hadFocusInside && oldFocusGroup) {
    target = [...ui.container.querySelectorAll('[data-focus-group="' + oldFocusGroup + '"]')].find(node => !node.disabled) || null;
  }
  if (!target && (hadFocusInside || ui.pendingFocusKey || ui.pendingResultFocus)) {
    target = [...ui.container.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === 'select-' + ui.selected && !node.disabled) ||
      [...ui.container.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === 'start' && !node.disabled) ||
      [...ui.container.querySelectorAll('[data-focus-key]')].find(node => !node.disabled) || null;
  }
  if (target) {
    target.focus({ preventScroll: true });
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = reducedMotion ? 'auto' : 'smooth';
    if (ui.pendingResultFocus) target.scrollIntoView?.({ block: 'start', behavior: scrollBehavior });
    else if (ui.pendingFocusKey === 'map-title' || ui.pendingFocusKey === 'loadout-title') target.scrollIntoView?.({ block: 'start', behavior: scrollBehavior });
    else if (scrollPosition) restoreScroll(scrollPosition);
  } else if (hadFocusInside && scrollPosition) {
    restoreScroll(scrollPosition);
  }
  ui.pendingFocusKey = null;
  ui.pendingResultFocus = false;
}

function validateCandidate(plan) {
  for (const dragon of DRAGONS) {
    const projected = projectDragonRoute(ui.state, dragon, plan[dragon]);
    if (projected.issues.length) return projected.issues[0];
  }
  const forecast = simulatePlan(ui.state, plan);
  return forecast.issues[0]?.code === 'unplanned_action' ? null : (forecast.issues[0] || null);
}
function enqueue(dragon, action) {
  if (ui.state.status !== 'playing') return;
  const remaining = activeLevel().turnLimit - ui.state.turn;
  if (ui.plan[dragon].length >= remaining) return showNotice(ui.copy.turnLimit || ui.copy.error.turn_limit);
  const nextPlan = { Ember: [...ui.plan.Ember], Gale: [...ui.plan.Gale] };
  nextPlan[dragon].push(action);
  const issue = validateCandidate(nextPlan);
  if (issue) return showNotice(detailError(issue), issue);
  ui.plan = nextPlan; ui.notice = ''; ui.noticeIssue = null; render();
}
function removeLast(dragon) {
  const next = [...ui.plan[dragon]];
  next.pop();
  ui.plan = { ...ui.plan, [dragon]: next }; ui.notice = ''; ui.noticeIssue = null; render();
}
function advanceTurn() {
  if (ui.state.status !== 'playing' || (!ui.plan.Ember.length && !ui.plan.Gale.length)) return false;
  const previousStatus = ui.state.status;
  const isFinishedAtHome = dragon => ui.state.locations[dragon] === 'K' && ui.state.assignments[dragon].every(id => ui.state.orderStatus[id] === 'delivered');
  const actions = { Ember: ui.plan.Ember[0] || (isFinishedAtHome('Ember') ? { type: 'wait', automatic: true } : null), Gale: ui.plan.Gale[0] || (isFinishedAtHome('Gale') ? { type: 'wait', automatic: true } : null) };
  const result = stepDispatch(ui.state, actions);
  if (!result.ok) { ui.noticeIssue = result.issues[0]; ui.notice = detailError(result.issues[0]); return false; }
  ui.history.push(snapshotDispatchTurn(ui.state, ui.plan));
  ui.state = result.state;
  ui.plan = { Ember: ui.plan.Ember.slice(1), Gale: ui.plan.Gale.slice(1) };
  ui.notice = ''; ui.noticeIssue = null;
  if (previousStatus === 'playing' && (ui.state.status === 'won' || ui.state.status === 'lost')) ui.pendingResultFocus = true;
  return true;
}
function dispatchNext() {
  const advanced = advanceTurn();
  if (advanced || ui.notice) render();
}
function dispatchPlan() {
  let count = 0, blocked = false;
  while (count < activeLevel().turnLimit && ui.state.status === 'playing' && (ui.plan.Ember.length || ui.plan.Gale.length)) {
    if (!advanceTurn()) { blocked = Boolean(ui.notice); break; }
    count++;
  }
  if (count || blocked) render();
}
function undo() {
  const snapshot = ui.history.pop();
  const previous = snapshot && restoreDispatchTurn(snapshot);
  if (!previous) return;
  ui.state = previous.state; ui.plan = previous.plan; ui.notice = ''; ui.noticeIssue = null; render();
}
function mapNode(node, dragon) {
  if (ui.state.status !== 'playing') return;
  const selected = dragon || ui.selected;
  enqueue(selected, { type: 'move', to: node });
}

function handleClick(event) {
  const el = event.target.closest('[data-dispatch-action]');
  if (!el || !ui.container.contains(el)) return;
  const action = el.dataset.dispatchAction, dragon = el.dataset.dragon || ui.selected;
  if (action === 'map-node') { mapNode(el.dataset.node, dragon); return; }
  if (action === 'assign-order') {
    if (ui.state.status !== 'setup') return;
    const id = el.dataset.order;
    const assignments = Object.fromEntries(DRAGONS.map(d => [d, [...ui.state.assignments[d].filter(x => x !== id)]]));
    assignments[dragon].push(id);
    ui.state = createDispatchState({ levelId: ui.state.levelId, assignments, sealedIce: ui.state.sealedIce });
    ui.state.status = 'setup'; ui.notice = ''; ui.noticeIssue = null; render(); return;
  }
  if (action === 'toggle-seal') { ui.state.sealedIce = !ui.state.sealedIce; ui.notice = ''; ui.noticeIssue = null; render(); return; }
  if (action === 'start') {
    const validation = validateLoadout(ui.state.assignments, ui.state.sealedIce, ui.state.levelId);
    if (!validation.valid) { ui.notice = validation.issues.map(issue => detailError(issue)).join(' '); render(); return; }
    ui.state = createDispatchState({ assignments: ui.state.assignments, sealedIce: ui.state.sealedIce, levelId: ui.state.levelId });
    ui.plan = { Ember: [], Gale: [] }; ui.history = []; ui.notice = ''; ui.selected = 'Ember'; ui.pendingFocusKey = 'map-title'; render(); return;
  }
  if (action === 'select-dragon') { ui.selected = dragon; ui.notice = ''; ui.noticeIssue = null; render(); return; }
  if (action === 'queue-wait') { enqueue(dragon, { type: 'wait' }); return; }
  if (action === 'queue-ration') { enqueue(dragon, { type: 'ration' }); return; }
  if (action === 'queue-remove') { removeLast(dragon); return; }
  if (action === 'queue-clear') { ui.plan = { ...ui.plan, [dragon]: [] }; ui.notice = ''; ui.noticeIssue = null; render(); return; }
  if (action === 'run-next') { dispatchNext(); return; }
  if (action === 'run-plan') { dispatchPlan(); return; }
  if (action === 'undo') { undo(); return; }
  if (action === 'restart') { ui.state = createDispatchState({ levelId: ui.state.levelId }); ui.plan = { Ember: [], Gale: [] }; ui.history = []; ui.notice = ''; ui.noticeIssue = null; ui.selected = 'Ember'; ui.pendingFocusKey = 'loadout-title'; ui.pendingResultFocus = false; render(); return; }
  if (action === 'skip-tutorial') { ui.tutorialDismissed = true; render(); return; }
  if (action === 'share') { shareChallenge(); return; }
}
function handleKeydown(event) {
  const el = event.target.closest?.('.dispatch-map-node[data-dispatch-action="map-node"]');
  if (el && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); mapNode(el.dataset.node, el.dataset.dragon); }
}
async function shareChallenge() {
  const url = new URL('/dispatch', location.origin); url.searchParams.set('lang', ui.lang); if (ui.state.levelId === 'return') url.searchParams.set('level', 'return');
  try {
    if (navigator.share) { await navigator.share({ title: ui.state.levelId === 'return' ? activeCopy().returnTitle : activeCopy().title, url: url.href }); return; }
    await navigator.clipboard.writeText(url.href);
    showNotice(ui.copy.shareCopied);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    try { await navigator.clipboard.writeText(url.href); showNotice(ui.copy.shareCopied); }
    catch { showNotice(ui.copy.shareFailed); }
  }
}

export function mountDispatch(container, lang = 'en', levelId = 'first') {
  const requested = getDispatchLevel(levelId).id;
  if (ui.state.levelId !== requested) {
    ui.state = createDispatchState({ levelId: requested }); ui.plan = { Ember: [], Gale: [] }; ui.history = [];
    ui.selected = 'Ember'; ui.notice = ''; ui.noticeIssue = null;
  }
  ui.container = container;
  ui.lang = lang;
  ui.copy = dispatchCopy(lang);
  if (!container.dataset.dispatchBound) {
    container.addEventListener('click', handleClick);
    container.addEventListener('keydown', handleKeydown);
    container.dataset.dispatchBound = 'true';
  }
  render();
}

