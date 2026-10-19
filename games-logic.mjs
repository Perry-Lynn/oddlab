import { calculatePersona } from './logic.mjs';

export function previewPersonaAnswer(answers, questionIndex, answerIndex, pack) {
  if (!Array.isArray(answers) || answers.length !== pack.questions.length ||
      !Number.isInteger(questionIndex) || !pack.questions[questionIndex]?.options[answerIndex]) {
    throw new Error('A completed answer set and a valid answer are required.');
  }
  const proposedAnswers = [...answers];
  proposedAnswers[questionIndex] = answerIndex;
  return {
    questionIndex,
    answerIndex,
    previousId: calculatePersona(answers, pack),
    nextId: calculatePersona(proposedAnswers, pack),
    proposedAnswers,
  };
}

export function adoptPersonaPreview(answers, preview) {
  if (!preview || !Array.isArray(preview.proposedAnswers)) throw new Error('Invalid preview.');
  return [...preview.proposedAnswers];
}

const clone = value => structuredClone(value);
const addResource = (resources, delta) => {
  for (const key of ['time', 'favor']) resources[key] += Number(delta?.[key] || 0);
  if (resources.time < 0 || resources.favor < 0) throw new Error('A choice cannot spend unavailable resources.');
  return resources;
};

export function createAdventure(theme) {
  return { theme, stage: 0, resources: { time: 4, favor: 2 }, choices: [], history: [], done: false };
}

export function adventureChoiceAvailable(state, choice) {
  return (state.resources.time >= Number(choice.cost?.time || 0) &&
    state.resources.favor >= Number(choice.cost?.favor || 0));
}

export function chooseAdventure(state, choice, scene) {
  if (state.done || state.stage >= 3 || !scene || !scene.choices.some(x => x.id === choice.id) || !adventureChoiceAvailable(state, choice)) {
    throw new Error('That story choice is not available.');
  }
  const next = clone(state);
  const before = { stage: next.stage, resources: { ...next.resources } };
  next.resources.time -= Number(choice.cost?.time || 0);
  next.resources.favor -= Number(choice.cost?.favor || 0);
  addResource(next.resources, choice.gain);
  next.choices.push(choice.id);
  next.history.push({ stage: next.stage, choiceId: choice.id, resourcesBefore: before.resources, resourcesAfter: { ...next.resources } });
  next.stage++;
  next.done = next.stage === 3;
  return next;
}

export function undoLastAdventureChoice(state) {
  if (!state.history.length) return clone(state);
  const next = clone(state);
  const last = next.history.pop();
  next.choices.pop();
  next.stage = last.stage;
  next.resources = { ...last.resourcesBefore };
  next.done = false;
  return next;
}

export function adventureEndingId(state, themeContent) {
  if (!state.done || state.choices.length !== 3) return null;
  return themeContent.endingRoutes[state.choices.join('|')];
}

export function createChoiceRound(items) {
  if (!Array.isArray(items) || items.length < 2 || items.length > 16) throw new Error('Choose 2–16 candidates.');
  const original = items.map((text, index) => ({ index, text }));
  return { original, active: original.map(x => x.index), pair: [], records: [], undo: null, result: null };
}

export function drawChoicePair(round, random = Math.random) {
  if (round.active.length < 2) return { ...round, pair: [] };
  const indices = [...round.active];
  const a = Math.floor(random() * indices.length);
  const [first] = indices.splice(a, 1);
  const second = indices[Math.floor(random() * indices.length)];
  return { ...round, pair: [first, second] };
}

export function resolveChoicePair(round, keepIndex = null) {
  if (round.pair.length !== 2 || (keepIndex !== null && !round.pair.includes(keepIndex))) throw new Error('Draw a pair first.');
  const byIndex = new Map(round.original.map(item => [item.index, item.text]));
  const next = clone(round);
  next.undo = { active: [...round.active], records: clone(round.records), pair: [...round.pair], result: round.result };
  const dropped = keepIndex === null ? [...round.pair] : round.pair.filter(index => index !== keepIndex);
  next.active = round.active.filter(index => !dropped.includes(index));
  next.records.push({ keptIndex: keepIndex, kept: keepIndex === null ? null : byIndex.get(keepIndex), dropped: dropped.map(index => byIndex.get(index)), droppedIndices: dropped });
  next.pair = [];
  return next;
}

export function undoChoiceRound(round) {
  if (!round.undo) return clone(round);
  return { ...clone(round), active: [...round.undo.active], records: clone(round.undo.records), pair: [...round.undo.pair], result: round.undo.result, undo: null };
}

export function restoreChoiceRound(round) {
  return { ...clone(round), active: round.original.map(x => x.index), pair: [], records: [], result: null, undo: null };
}

export function acceptChoiceRound(round) {
  if (round.active.length !== 1) throw new Error('One candidate must remain.');
  return { ...clone(round), result: round.original.find(x => x.index === round.active[0]) };
}

export function taskCompletion(saved, id, allow = true) {
  const doneIds = Array.isArray(saved?.doneIds) ? [...new Set(saved.doneIds)] : [];
  if (allow && !doneIds.includes(id)) doneIds.push(id);
  return { ...saved, doneIds };
}

