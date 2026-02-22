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

// Thematic word lists - simple, related words
const WORD_THEMES = {
  animals: ['cat', 'dog', 'bird', 'fish', 'frog', 'bear', 'lion', 'wolf', 'deer', 'duck', 'goat', 'mole', 'seal', 'swan', 'crab'],
  colors: ['red', 'blue', 'green', 'pink', 'gray', 'gold', 'navy', 'teal', 'mint', 'lime', 'rust', 'sand', 'coal', 'snow', 'rose'],
  fruits: ['apple', 'grape', 'lemon', 'mango', 'melon', 'peach', 'pear', 'plum', 'berry', 'cherry', 'dates', 'figs', 'kiwi', 'lime', 'prune'],
  nature: ['tree', 'leaf', 'rock', 'rain', 'wind', 'snow', 'moon', 'star', 'lake', 'hill', 'wave', 'mist', 'dawn', 'dusk', 'moss'],
  food: ['bread', 'cheese', 'honey', 'milk', 'rice', 'soup', 'toast', 'wheat', 'flour', 'sugar', 'salad', 'pasta', 'beans', 'nuts', 'eggs'],
  body: ['hand', 'foot', 'head', 'nose', 'ear', 'eye', 'arm', 'leg', 'lip', 'chin', 'neck', 'back', 'chest', 'palm', 'heel'],
  home: ['door', 'room', 'wall', 'desk', 'lamp', 'sofa', 'shelf', 'table', 'chair', 'bed', 'rug', 'oven', 'sink', 'bath', 'hall'],
  weather: ['sun', 'cloud', 'storm', 'frost', 'hail', 'fog', 'mist', 'dew', 'breeze', 'gust', 'chill', 'warmth', 'humidity', 'drought', 'flood']
};

const THEME_NAMES = Object.keys(WORD_THEMES);

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
  displayTimer: null
};

// DOM refs
const elements = {};

function init() {
  elements.configScreen = document.getElementById('config-screen');
  elements.gameScreen = document.getElementById('game-screen');
  elements.lifelinesDisplay = document.getElementById('lifelines-display');
  elements.pointsDisplay = document.getElementById('points-display');
  elements.roundDisplay = document.getElementById('round-display');
  elements.hearts = document.getElementById('hearts');
  elements.watchPhase = document.getElementById('watch-phase');
  elements.writePhase = document.getElementById('write-phase');
  elements.recallPhase = document.getElementById('recall-phase');
  elements.gameOverPhase = document.getElementById('game-over-phase');
  elements.wordDisplay = document.getElementById('word-display');
  elements.wordCountdown = document.getElementById('word-countdown');
  elements.wordInputsContainer = document.getElementById('word-inputs-container');
  elements.recallInputsContainer = document.getElementById('recall-inputs-container');
  elements.finalScore = document.getElementById('final-score');

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', goToConfig);
  document.getElementById('restart-game-btn').addEventListener('click', goToConfig);

}

function goToConfig() {
  if (state.displayTimer) {
    clearTimeout(state.displayTimer);
    state.displayTimer = null;
  }
  elements.gameScreen.classList.remove('active');
  elements.configScreen.classList.add('active');
}

function getConfig() {
  return {
    lifelines: parseInt(document.getElementById('lifelines').value, 10) || 5,
    initialWords: parseInt(document.getElementById('initial-words').value, 10) || 3,
    secondsPerWord: parseInt(document.getElementById('seconds-per-word').value, 10) || 2,
    attemptsPerRound: parseInt(document.getElementById('attempts-per-round').value, 10) || 4
  };
}

function startGame() {
  config = getConfig();
  state = {
    lifelines: config.lifelines,
    points: 0,
    round: 1,
    attempt: 1,
    roundWords: [],
    currentRoundWords: [],
    phase: 'watch',
    displayIndex: 0,
    displayTimer: null
  };

  elements.configScreen.classList.remove('active');
  elements.gameScreen.classList.add('active');
  updateStats();

  // Start round 1
  startRound();
}

function startRound() {
  const theme = THEME_NAMES[state.round % THEME_NAMES.length];
  const themeWords = [...WORD_THEMES[theme]];
  shuffle(themeWords);

  const maxWordsNeeded = config.initialWords + config.attemptsPerRound - 1;
  state.currentRoundWords = themeWords.slice(0, maxWordsNeeded);
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
      clearInterval(state.displayTimer);
      state.displayTimer = null;
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

  // Second pass: correct word, wrong position (1 point)
  for (let i = 0; i < expectedWords.length; i++) {
    if (expectedUsed[i]) continue;
    const exp = expectedWords[i].toLowerCase();
    for (let j = 0; j < playerWords.length; j++) {
      if (playerUsed[j]) continue;
      if (playerWords[j] === exp) {
        points += 1 * multiplier;
        expectedUsed[i] = true;
        playerUsed[j] = true;
        break;
      }
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

  const slotFeedback = playerWords.map(() => 'wrong');
  for (let i = 0; i < expectedWords.length; i++) {
    const exp = expectedWords[i].toLowerCase();
    if (i < playerWords.length && playerWords[i] === exp) {
      slotFeedback[i] = 'correct';
    }
  }
  for (let i = 0; i < expectedWords.length; i++) {
    if (expectedUsed[i]) continue;
    const exp = expectedWords[i].toLowerCase();
    for (let j = 0; j < playerWords.length; j++) {
      if (slotFeedback[j] !== 'wrong') continue;
      if (playerWords[j] === exp) {
        slotFeedback[j] = 'wrong-place';
        break;
      }
    }
  }

  return { points, lifelinesLost, missedWords, slotFeedback };
}

function submitWords() {
  const wordCount = config.initialWords + state.attempt - 1;
  const expectedWords = state.currentRoundWords.slice(0, wordCount);
  const playerWords = getWordInputValues(elements.wordInputsContainer);

  const { points, lifelinesLost, slotFeedback } = scoreAttempt(playerWords, expectedWords);

  state.points += points;
  state.lifelines -= lifelinesLost;

  updateStats();

  if (state.lifelines <= 0) {
    showGameOver();
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

  const { points, lifelinesLost, slotFeedback } = scoreAttempt(playerWords, expectedWords, true);

  state.points += points;
  state.lifelines -= lifelinesLost;

  updateStats();

  if (state.lifelines <= 0) {
    showGameOver();
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
    showGameOver();
    return;
  }

  updateStats();
  startRound();
}

function showGameOver() {
  showPhase('gameover');
  elements.finalScore.textContent = state.points;
}

function showPhase(phase) {
  const phases = ['watch', 'write', 'recall', 'gameover'];
  phases.forEach(p => {
    const el = document.getElementById(`${p}-phase`);
    if (el) el.classList.toggle('hidden', p !== phase);
  });
  state.phase = phase;
}

function updateStats() {
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
