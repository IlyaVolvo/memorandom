/**
 * Memorandom - Word Memory Training Game
 * 
 * Game flow:
 * - Each round: M attempts, attempt i shows N+i-1 words
 * - Words shown sequentially, T seconds each
 * - Player writes words after each attempt
 * - Missed word = -1 lifeline; correct in place = 2 pts; correct wrong place = 1 pt
 * - From round 2+: recall all previous round words (doubled points)
 */

// Word groups loaded from JSON (raw structure with category/sets/complexity)
let WORD_GROUPS = [];

const STORAGE_KEY = 'memorandom-settings';
const DEFAULT_SETTINGS = {
  lifelines: 5,
  initialWords: 3,
  secondsPerWord: 2,
  attemptsPerRound: 4,
  maxComplexity: 3,
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
    console.warn('Could not save settings (localStorage may be disabled)', e);
    return false;
  }
}

function showSavedHint() {
  const el = document.getElementById('settings-saved-hint');
  if (!el) return;
  el.textContent = 'Saved';
  el.classList.add('visible');
  clearTimeout(showSavedHint._tid);
  showSavedHint._tid = setTimeout(() => {
    el.classList.remove('visible');
  }, 2000);
}

function getCategoryNames() {
  return (WORD_GROUPS || []).map(g => g.category).filter(Boolean);
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

// Game state
let config = {};
let state = {
  lifelines: 0,
  points: 0,
  round: 0,
  attempt: 0,
  roundWords: [],      // [round1words, round2words, ...]
  currentRoundWords: [],
  phase: 'config',
  displayIndex: 0,
  displayTimer: null,
  wordStats: []  // [{ word, shown, correct }, ...] per word in game order
};

// DOM refs
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
  const categories = selectedCategories && selectedCategories.length > 0
    ? selectedCategories
    : getCategoryNames();

  const categorySets = [];
  const allWords = [];

  for (const group of WORD_GROUPS) {
    if (!categories.includes(group.category)) continue;
    for (const set of group.sets || []) {
      if (set.complexity <= maxComplexity && set.list && set.list.length >= 6) {
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
    const key = '__memorandom_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
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
    const name = document.createTextNode(' ' + cat);
    label.appendChild(cb);
    label.appendChild(name);
    container.appendChild(label);
  }
}

function init() {
  loadWordGroups().then(() => {
    buildCategoryCheckboxes();
    const stored = loadStoredSettings();
    if (stored) {
      applySettingsToForm(stored);
    } else {
      saveSettings(DEFAULT_SETTINGS);
      applySettingsToForm(DEFAULT_SETTINGS);
    }
  });
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage unavailable (e.g. file:// or private mode). Settings will not persist.');
    const hint = document.createElement('p');
    hint.className = 'localStorage-warning';
    hint.textContent = 'Settings won\'t persist. Open via http:// (e.g. npx serve .) for saving.';
    document.querySelector('.config-card')?.insertBefore(hint, document.querySelector('.config-grid'));
  }
  elements.configScreen = document.getElementById('config-screen');
  elements.gameScreen = document.getElementById('game-screen');
  elements.lifelinesDisplay = document.getElementById('lifelines-display');
  elements.pointsDisplay = document.getElementById('points-display');
  elements.roundDisplay = document.getElementById('round-display');
  elements.hearts = document.getElementById('hearts');
  elements.gameOverStartBtn = document.getElementById('game-over-start-btn');
  elements.watchPhase = document.getElementById('watch-phase');
  elements.writePhase = document.getElementById('write-phase');
  elements.recallPhase = document.getElementById('recall-phase');
  elements.gameOverPhase = document.getElementById('game-over-phase');
  elements.wordDisplay = document.getElementById('word-display');
  elements.wordCountdown = document.getElementById('word-countdown');
  elements.wordInputsContainer = document.getElementById('word-inputs-container');
  elements.recallInputsContainer = document.getElementById('recall-inputs-container');
  elements.finalScore = document.getElementById('final-score');
  elements.gameOverWords = document.getElementById('game-over-words');

  document.getElementById('start-btn').addEventListener('click', () => { goToGame(); startGame(); });
  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('game-over-start-btn').addEventListener('click', startGame);
  document.getElementById('settings-btn').addEventListener('click', goToConfig);

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
  const checkboxes = document.querySelectorAll('#category-checkboxes input[data-category]:checked');
  return Array.from(checkboxes).map(cb => cb.dataset.category);
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

function goToConfig() {
  if (state.displayTimer) {
    clearTimeout(state.displayTimer);
    state.displayTimer = null;
  }
  elements.gameScreen.classList.remove('active');
  elements.configScreen.classList.add('active');
}

function goToGame() {
  elements.configScreen.classList.remove('active');
  elements.gameScreen.classList.add('active');
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

function startGame() {
  config = getConfig();
  saveSettingsFromForm();
  const { categorySets, allWords } = buildWordData(
    config.maxComplexity,
    config.selectedCategories,
    config.mix
  );
  config.categorySets = categorySets;
  config.allWords = allWords;
  state = {
    lifelines: config.lifelines,
    points: 0,
    round: 1,
    attempt: 1,
    roundWords: [],
    currentRoundWords: [],
    phase: 'watch',
    displayIndex: 0,
    displayTimer: null,
    wordStats: []
  };

  elements.configScreen.classList.remove('active');
  elements.gameScreen.classList.add('active');
  updateStats();

  // Start round 1
  startRound();
}

function startRound() {
  const maxWordsNeeded = config.initialWords + config.attemptsPerRound - 1;
  let themeWords;

  if (config.mix && config.allWords && config.allWords.length >= maxWordsNeeded) {
    const pool = [...new Set(config.allWords)];
    shuffle(pool);
    themeWords = pool.slice(0, maxWordsNeeded);
  } else {
    const sets = (config.categorySets || []).filter(s => s.length >= maxWordsNeeded);
    if (!sets.length) {
      console.error('No word sets available. Select categories or increase max complexity.');
      return;
    }
    const setIndex = Math.floor(Math.random() * sets.length);
    themeWords = [...sets[setIndex]];
    shuffle(themeWords);
    themeWords = themeWords.slice(0, maxWordsNeeded);
  }

  if (!themeWords || themeWords.length < maxWordsNeeded) {
    console.error('Not enough words. Select more categories or enable Mix.');
    return;
  }
  state.currentRoundWords = themeWords;
  state.attempt = 1;
  showPhase('watch');
  runAttempt();
}

function runAttempt() {
  const wordCount = config.initialWords + state.attempt - 1;
  const allWords = state.currentRoundWords.slice(0, wordCount);

  // When adding a word (attempt 2+), show only the new one
  const wordsToShow = state.attempt === 1 ? allWords : [allWords[allWords.length - 1]];

  elements.wordDisplay.textContent = '';
  elements.wordDisplay.classList.remove('visible');
  state.displayIndex = 0;

  function showNextWord() {
    if (state.displayIndex >= wordsToShow.length) {
      clearTimeout(state.displayTimer);
      state.displayTimer = null;
      const batch = state.currentRoundWords.slice(0, wordCount);
      batch.forEach(w => state.wordStats.push({ word: w, shown: 1, correct: 0 }));
      showPhase('write');
      buildWordInputs(wordCount, 'words');
      return;
    }

    const word = wordsToShow[state.displayIndex];
    elements.wordDisplay.textContent = word;
    elements.wordDisplay.classList.add('visible');

    const remaining = wordsToShow.length - state.displayIndex - 1;
    elements.wordCountdown.textContent = remaining > 0 ? `Next word in ${config.secondsPerWord}s...` : '';

    state.displayIndex++;
    state.displayTimer = setTimeout(showNextWord, config.secondsPerWord * 1000);
  }

  showNextWord();
}

function buildWordInputs(count, type) {
  const container = type === 'words' ? elements.wordInputsContainer : elements.recallInputsContainer;
  const onSubmit = type === 'words' ? submitWords : submitRecall;

  container.innerHTML = '';
  const inputs = [];

  for (let i = 0; i < count; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'word-input-wrapper';
    const label = document.createElement('span');
    label.className = 'word-input-label';
    label.textContent = `${i + 1}.`;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'word-input';
    input.autocomplete = 'off';
    input.placeholder = ' ';
    input.dataset.index = i;
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
    inputs.push(input);
  }

  inputs[0]?.focus();

  inputs.forEach((input, i) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (i < inputs.length - 1) {
          inputs[i + 1].focus();
        } else {
          onSubmit();
        }
      }
    });
  });
}

function getWordInputValues(container) {
  const inputs = container.querySelectorAll('.word-input');
  return Array.from(inputs).map(inp => inp.value.trim().toLowerCase());
}

function showSlotFeedback(container, slotFeedback, expectedWords) {
  const wrappers = container.querySelectorAll('.word-input-wrapper');
  const inputs = container.querySelectorAll('.word-input');
  wrappers.forEach((wrapper, i) => {
    wrapper.classList.remove('correct', 'wrong-place', 'wrong');
    const status = slotFeedback[i] || 'wrong';
    wrapper.classList.add(status);
    if (inputs[i]) inputs[i].readOnly = true;

    const existingCorrect = wrapper.querySelector('.correct-word-hint');
    if (existingCorrect) existingCorrect.remove();

    if (status === 'wrong' && expectedWords[i]) {
      const hint = document.createElement('span');
      hint.className = 'correct-word-hint';
      hint.textContent = ` → ${expectedWords[i]}`;
      wrapper.appendChild(hint);
    }
  });
}

function scoreAttempt(playerWords, expectedWords, doublePoints = false) {
  // Rules: -1 lifeline per missing word; 2 pts correct place; 1 pt wrong place
  const multiplier = doublePoints ? 2 : 1;
  let points = 0;
  let lifelinesLost = 0;

  const expectedUsed = expectedWords.map(() => false);
  const playerUsed = playerWords.map(() => false);

  // First pass: exact position matches (2 points)
  for (let i = 0; i < expectedWords.length; i++) {
    const exp = expectedWords[i].toLowerCase();
    if (i < playerWords.length && playerWords[i] === exp) {
      points += 2 * multiplier;
      expectedUsed[i] = true;
      playerUsed[i] = true;
    }
  }

  const slotFeedback = playerWords.map(() => 'wrong');

  // Second pass: correct word, wrong position (1 point) — also mark slotFeedback
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

  const correctIndices = [];
  for (let i = 0; i < expectedWords.length; i++) {
    if (expectedUsed[i]) correctIndices.push(i);
  }

  // Mark exact matches as correct
  for (let i = 0; i < expectedWords.length; i++) {
    const exp = expectedWords[i].toLowerCase();
    if (i < playerWords.length && playerWords[i] === exp) {
      slotFeedback[i] = 'correct';
    }
  }

  // Missed words
  const missedWords = [];
  for (let i = 0; i < expectedWords.length; i++) {
    if (!expectedUsed[i]) {
      lifelinesLost++;
      missedWords.push(expectedWords[i]);
    }
  }

  return { points, lifelinesLost, missedWords, slotFeedback, correctIndices };
}

function submitWords() {
  const wordCount = config.initialWords + state.attempt - 1;
  const expectedWords = state.currentRoundWords.slice(0, wordCount);
  const playerWords = getWordInputValues(elements.wordInputsContainer);

  const { points, lifelinesLost, slotFeedback, correctIndices } = scoreAttempt(playerWords, expectedWords);
  const base = state.wordStats.length - wordCount;
  correctIndices.forEach(i => {
    if (state.wordStats[base + i]) state.wordStats[base + i].correct++;
  });

  state.points += points;
  state.lifelines -= lifelinesLost;

  updateStats();

  if (state.lifelines <= 0) {
    showGameOver('write');
    return;
  }

  showSlotFeedback(elements.wordInputsContainer, slotFeedback, expectedWords);

  const displaySeconds = wordCount * 0.5;
  setTimeout(() => {
    continueGame();
  }, displaySeconds * 1000);
}

function continueGame() {
  state.attempt++;

  if (state.attempt <= config.attemptsPerRound) {
    showPhase('watch');
    runAttempt();
  } else {
    // Round complete - store words and check for recall
    state.roundWords.push([...state.currentRoundWords.slice(0, config.initialWords + config.attemptsPerRound - 1)]);

    if (state.round >= 2 && state.roundWords.length >= 2) {
      // Recall phase: write all words from previous rounds
      const wordsToRecall = state.roundWords.slice(0, -1).flat();
      state.recallExpected = wordsToRecall;
      wordsToRecall.forEach(w => state.wordStats.push({ word: w, shown: 0, correct: 0 }));
      showPhase('recall');
      buildWordInputs(wordsToRecall.length, 'recall');
    } else {
      nextRound();
    }
  }
}

function submitRecall() {
  const expectedWords = state.recallExpected;
  const playerWords = getWordInputValues(elements.recallInputsContainer);

  const { points, lifelinesLost, slotFeedback, correctIndices } = scoreAttempt(playerWords, expectedWords, true);
  const base = state.wordStats.length - expectedWords.length;
  correctIndices.forEach(i => {
    if (state.wordStats[base + i]) state.wordStats[base + i].correct++;
  });

  state.points += points;
  state.lifelines -= lifelinesLost;

  updateStats();

  if (state.lifelines <= 0) {
    showGameOver('recall');
    return;
  }

  showSlotFeedback(elements.recallInputsContainer, slotFeedback, expectedWords);

  const displaySeconds = expectedWords.length * 0.5;
  setTimeout(() => {
    nextRound();
  }, displaySeconds * 1000);
}

function nextRound() {
  state.round++;
  state.attempt = 1;

  if (state.lifelines <= 0) {
    showGameOver('nextRound');
    return;
  }

  updateStats();
  startRound();
}

function getAllWordsFromGame(fromPhase) {
  const fromRounds = state.roundWords.flat();
  // Only add current round words when we lost during write (round not yet pushed)
  if (fromPhase === 'write') {
    const wordCount = config.initialWords + state.attempt - 1;
    const currentWords = state.currentRoundWords.slice(0, wordCount);
    return [...fromRounds, ...currentWords];
  }
  return fromRounds;
}

function showGameOver(fromPhase = 'nextRound') {
  elements.lifelinesDisplay.textContent = 'Game over';
  elements.hearts.textContent = '';

  showPhase('game-over');
  elements.finalScore.textContent = state.points;

  const allWords = getAllWordsFromGame(fromPhase);
  const stats = state.wordStats || [];
  const wordsContainer = elements.gameOverWords || document.getElementById('game-over-words');
  if (wordsContainer) {
    wordsContainer.innerHTML = '';
    const list = document.createElement('ol');
    list.className = 'game-over-words-list';
    allWords.forEach((word, i) => {
      const li = document.createElement('li');
      const s = stats[i];
      const n1 = (s && s.shown != null) ? s.shown : '—';
      const n2 = (s && s.correct != null) ? s.correct : '—';
      li.innerHTML = `${word} (<span class="word-stat-n1">${n1}</span>/<span class="word-stat-n2">${n2}</span>)`;
      list.appendChild(li);
    });
    wordsContainer.appendChild(list);
  }
}

function showPhase(phase) {
  const phaseMap = { start: 'start-phase', watch: 'watch-phase', write: 'write-phase', recall: 'recall-phase', 'game-over': 'game-over-phase' };
  Object.entries(phaseMap).forEach(([p, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', p !== phase);
  });
  state.phase = phase;
  elements.gameScreen.classList.toggle('at-start', phase === 'start');
}

function updateStats() {
  if (state.phase === 'game-over' || state.phase === 'start') return;
  elements.lifelinesDisplay.textContent = state.lifelines;
  elements.pointsDisplay.textContent = state.points;
  elements.roundDisplay.textContent = state.round;

  // Hearts display
  elements.hearts.textContent = '♥'.repeat(Math.max(0, state.lifelines));
  elements.hearts.className = 'hearts ' + (state.lifelines <= 1 ? 'low' : '');
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Init on load
document.addEventListener('DOMContentLoaded', init);
