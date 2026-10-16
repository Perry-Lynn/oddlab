import { createDispatchState, validateLoadout, simulatePlan, projectDragonRoute, stepDispatch, evaluateDispatch, snapshotDispatchTurn, restoreDispatchTurn, ORDERS, DRAGONS, LOCATIONS, EDGES } from './dispatch-logic.mjs';
import { dispatchCopy } from './dispatch-copy.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const dragonColor = { Ember: '#c45b42', Gale: '#4c7890' };
const point = { K: [130, 280], C: [355, 280], T: [585, 105], M: [585, 455], A: [835, 280] };
const coordinates = { 'K-C': ['M 130 280 L 355 280', 243, 256], 'C-T': ['M 355 280 L 585 105', 475, 175], 'C-M': ['M 355 280 L 585 455', 475, 385], 'M-A': ['M 585 455 L 835 280', 710, 384], 'C-A': ['M 355 280 Q 595 20 835 280', 735, 185] };

let ui = {
  copy: dispatchCopy('en'), lang: 'en',
  state: createDispatchState(), plan: { Ember: [], Gale: [] }, selected: 'Ember',
  history: [], tutorialDismissed: false, notice: '', noticeIssue: null, container: null, pendingFocusKey: null, pendingResultFocus: false,
};

function weight(orders) { return orders.reduce((n, id) => n + ORDERS[id].weight, 0); }
function text(template, vars = {}) { return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? '')); }
function names(c) { return { ...(c.locations || {}), ...(c.dragons || {}), ...Object.fromEntries(Object.entries(c.orders || {}).map(([id, order]) => [id, order.name])) }; }
function detailError(issue, c = ui.copy) {
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
function eventText(event, c = ui.copy) {
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

function loadoutPanel(c) {
  const assigned = DRAGONS.map(d => weight(ui.state.assignments[d]));
  const validation = validateLoadout(ui.state.assignments, ui.state.sealedIce);
  const errors = validation.issues.map(issue => `<li>${esc(detailError(issue, c))}</li>`).join('');
  return `<section class="dispatch-panel dispatch-loadout" aria-labelledby="dispatch-loadout-title">
    <div class="dispatch-panel-head"><span class="dispatch-step">01</span><div><h2 id="dispatch-loadout-title" tabindex="-1" data-focus-key="loadout-title">${esc(c.assignments)}</h2><p>${esc(c.loadoutMissing)}</p></div></div>
    <div class="dispatch-order-list">${Object.entries(ORDERS).map(([id, spec]) => {
      const assignedDragon = validation.owners[id]?.[0]; const order = c.orders[id];
      return `<article class="dispatch-order" data-order="${id}"><div class="dispatch-order-copy"><span class="dispatch-order-mark dispatch-order-${id}">${({ soup:'♨', ice:'✳', eggs:'◌' })[id]}</span><div><h3>${esc(order.name)}</h3><p>${esc(order.detail)}</p></div><span class="dispatch-weight">${spec.weight} ⚖</span></div><div class="dispatch-order-pick" role="group" aria-label="${esc(order.name)} · ${esc(c.selectDragon)}">${DRAGONS.map(dragon => `<button type="button" class="dispatch-pick ${assignedDragon === dragon ? `is-${dragon.toLowerCase()}` : ''}" data-action="dispatch-action" data-dispatch-action="assign-order" data-order="${id}" data-dragon="${dragon}" data-focus-key="assign-${id}-${dragon}" data-focus-group="assign-${id}" aria-pressed="${assignedDragon === dragon}">${esc(c.dragons[dragon])}</button>`).join('')}</div></article>`;
    }).join('')}</div>
    <div class="dispatch-capacity-row">${DRAGONS.map((d, i) => `<div class="dispatch-capacity"><span>${esc(c.dragons[d])} · ${esc(c.capacity)}</span><strong class="${assigned[i] > (d === 'Ember' ? 3 : 2) ? 'is-over' : ''}">${assigned[i]} / ${d === 'Ember' ? 3 : 2}</strong></div>`).join('')}</div>
    <div class="dispatch-seal-row"><div><strong>${esc(c.seal)}</strong><p>${esc(c.sealHelp)}</p></div><button type="button" class="button ${ui.state.sealedIce ? 'dark' : 'light'}" data-action="dispatch-action" data-dispatch-action="toggle-seal" data-focus-key="toggle-seal" data-focus-group="setup-controls" aria-pressed="${ui.state.sealedIce}">${esc(ui.state.sealedIce ? c.sealOn : c.sealOff)}</button></div>
    ${errors ? `<ul class="dispatch-errors" role="status">${errors}</ul>` : `<p class="dispatch-valid">${esc(c.loadoutReady)}</p>`}
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
  const nodeCopy = c.locations;
  const lines = EDGES.map(edge => {
    const [path, lx, ly] = coordinates[edge.id];
    const typeLabel = ({ road: c.legendRoad, ridge: c.legendRidge, canal: c.legendCanal, tunnel: c.legendTunnel, air: c.legendAir })[edge.type];
    const cost = edge.type === 'air' && [2, 3].includes(selectedTurn) ? 3 : edge.cost;
    const status = edgeStatus(edge, selectedTurn, c);
    return `<g class="dispatch-edge dispatch-edge-${edge.type}"><path d="${path}" class="dispatch-edge-line"/><rect x="${lx - 88}" y="${ly - 27}" width="176" height="54" rx="7" class="dispatch-edge-label-bg"/><text x="${lx}" y="${ly - 7}" class="dispatch-edge-cost" text-anchor="middle">${cost}⚡ · 1T</text><text x="${lx}" y="${ly + 21}" class="dispatch-edge-note" text-anchor="middle">${esc(status)}</text><title>${esc(typeLabel)} — ${esc(status)}</title></g>`;
  }).join('');
  const nodes = LOCATIONS.map(id => {
    const [x, y] = point[id];
    const building = ({ K:'⌂', C:'✣', T:'♜', M:'≈', A:'▤' })[id];
    const actual = DRAGONS.filter(d => ui.state.locations[d] === id).map((d, i) => dragonGlyph(d, x + (DRAGONS.length > 1 && ui.state.locations.Ember === ui.state.locations.Gale ? (d === 'Ember' ? -21 : 21) : 0), y - 45));
    const plannedEmber = projections.Ember.state.locations.Ember, plannedGale = projections.Gale.state.locations.Gale;
    const markers = DRAGONS.map(d => projections[d].state.locations[d] === id ? dragonGlyph(d, x + (plannedEmber === plannedGale ? (d === 'Ember' ? -21 : 21) : 0), y + 47, true) : '').join('');
    return `<g class="dispatch-map-node" role="button" tabindex="0" data-action="dispatch-action" data-dispatch-action="map-node" data-node="${id}" data-dragon="${ui.selected}" data-focus-key="map-${id}" data-focus-group="map" aria-label="${esc(nodeCopy[id])}"><circle cx="${x}" cy="${y}" r="41" class="dispatch-node-ring"/><circle cx="${x}" cy="${y}" r="32" class="dispatch-node-core"/><text x="${x}" y="${y + 9}" class="dispatch-node-icon" text-anchor="middle">${building}</text><text x="${x}" y="${y + 112}" class="dispatch-node-name" text-anchor="middle">${esc(nodeCopy[id])}</text>${actual.join('')}${markers}</g>`;
  }).join('');
  return `<svg class="dispatch-map" viewBox="0 0 960 620" role="group" aria-label="${esc(c.mapTitle)}"><title>${esc(c.mapTitle)}</title><defs><pattern id="dispatch-water" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 Q3 2 6 6T12 6" fill="none" stroke="#87aeb2" stroke-width="1" opacity=".55"/></pattern></defs><path d="M355 286 Q400 380 585 456L835 280" fill="none" stroke="url(#dispatch-water)" stroke-width="28" opacity=".27"/>${lines}${nodes}</svg>`;
}

function projections() { return Object.fromEntries(DRAGONS.map(d => [d, projectDragonRoute(ui.state, d, ui.plan[d])])); }

function cargoLine(dragon, id, c) {
  const spec = ORDERS[id], order = c.orders[id];
  const delivered = ui.state.delivered[id];
  const delivery = delivered ? ' · ' + c.deliveredAt + ' ' + delivered.turn : '';
  return '<span class="dispatch-cargo-line ' + (delivered ? 'delivered' : '') + '"><b>' + esc(order.name) + '</b> → ' + esc(order.recipient) + ' · ' + esc(c.locations[spec.destination]) + ' · ' + esc(c.deadline) + ' ' + spec.deadline + (delivery ? '<em>' + esc(delivery) + '</em>' : '') + '</span>';
}

function mapPanel(c, forecast, routes) {
  const copy = c.planner, dragon = ui.selected, own = routes[dragon].state;
  const turn = Math.min(6, ui.state.turn + ui.plan[dragon].length + 1);
  const routeSlots = ui.plan[dragon].map((action, i) => '<li><span>' + esc(c.plannedTurn) + ' ' + (ui.state.turn + i + 1) + '</span><b>' + esc(actionText(action, c)) + '</b></li>').join('');
  const selectedCargo = ui.state.assignments[dragon].map(id => cargoLine(dragon, id, c)).join('') || '<span class="dispatch-cargo-empty">' + esc(c.noCargo) + '</span>';
  const selectors = DRAGONS.map(d => {
    const projected = routes[d].state, count = ui.plan[d].length;
    const cargo = ui.state.assignments[d].map(id => {
      const order = c.orders[id], spec = ORDERS[id];
      return order.name + ' → ' + order.recipient + ' · ' + c.locations[spec.destination] + ' · ' + c.deadline + ' ' + spec.deadline;
    }).join(' · ') || c.noCargo;
    const ability = d === 'Ember' ? c.legendEmber : c.legendGale;
    const ariaLabel = [c.dragons[d], ability, c.actual + ': ' + c.locations[ui.state.locations[d]], c.staminaNow + ' ' + ui.state.stamina[d], text(copy.plannedSteps, { count, max: 6 - ui.state.turn }), c.planned + ': ' + c.locations[projected.locations[d]] + ' · ' + c.staminaNow + ' ' + projected.stamina[d], cargo].join(' · ');
    const stateLine = c.staminaNow + ' ' + ui.state.stamina[d] + ' · ' + text(copy.plannedSteps, { count, max: 6 - ui.state.turn });
    return '<button type="button" class="dispatch-select ' + (dragon === d ? 'selected' : '') + '" data-action="dispatch-action" data-dispatch-action="select-dragon" data-dragon="' + d + '" data-focus-key="select-' + d + '" data-focus-group="dragon-select" aria-label="' + esc(ariaLabel) + '" aria-pressed="' + (dragon === d) + '"><strong class="dispatch-dragon-chip ' + d.toLowerCase() + '">' + d + '</strong><span>' + esc(stateLine) + '</span></button>';
  }).join('');
  const rationActions = [...ui.plan.Ember, ...ui.plan.Gale].filter(action => action.type === 'ration').length;
  const rationStatus = !ui.state.rationAvailable ? c.rationSpent : rationActions ? c.rationQueued : c.rationReady;
  const sealOwner = ui.state.sealedIce;
  const supplies = '<div class="dispatch-resource-strip" aria-label="' + esc(c.resources) + '"><strong>' + esc(c.resources) + '</strong><span>' + esc(rationStatus) + ' · +3 ' + esc(c.staminaNow) + '</span><span>' + esc(c.seal) + ' · ' + esc(sealOwner ? c.sealAttached : c.sealReserve) + '</span></div>';
  const routeSummary = '<div class="dispatch-route-summary"><div><strong>' + esc(copy.routeSteps) + '</strong><span>' + esc(text(copy.plannedSteps, { count: ui.plan[dragon].length, max: Math.max(0, 6 - ui.state.turn) })) + '</span></div>' + (routeSlots ? '<ol>' + routeSlots + '</ol>' : '<p>' + esc(copy.noRoute) + '</p>') + '<b>' + esc(text(copy.routeTail, { location: c.locations[own.locations[dragon]], stamina: own.stamina[dragon] })) + '</b></div>';
  const controlsFull = ui.state.status !== 'playing' || ui.plan[dragon].length >= 6 - ui.state.turn || ui.state.turn >= 6;
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
  const etaRows = Object.entries(ORDERS).map(([id, spec]) => {
    const owner = ui.state.assignments.Ember.includes(id) ? 'Ember' : 'Gale';
    const independentPreviewAvailable = !forecast.issues.length || forecast.issues[0]?.code === 'unplanned_action';
    const delivery = ui.state.delivered[id] || forecast.state.delivered[id] || (independentPreviewAvailable ? routes[owner].state.delivered[id] : null);
    const value = delivery ? c.deliveredAt + ' ' + delivery.turn : c.notScheduled;
    return '<div class="dispatch-eta-row ' + (delivery ? 'delivered' : '') + '"><span>' + esc(c.orders[id].name) + '<small>' + esc(c.orders[id].recipient) + ' · ' + esc(c.deadline) + ' ' + spec.deadline + '</small></span><b>' + esc(c.dragons[owner]) + '</b><strong>' + esc(value) + '</strong></div>';
  }).join('');
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
  const marker = '<div class="dispatch-map-focus"><span>' + esc(c.actual) + ': <b>' + esc(c.locations[ui.state.locations[dragon]]) + '</b></span><span>' + esc(c.planned) + ': <b>' + esc(c.locations[own.locations[dragon]]) + '</b></span><span>' + esc(c.planningTurn) + ' <strong>' + Math.max(1, Math.min(6, turn)) + '</strong></span><span>' + esc(c.staminaNow) + ' <strong>' + own.stamina[dragon] + '</strong></span></div>';
  const currentError = ui.noticeIssue ? '<p class="dispatch-map-error" role="alert" aria-live="assertive">' + esc(detailError(ui.noticeIssue, c)) + '</p>' : '';
  const notice = ui.notice && !ui.noticeIssue ? '<p class="dispatch-notice" role="status" aria-live="polite">' + esc(ui.notice) + '</p>' : '';
  return '<section class="dispatch-panel dispatch-map-panel" aria-labelledby="dispatch-map-title"><div class="dispatch-panel-head"><span class="dispatch-step">02</span><div><h2 id="dispatch-map-title" tabindex="-1" data-focus-key="map-title">' + esc(c.mapTitle) + '</h2><p>' + esc(c.mapHint) + '</p></div></div>' +
    '<div class="dispatch-dragon-select" role="group" aria-label="' + esc(c.selectDragon) + '">' + selectors + '</div>' + supplies + marker + mapSVG(c, forecast, turn, routes) +
    currentError + '<p class="dispatch-weather-summary"><strong>' + esc(copy.weatherTitle) + '</strong> ' + esc(copy.weatherSummary) + '</p>' + roadDetails +
    '<div class="dispatch-active-cargo"><strong>' + esc(c.cargoAssignment) + ' · ' + esc(c.dragons[dragon]) + '</strong>' + selectedCargo + '</div>' +
    routeSummary + quickActions + '<section class="dispatch-compact-preview" aria-labelledby="dispatch-compact-title"><h3 id="dispatch-compact-title">' + esc(c.preview) + '</h3><div class="dispatch-eta-list">' + etaRows + '</div>' + forecastOutcome + (ui.notice ? notice : '') + '</section>' + toolbar + '</section>';
}

function queuePanel(c) {
  const copy = c.planner, turnSlots = Math.max(6 - ui.state.turn, 0);
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
  const copy = c.planner, won = ui.state.status === 'won', result = ui.state.result || {};
  const badge = result.badge === 'ice_dream_early' ? 'ice' : 'chorus';
  const deliveryRows = Object.entries(ORDERS).map(([id, spec]) => {
    const delivery = ui.state.delivered[id], carrier = delivery?.dragon || (ui.state.assignments.Ember.includes(id) ? 'Ember' : 'Gale');
    const missed = !delivery && result.code === 'order_late' && result.order === id;
    const actual = delivery ? copy.actualDelivery + ' ' + delivery.turn + ' · ' + copy.onTime :
      missed ? text(copy.missedAt, { turn: result.turn || spec.deadline }) : copy.notDelivered;
    return '<li class="dispatch-result-delivery ' + (delivery ? 'delivered' : missed ? 'missed' : '') + '"><div><strong>' + esc(c.orders[id].name) + '</strong><small>' + esc(c.orders[id].recipient) + ' → ' + esc(c.locations[spec.destination]) + '</small></div><span><b>' + esc(copy.carrier) + ':</b> ' + esc(c.dragons[carrier]) + '</span><span><b>' + esc(copy.deadline) + ':</b> ' + spec.deadline + ' · ' + esc(actual) + '</span></li>';
  }).join('');
  const dragonRows = DRAGONS.map(dragon => {
    const home = ui.state.locations[dragon] === 'K';
    return '<li><strong>' + esc(c.dragons[dragon]) + '</strong><span>' + esc(c.locations[ui.state.locations[dragon]]) + ' · ' + esc(home ? c.endHome : c.endAway) + '</span><b>' + esc(c.staminaNow) + ' ' + ui.state.stamina[dragon] + '</b></li>';
  }).join('');
  const ration = ui.state.rationAvailable ? copy.rationKept : copy.rationUsed;
  const sealWasUsed = ui.state.sealedIce && ui.state.assignments.Ember.includes('ice');
  const supplies = '<p><strong>' + esc(ration) + '</strong></p><p><strong>' + esc(sealWasUsed ? copy.sealUsed : copy.sealKept) + '</strong></p>';
  const headline = won ? (badge === 'ice' ? c.badgeIce : c.badgeChorus) : detailError(result, c) || c.planEnded;
  const badgeCopy = won ? '<p class="dispatch-result-badge">' + esc(headline) + '</p><p>' + esc(badge === 'ice' ? c.badgeIceDesc : c.badgeChorusDesc) + '</p><p class="dispatch-result-invite">' + esc(copy.tryOtherSplit) + '</p>' : '<p class="dispatch-result-cause">' + esc(headline) + '</p>';
  return '<section class="dispatch-result ' + (won ? 'won' : 'lost') + '" aria-labelledby="dispatch-result-title"><div class="dispatch-result-top"><span class="dispatch-result-art" aria-hidden="true">' + (won ? '✦' : '↺') + '</span><div><span class="dispatch-result-kicker">ODDLAB / DISPATCH ' + ui.state.turn + '</span><h2 id="dispatch-result-title" tabindex="-1" data-focus-key="result-title">' + esc(won ? c.winTitle : c.loseTitle) + '</h2>' + badgeCopy + '<small>' + esc(c.resultTurn) + ' ' + ui.state.turn + '.</small></div></div><div class="dispatch-result-grid"><section><h3>' + esc(copy.finalDeliveries) + '</h3><ol class="dispatch-result-deliveries">' + deliveryRows + '</ol></section><section><h3>' + esc(copy.finalDragons) + '</h3><ul class="dispatch-result-dragons">' + dragonRows + '</ul><div class="dispatch-result-supplies"><h3>' + esc(copy.finalSupplies) + '</h3>' + supplies + '</div></section></div></section>';
}

function logPanel(c) {
  const events = ui.state.logs.slice(-14).reverse();
  const body = events.length ? '<ol>' + events.map(event => '<li class="dispatch-log-' + event.code + '"><span class="dispatch-log-turn">' + (event.turn ? esc(c.plannedTurn) + ' ' + event.turn : '!') + '</span><span>' + esc(eventText(event, c)) + '</span></li>').join('') + '</ol>' : '<p class="dispatch-empty-log">' + esc(c.noLog) + '</p>';
  return '<details class="dispatch-panel dispatch-log" data-details-key="log"><summary data-focus-key="detail-log">' + esc(c.logTitle) + ' · ' + ui.state.turn + '/6</summary>' + body + '</details>';
}

function rulesPanel(c) {
  return '<details class="dispatch-rules" data-details-key="rules"><summary data-focus-key="detail-rules">' + esc(c.rulesTitle) + '</summary><ol>' + c.guideRules.map(rule => '<li>' + esc(rule) + '</li>').join('') + '</ol></details>';
}

function render() {
  const c = ui.copy;
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
  const tutorial = !ui.tutorialDismissed
    ? '<aside class="dispatch-tutorial"><div><strong>' + esc(c.tutorialTitle) + '</strong><ol>' + c.tutorial.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol></div><button type="button" class="text-button" data-action="dispatch-action" data-dispatch-action="skip-tutorial" data-focus-key="skip-tutorial" data-focus-group="tutorial">' + esc(c.skip) + ' ×</button></aside>'
    : '';
  const emblem = '<span class="dispatch-emblem" aria-hidden="true"><svg viewBox="0 0 84 52"><path d="M5 35Q18 6 35 28Q46 3 65 13L79 8L73 20Q84 30 70 39Q55 48 42 35Q26 47 15 39Z" fill="#d1a947" stroke="#294b40" stroke-width="2.5"/><circle cx="65" cy="24" r="2.2" fill="#294b40"/><path d="M22 27Q23 11 37 18M47 20Q52 5 65 14" fill="none" stroke="#294b40" stroke-width="2"/></svg></span>';
  const setup = isSetup ? loadoutPanel(c) : '';
  const board = isSetup ? '' : '<section class="dispatch-workbench" aria-label="' + esc(c.routeBoard) + '">' + resultPanel(c) + mapPanel(c, forecast, routes) + queuePanel(c) + logPanel(c) + '</section>';
  ui.container.innerHTML = '<div class="tool-wrap dispatch-game"><a class="back" href="/?lang=' + encodeURIComponent(ui.lang) + '">← ' + esc(c.back) + '</a><header class="dispatch-heading"><div class="dispatch-brandline">' + emblem + '<span>ODDLAB / ROUTE PUZZLE</span><span class="dispatch-duration">' + esc(c.duration) + '</span></div><h1>' + esc(c.title) + '</h1><p class="dispatch-subtitle">' + esc(c.subtitle) + '</p><p class="dispatch-pitch">' + esc(c.pitch) + '</p></header>' + tutorial + setup + board + rulesPanel(c) + '<button type="button" class="button dark dispatch-share" data-action="dispatch-action" data-dispatch-action="share" data-focus-key="share" data-focus-group="footer">' + esc(c.share) + ' ↗</button><a class="dispatch-archive" href="/life?lang=' + encodeURIComponent(ui.lang) + '">' + esc(c.archive) + '</a></div>';
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
  const remaining = 6 - ui.state.turn;
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
  const actions = { Ember: ui.plan.Ember[0] || (ui.state.locations.Ember === 'K' && ui.state.held.Ember.length === 0 ? { type: 'wait', automatic: true } : null), Gale: ui.plan.Gale[0] || (ui.state.locations.Gale === 'K' && ui.state.held.Gale.length === 0 ? { type: 'wait', automatic: true } : null) };
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
  while (count < 6 && ui.state.status === 'playing' && (ui.plan.Ember.length || ui.plan.Gale.length)) {
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
    ui.state.assignments = { ...ui.state.assignments, [dragon]: [...ui.state.assignments[dragon].filter(x => x !== id), id] };
    for (const d of DRAGONS) if (d !== dragon) ui.state.assignments[d] = ui.state.assignments[d].filter(x => x !== id);
    ui.state.held = structuredClone(ui.state.assignments);
    ui.state.orderStatus[id] = 'aboard'; ui.notice = ''; ui.noticeIssue = null; render(); return;
  }
  if (action === 'toggle-seal') { ui.state.sealedIce = !ui.state.sealedIce; ui.notice = ''; ui.noticeIssue = null; render(); return; }
  if (action === 'start') {
    const validation = validateLoadout(ui.state.assignments, ui.state.sealedIce);
    if (!validation.valid) { ui.notice = validation.issues.map(issue => detailError(issue)).join(' '); render(); return; }
    ui.state = createDispatchState({ assignments: ui.state.assignments, sealedIce: ui.state.sealedIce });
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
  if (action === 'restart') { ui.state = createDispatchState(); ui.plan = { Ember: [], Gale: [] }; ui.history = []; ui.notice = ''; ui.noticeIssue = null; ui.selected = 'Ember'; ui.pendingFocusKey = 'loadout-title'; ui.pendingResultFocus = false; render(); return; }
  if (action === 'skip-tutorial') { ui.tutorialDismissed = true; render(); return; }
  if (action === 'share') { shareChallenge(); return; }
}
function handleKeydown(event) {
  const el = event.target.closest?.('.dispatch-map-node[data-dispatch-action="map-node"]');
  if (el && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); mapNode(el.dataset.node, el.dataset.dragon); }
}
async function shareChallenge() {
  const url = new URL('/dispatch', location.origin); url.searchParams.set('lang', ui.lang);
  try {
    if (navigator.share) { await navigator.share({ title: ui.copy.title, url: url.href }); return; }
    await navigator.clipboard.writeText(url.href);
    showNotice(ui.copy.shareCopied);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    try { await navigator.clipboard.writeText(url.href); showNotice(ui.copy.shareCopied); }
    catch { showNotice(ui.copy.shareFailed); }
  }
}

export function mountDispatch(container, lang = 'en') {
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

