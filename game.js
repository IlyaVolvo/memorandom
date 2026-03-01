/**
 * Memorandom - Word Memory Training Game
 *
 * Design: Study / Answer phases with persistent rectangles
 * - Study: words shown in rectangles 1,2,3... one at a time, Ready to advance
 * - Answer: user fills rectangles, Ready to submit
 * - Rules: -1 lifeline per missing word; 2 pts correct place; 1 pt wrong place
 * - Replay: before round N, replay rounds 1..N-1 (points × distance)
 */

let WORD_GROUPS = [];
const STORAGE_KEY = 'memorandom-settings';
const DEFAULT_SETTINGS = {
  lifelines: 5,
  initialWords: 3,
  secondsPerWord: 2,
  attemptsPerRound: 4,
  maxComplexity: 1,
  selectedCategories: [],
  mix: false
};

function loadStoredSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Could not load stored settings', e);
  }
  return null;
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    showSavedHint();
    return true;
  } catch (e) {
    console.warn('Could not save settings', e);
    return false;
  }
}

function showSavedHint() {
  const el = document.getElementById('settings-saved-hint');
  if (!el) return;
  el.textContent = 'Saved';
  el.classList.add('visible');
  clearTimeout(showSavedHint._tid);
  showSavedHint._tid = setTimeout(() => el.classList.remove('visible'), 2000);
}

function applySettingsToForm(settings) {
  document.getElementById('lifelines').value = settings.lifelines;
  document.getElementById('initial-words').value = settings.initialWords;
  document.getElementById('seconds-per-word').value = settings.secondsPerWord;
  document.getElementById('attempts-per-round').value = settings.attemptsPerRound;
  document.getElementById('max-complexity').value = settings.maxComplexity;
  document.getElementById('mix-mode').checked = !!settings.mix;
  const selected = settings.selectedCategories || [];
  const container = document.getElementById('category-checkboxes');
  if (container) {
    container.querySelectorAll('input[data-category]').forEach(cb => {
      cb.checked = selected.length === 0 || selected.includes(cb.dataset.category);
    });
  }
}

function getCategoryNames() {
  return (WORD_GROUPS || []).map(g => g.category).filter(Boolean);
}

let config = {};
let state = {
  lifelines: 0,
  points: 0,
  round: 0,
  attempt: 0,
  roundWords: [],
  currentRoundWords: [],
  phase: 'start',
  mode: 'study',
  wordCount: 0,
  slotFeedback: [],
  wordStats: [],
  replayRoundIndex: -1
};

const elements = {};

async function loadWordGroups() {
  try {
    const res = await fetch('word-groups.json');
    WORD_GROUPS = await res.json();
  } catch (e) {
    console.warn('Could not load word-groups.json', e);
  }
}

function buildWordData(maxComplexity, selectedCategories, mix) {
  const categories = selectedCategories?.length ? selectedCategories : getCategoryNames();
  const categorySets = [];
  const allWords = [];
  for (const group of WORD_GROUPS) {
    if (!categories.includes(group.category)) continue;
    for (const set of group.sets || []) {
      if (set.complexity <= maxComplexity && set.list?.length >= 6) {
        const words = [...set.list];
        categorySets.push(words);
        if (mix) allWords.push(...words);
      }
    }
  }
  return { categorySets, allWords };
}

function isLocalStorageAvailable() {
  try {
    const k = '__memorandom_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function buildCategoryCheckboxes() {
  const container = document.getElementById('category-checkboxes');
  if (!container) return;
  container.innerHTML = '';
  for (const cat of getCategoryNames()) {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.category = cat;
    cb.addEventListener('change', saveSettingsFromForm);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + cat));
    container.appendChild(label);
  }
}

function init() {
  loadWordGroups().then(() => {
    buildCategoryCheckboxes();
    const stored = loadStoredSettings();
    if (stored) applySettingsToForm(stored);
    else {
      saveSettings(DEFAULT_SETTINGS);
      applySettingsToForm(DEFAULT_SETTINGS);
    }
  });
  if (!isLocalStorageAvailable()) {
    const hint = document.createElement('p');
    hint.className = 'localStorage-warning';
    hint.textContent = "Settings won't persist. Open via http:// (e.g. npx serve .) for saving.";
    document.querySelector('.config-card')?.insertBefore(hint, document.querySelector('.config-grid'));
  }
  elements.configScreen = document.getElementById('config-screen');
  elements.gameScreen = document.getElementById('game-screen');
  elements.headerStatus = document.getElementById('header-status');
  elements.wordSlots = document.getElementById('word-slots');
  elements.readyBtn = document.getElementById('ready-btn');
  elements.gameOverWords = document.getElementById('game-over-words');
  elements.finalScore = document.getElementById('final-score');
  elements.roundOverPhase = document.getElementById('round-over-phase');
  elements.roundOverMessage = document.getElementById('round-over-message');

  document.getElementById('start-btn').addEventListener('click', () => { goToGame(); startGame(); });
  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('game-over-start-btn').addEventListener('click', startGame);
  document.getElementById('settings-btn').addEventListener('click', goToConfig);
  document.getElementById('ready-btn').addEventListener('click', onReady);

  ['lifelines', 'initial-words', 'seconds-per-word', 'attempts-per-round', 'max-complexity'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', saveSettingsFromForm);
      el.addEventListener('input', saveSettingsFromForm);
    }
  });
  const mixEl = document.getElementById('mix-mode');
  if (mixEl) mixEl.addEventListener('change', saveSettingsFromForm);

  showPhase('start');
}

function getSelectedCategoriesFromForm() {
  const cbs = document.querySelectorAll('#category-checkboxes input[data-category]:checked');
  return Array.from(cbs).map(cb => cb.dataset.category);
}

function saveSettingsFromForm() {
  const selected = getSelectedCategoriesFromForm();
  const allCats = getCategoryNames();
  saveSettings({
    lifelines: parseInt(document.getElementById('lifelines').value, 10) || DEFAULT_SETTINGS.lifelines,
    initialWords: parseInt(document.getElementById('initial-words').value, 10) || DEFAULT_SETTINGS.initialWords,
    secondsPerWord: parseInt(document.getElementById('seconds-per-word').value, 10) || DEFAULT_SETTINGS.secondsPerWord,
    attemptsPerRound: parseInt(document.getElementById('attempts-per-round').value, 10) || DEFAULT_SETTINGS.attemptsPerRound,
    maxComplexity: Math.min(3, Math.max(1, parseInt(document.getElementById('max-complexity').value, 10) || DEFAULT_SETTINGS.maxComplexity)),
    selectedCategories: selected.length === allCats.length ? [] : selected,
    mix: document.getElementById('mix-mode').checked
  });
}

function getConfig() {
  const allCats = getCategoryNames();
  const selected = getSelectedCategoriesFromForm();
  return {
    lifelines: parseInt(document.getElementById('lifelines').value, 10) || 5,
    initialWords: parseInt(document.getElementById('initial-words').value, 10) || 3,
    secondsPerWord: parseInt(document.getElementById('seconds-per-word').value, 10) || 2,
    attemptsPerRound: parseInt(document.getElementById('attempts-per-round').value, 10) || 4,
    maxComplexity: Math.min(3, Math.max(1, parseInt(document.getElementById('max-complexity').value, 10) || 3)),
    selectedCategories: selected.length === allCats.length ? [] : selected,
    mix: document.getElementById('mix-mode').checked
  };
}

function goToConfig() {
  elements.gameScreen.classList.remove('active');
  elements.configScreen.classList.add('active');
}

function goToGame() {
  elements.configScreen.classList.remove('active');
  elements.gameScreen.classList.add('active');
}

function showPhase(phase) {
  const map = { start: 'start-phase', play: 'play-phase', 'round-over': 'round-over-phase', 'game-over': 'game-over-phase' };
  Object.entries(map).forEach(([p, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', p !== phase);
  });
  state.phase = phase;
  elements.gameScreen.classList.toggle('at-start', phase === 'start');
}

const FLASH_DURATION = 2000;

function showFlashMessage(msg, duration, onComplete) {
  if (elements.roundOverMessage) {
    elements.roundOverMessage.textContent = msg;
    showPhase('round-over');
    setTimeout(onComplete, duration);
  } else {
    onComplete();
  }
}

function showRoundOver(roundNum, isReplay, onComplete) {
  const msg = isReplay ? `REPEAT ROUND ${roundNum} is over` : `ROUND ${roundNum} is over`;
  showFlashMessage(msg, 1000, onComplete);
}

function updateHeader() {
  if (state.phase === 'game-over' || state.phase === 'round-over') return;
  if (state.phase === 'start') {
    elements.headerStatus.textContent = '';
    return;
  }
  const hearts = '♥'.repeat(Math.max(0, state.lifelines));
  const lowClass = state.lifelines <= 1 ? ' low' : '';
  let roundLabel;
  if (state.mode === 'round-feedback') {
    roundLabel = `ROUND ${state.round} — press Ready`;
  } else if (state.mode === 'replay-feedback') {
    roundLabel = `REPEAT ROUND ${state.replayRoundIndex + 1} — press Ready`;
  } else if (state.replayRoundIndex >= 0) {
    roundLabel = `REPEAT ROUND ${state.replayRoundIndex + 1}`;
  } else {
    roundLabel = `ROUND ${state.round}`;
  }
  elements.headerStatus.innerHTML = `${roundLabel} \u00A0\u00A0\u00A0\u00A0 <span class="hearts${lowClass}">${hearts}</span>`;
}

function buildWordSlots(totalCount) {
  elements.wordSlots.innerHTML = '';
  for (let i = 0; i < totalCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'word-slot';
    slot.dataset.index = i;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'word-slot-input';
    input.autocomplete = 'off';
    input.dataset.index = i;
    slot.appendChild(input);
    elements.wordSlots.appendChild(slot);
  }
}

function setSlotState(index, type, text = '', expectedWord = '') {
  const slots = elements.wordSlots.querySelectorAll('.word-slot');
  const slot = slots[index];
  if (!slot) return;
  slot.classList.remove('active', 'inactive', 'study', 'correct', 'wrong-place', 'wrong');
  let hint = slot.querySelector('.word-slot-hint');
  if (hint) hint.remove();
  const input = slot.querySelector('.word-slot-input');
  if (!input) return;
  if (type === 'active') {
    slot.classList.add('active');
    input.readOnly = false;
    input.value = text;
    input.placeholder = ' ';
  } else if (type === 'inactive') {
    slot.classList.add('inactive');
    input.readOnly = true;
    input.value = '';
    input.placeholder = ' ';
  } else if (type === 'study') {
    slot.classList.add('study');
    input.readOnly = true;
    input.value = text;
    input.placeholder = ' ';
  } else if (['correct', 'wrong-place', 'wrong'].includes(type)) {
    slot.classList.add(type);
    input.readOnly = true;
    input.value = text;
    if (type === 'wrong' && expectedWord) {
      hint = document.createElement('span');
      hint.className = 'word-slot-hint';
      hint.textContent = ` → ${expectedWord}`;
      slot.appendChild(hint);
    }
  }
}

function renderStudyMode() {
  const wc = state.wordCount;
  const words = state.currentRoundWords.slice(0, wc);
  const feedback = state.slotFeedback || [];
  const maxSlots = config.initialWords + config.attemptsPerRound - 1;
  for (let i = 0; i < maxSlots; i++) {
    if (i >= wc) {
      setSlotState(i, 'inactive', '');
    } else if (feedback[i] === 'wrong') {
      setSlotState(i, 'wrong', words[i] || '');
    } else if (feedback[i]) {
      setSlotState(i, feedback[i], '');
    } else {
      setSlotState(i, 'study', words[i] || '');
    }
  }
}

function renderFeedbackMode() {
  const wc = state.wordCount;
  const words = state.currentRoundWords.slice(0, wc);
  const feedback = state.slotFeedback || [];
  const maxSlots = config.initialWords + config.attemptsPerRound - 1;
  for (let i = 0; i < maxSlots; i++) {
    if (i >= wc) {
      setSlotState(i, 'inactive', '');
    } else if (feedback[i] === 'wrong') {
      setSlotState(i, 'wrong', words[i] || '');
    } else if (feedback[i]) {
      setSlotState(i, feedback[i], '');
    } else {
      setSlotState(i, 'wrong', words[i] || '');
    }
  }
}

function renderAnswerMode() {
  const wc = state.wordCount;
  const maxSlots = config.initialWords + config.attemptsPerRound - 1;

  for (let i = 0; i < maxSlots; i++) {
    if (i < wc) {
      // All words must be re-entered from scratch, including the new one
      setSlotState(i, 'active', '');
    } else {
      setSlotState(i, 'inactive', '');
    }
  }
  attachSlotNavigation();
  elements.wordSlots.querySelector('.word-slot-input[data-index="0"]')?.focus();
}

function attachSlotNavigation() {
  const inputs = elements.wordSlots.querySelectorAll('.word-slot-input');
  inputs.forEach((input, i) => {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = elements.wordSlots.querySelector(`.word-slot-input[data-index="${i + 1}"]`);
        if (next && !next.closest('.word-slot')?.classList.contains('inactive')) next.focus();
      }
    };
  });
}

function getSlotValues() {
  const wc = state.wordCount;
  const vals = [];
  for (let i = 0; i < wc; i++) {
    const input = elements.wordSlots.querySelector(`.word-slot-input[data-index="${i}"]`);
    vals.push((input?.value || '').trim().toLowerCase());
  }
  return vals;
}

function scoreAttempt(playerWords, expectedWords, multiplier = 1) {
  let points = 0;
  let lifelinesLost = 0;
  const expectedUsed = expectedWords.map(() => false);
  const playerUsed = playerWords.map(() => false);
  const slotFeedback = playerWords.map(() => 'wrong');

  for (let i = 0; i < expectedWords.length; i++) {
    const exp = expectedWords[i].toLowerCase();
    if (i < playerWords.length && playerWords[i] === exp) {
      points += 2 * multiplier;
      expectedUsed[i] = true;
      playerUsed[i] = true;
      slotFeedback[i] = 'correct';
    }
  }

  for (let i = 0; i < expectedWords.length; i++) {
    if (expectedUsed[i]) continue;
    const exp = expectedWords[i].toLowerCase();
    for (let j = 0; j < playerWords.length; j++) {
      if (playerUsed[j]) continue;
      if (playerWords[j] === exp) {
        points += 1 * multiplier;
        expectedUsed[i] = true;
        playerUsed[j] = true;
        slotFeedback[j] = 'wrong-place';
        break;
      }
    }
  }

  for (let i = 0; i < expectedWords.length; i++) {
    if (!expectedUsed[i]) lifelinesLost++;
  }

  return { points, lifelinesLost, slotFeedback };
}

function onReady() {
  if (state.mode === 'study') {
    state.mode = 'answer';
    renderAnswerMode();
  } else if (state.mode === 'answer') {
    submitAnswer();
  } else if (state.mode === 'round-feedback') {
    advanceFromRoundFeedback();
  } else if (state.mode === 'replay-feedback') {
    advanceFromReplayFeedback();
  }
}

function submitAnswer() {
  const expectedWords = state.currentRoundWords.slice(0, state.wordCount);
  const playerWords = getSlotValues();

  const mult = state.replayRoundIndex >= 0
    ? (state.round - state.replayRoundIndex)
    : 1;
  const { points, lifelinesLost, slotFeedback } = scoreAttempt(playerWords, expectedWords, mult);

  state.points += points;
  state.lifelines -= lifelinesLost; // reduce lifelines for missing words (normal and repeat rounds)
  state.slotFeedback = slotFeedback;

  const base = Math.max(0, state.wordStats.length - expectedWords.length);
  slotFeedback.forEach((s, i) => {
    if (state.wordStats[base + i]) state.wordStats[base + i].correct = s !== 'wrong' ? 1 : 0;
  });

  updateHeader();

  if (state.lifelines <= 0) {
    showGameOver();
    return;
  }

  state.slotFeedback = slotFeedback;

  if (state.replayRoundIndex >= 0) {
    renderFeedbackMode();
    state.mode = 'replay-feedback';
    showPhase('play');
    elements.readyBtn?.classList.remove('hidden');
  } else if (state.attempt < config.attemptsPerRound) {
    state.mode = 'study';
    state.attempt++;
    state.wordCount = config.initialWords + state.attempt - 1;
    state.slotFeedback = slotFeedback;
    state.wordStats.push({ word: state.currentRoundWords[state.wordCount - 1], shown: 1, correct: 0 });
    renderStudyMode();
  } else {
    if (state.replayRoundIndex < 0) {
      state.roundWords.push([...state.currentRoundWords.slice(0, config.initialWords + config.attemptsPerRound - 1)]);
    }
    renderFeedbackMode();
    state.mode = 'round-feedback';
    showPhase('play');
    elements.readyBtn?.classList.remove('hidden');
  }
}

function advanceFromRoundFeedback() {
  // After round 2: repeat round 1. After round 3: repeat rounds 1 and 2. etc.
  const N = state.round;
  if (N >= 2) {
    // Flash "Repeat Round 1" for 2 seconds, then replay round 1
    showFlashMessage(`REPEAT ROUND 1`, FLASH_DURATION, () => {
      showPhase('play');
      state.replayRoundIndex = 0;
      startReplayRound(0);
    });
  } else {
    // No repeat rounds: flash "Round N+1" and start
    showFlashMessage(`ROUND ${N + 1}`, FLASH_DURATION, () => {
      showPhase('play');
      nextRound();
    });
  }
}

function advanceFromReplayFeedback() {
  // K = replayRoundIndex + 1 (1-indexed). Repeat for K = 1 to N-1
  const N = state.round;
  const K = state.replayRoundIndex + 1;
  if (K < N - 1) {
    // More replays: flash "Repeat Round K+1", then replay
    showFlashMessage(`REPEAT ROUND ${K + 1}`, FLASH_DURATION, () => {
      showPhase('play');
      startReplayRound(state.replayRoundIndex + 1);
    });
  } else {
    // Last replay done: flash "Round N+1" and start
    state.replayRoundIndex = -1;
    showFlashMessage(`ROUND ${N + 1}`, FLASH_DURATION, () => {
      showPhase('play');
      nextRound();
    });
  }
}

function startReplayRound(idx) {
  const roundToReplay = state.roundWords[idx];
  state.currentRoundWords = [...roundToReplay];
  state.wordCount = roundToReplay.length;
  state.mode = 'answer'; // no Study phase: player enters all words in empty boxes
  state.slotFeedback = [];
  state.replayRoundIndex = idx;
  roundToReplay.forEach(w => state.wordStats.push({ word: w, shown: 0, correct: 0 }));
  buildWordSlots(config.initialWords + config.attemptsPerRound - 1);
  renderAnswerMode();
  updateHeader();
}

function nextRound() {
  state.round++;
  state.attempt = 1;
  state.replayRoundIndex = -1;

  if (state.lifelines <= 0) {
    showGameOver();
    return;
  }
  startRound();
}

function startRound() {
  const maxWords = config.initialWords + config.attemptsPerRound - 1;
  let themeWords;

  if (config.mix && config.allWords?.length >= maxWords) {
    const pool = [...new Set(config.allWords)];
    shuffle(pool);
    themeWords = pool.slice(0, maxWords);
  } else {
    const sets = (config.categorySets || []).filter(s => s.length >= maxWords);
    if (!sets.length) {
      console.error('No word sets. Select categories or enable Mix.');
      return;
    }
    const idx = Math.floor(Math.random() * sets.length);
    themeWords = [...sets[idx]];
    shuffle(themeWords);
    themeWords = themeWords.slice(0, maxWords);
  }

  state.currentRoundWords = themeWords;
  state.attempt = 1;
  state.wordCount = config.initialWords;
  state.mode = 'study';
  state.slotFeedback = [];

  state.currentRoundWords.slice(0, state.wordCount).forEach(w => state.wordStats.push({ word: w, shown: 1, correct: 0 }));

  buildWordSlots(maxWords);
  renderStudyMode();
  updateHeader();
}

function startGame() {
  config = getConfig();
  saveSettingsFromForm();
  const { categorySets, allWords } = buildWordData(config.maxComplexity, config.selectedCategories, config.mix);
  config.categorySets = categorySets;
  config.allWords = allWords;

  state = {
    lifelines: config.lifelines,
    points: 0,
    round: 1,
    attempt: 1,
    roundWords: [],
    currentRoundWords: [],
    phase: 'play',
    mode: 'study',
    wordCount: config.initialWords,
    slotFeedback: [],
    wordStats: [],
    replayRoundIndex: -1
  };

  elements.configScreen.classList.remove('active');
  elements.gameScreen.classList.add('active');
  showPhase('play');
  startRound();
}

function showGameOver() {
  elements.headerStatus.textContent = 'Game over';
  showPhase('game-over');
  elements.finalScore.textContent = state.points;

  const rounds = state.roundWords || [];
  const columns = [...rounds];

  // Only add the last round if it actually started (not lost during repeat)
  // When lost during repeat, we never started the new round - don't show it
  if (state.replayRoundIndex < 0) {
    const lastRoundCount = state.wordCount || 0;
    const lastRoundWords = state.currentRoundWords?.slice(0, lastRoundCount) || [];
    if (lastRoundWords.length) columns.push(lastRoundWords);
  }

  elements.gameOverWords.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'game-over-grid';
  const maxRows = Math.max(...columns.map(c => c.length), 1);

  for (let c = 0; c < columns.length; c++) {
    const col = document.createElement('div');
    col.className = 'game-over-column';
    col.innerHTML = `<div class="game-over-col-header">ROUND ${c + 1}</div>`;
    for (let r = 0; r < maxRows; r++) {
      const cell = document.createElement('div');
      cell.className = 'game-over-cell';
      cell.textContent = columns[c][r] || '';
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
  elements.gameOverWords.appendChild(grid);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

document.addEventListener('DOMContentLoaded', init);
