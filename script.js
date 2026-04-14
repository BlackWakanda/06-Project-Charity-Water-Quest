const DIFFICULTY_PRESETS = {
  easy: {
    label: 'Easy',
    baseTimeSeconds: 26,
    timePerTierSeconds: 6,
    baseTapGain: 3.1,
    minTapGain: 2.35,
    tapGainDropPerTier: 0.2,
    leakBase: 0.22,
    leakTierStep: 0.1,
    missPenaltyBase: 6,
    missPenaltyTierStep: 1.5,
    obstacleVisibleMs: 2200,
    obstacleTier2DelayMs: 4600,
    obstacleTier3DelayMs: 3800,
    obstacleBeyondDelayMs: 3000,
    roundsNeededByTier: [2, 2, 2, 3],
  },
  normal: {
    label: 'Normal',
    baseTimeSeconds: 20,
    timePerTierSeconds: 5,
    baseTapGain: 2.9,
    minTapGain: 2.0,
    tapGainDropPerTier: 0.25,
    leakBase: 0.28,
    leakTierStep: 0.12,
    missPenaltyBase: 8,
    missPenaltyTierStep: 2,
    obstacleVisibleMs: 1800,
    obstacleTier2DelayMs: 3800,
    obstacleTier3DelayMs: 3200,
    obstacleBeyondDelayMs: 2200,
    roundsNeededByTier: [2, 2, 3, 3],
  },
  hard: {
    label: 'Expert',
    baseTimeSeconds: 19,
    timePerTierSeconds: 4,
    baseTapGain: 2.78,
    minTapGain: 1.9,
    tapGainDropPerTier: 0.24,
    leakBase: 0.31,
    leakTierStep: 0.14,
    missPenaltyBase: 9,
    missPenaltyTierStep: 2.2,
    obstacleVisibleMs: 1550,
    obstacleTier2DelayMs: 3500,
    obstacleTier3DelayMs: 2850,
    obstacleBeyondDelayMs: 2200,
    roundsNeededByTier: [2, 3, 3, 3],
  },
};

const MAX_TIME_SECONDS = 180;
const LEAK_TICK_MS = 100;
const TIER_UNLOCK_PERCENT = 100;
const FINAL_TIER = 3;

const introOverlay = document.getElementById('intro-overlay');
const missionOverlay = document.getElementById('mission-overlay');
const difficultyOverlay = document.getElementById('difficulty-overlay');
const endOverlay = document.getElementById('end-overlay');
const hud = document.getElementById('hud');
const pumpPanel = document.querySelector('.pump-panel');

const timerEl = document.getElementById('timer');
const purityEl = document.getElementById('purity');
const tierEl = document.getElementById('tier');
const tierProgressFillEl = document.getElementById('tier-progress-fill');
const tierProgressTextEl = document.getElementById('tier-progress-text');
const meterFillEl = document.getElementById('meter-fill');
const statusTextEl = document.getElementById('status-text');
const missionCardEl = document.getElementById('mission-card');
const dropletEl = document.getElementById('droplet');
const obstacleEl = document.getElementById('obstacle');

const openDifficultyBtn = document.getElementById('open-difficulty');
const continueToDifficultyBtn = document.getElementById('continue-to-difficulty');
const pumpBtn = document.getElementById('pump-btn');
const playAgainBtn = document.getElementById('play-again');
const resetBtn = document.getElementById('reset-game');
const modeDisplayEl = document.getElementById('mode-display');
const difficultyButtons = document.querySelectorAll('.difficulty-btn');

const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');

let isPlaying = false;
let selectedDifficulty = 'normal';
let timeLeft = DIFFICULTY_PRESETS[selectedDifficulty].baseTimeSeconds;
let waterLevel = 0;
let tier = 0;
let roundsCompletedInTier = 0;
let timerIntervalId = null;
let leakIntervalId = null;
let obstacleSpawnTimeoutId = null;
let obstacleHideTimeoutId = null;
let recentTapTimes = [];

/**
 * Returns the active difficulty preset for the current game session.
 *
 * @returns {object} Difficulty configuration object.
 */
function getDifficultySettings() {
  return DIFFICULTY_PRESETS[selectedDifficulty] || DIFFICULTY_PRESETS.normal;
}

/**
 * Calculates how many successful rounds are required before the current tier advances.
 *
 * @returns {number} Required rounds for the active tier.
 */
function getRoundsRequiredForTier() {
  const settings = getDifficultySettings();
  const tierTargets = settings.roundsNeededByTier || [2, 2, 3, 3];
  const fallbackTarget = tierTargets[tierTargets.length - 1] || 3;
  return tierTargets[tier] || fallbackTarget;
}

/**
 * Updates the difficulty label and active state in the UI.
 */
function updateDifficultyUi() {
  const settings = getDifficultySettings();
  modeDisplayEl.textContent = `Mode: ${settings.label}`;

  difficultyButtons.forEach((button) => {
    const isActive = button.dataset.difficulty === selectedDifficulty;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

/**
 * Switches the game to a new difficulty and resets the session state.
 *
 * @param {string} nextDifficulty - Difficulty key selected by the player.
 */
function setDifficulty(nextDifficulty) {
  if (!DIFFICULTY_PRESETS[nextDifficulty]) {
    return;
  }

  selectedDifficulty = nextDifficulty;
  updateDifficultyUi();
  resetGameState();
}

/**
 * Displays the mission overlay and hides the intro overlay.
 */
function showMissionOverlay() {
  introOverlay.classList.add('hidden');
  missionOverlay.classList.remove('hidden');
}

/**
 * Displays the difficulty selection overlay.
 */
function showDifficultySelection() {
  missionOverlay.classList.add('hidden');
  difficultyOverlay.classList.remove('hidden');
}

/**
 * Clamps a numeric value into an inclusive range.
 *
 * @param {number} value - Value to clamp.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @returns {number} Clamped value.
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculates the timer duration for a tier, capped at the global maximum.
 *
 * @param {number} secondsTier - Current tier index.
 * @returns {number} Seconds granted for the tier.
 */
function getTierTime(secondsTier) {
  const settings = getDifficultySettings();
  // Time increases a little each tier, but not enough to cancel the difficulty jump.
  const scaled = settings.baseTimeSeconds + (secondsTier * settings.timePerTierSeconds);
  return Math.min(scaled, MAX_TIME_SECONDS);
}

/**
 * Calculates the amount of water gained from one pump tap for the current tier.
 *
 * @returns {number} Water percentage added per tap.
 */
function getTapGainForTier() {
  const settings = getDifficultySettings();
  // Difficulty still rises by tier, but with a gentler drop in tap reward.
  return Math.max(settings.minTapGain, settings.baseTapGain - (tier * settings.tapGainDropPerTier));
}

/**
 * Returns the passive leak amount applied on the current tier.
 *
 * @returns {number} Leak amount per tick.
 */
function getLeakAmount() {
  const settings = getDifficultySettings();
  if (tier === 0) {
    return 0;
  }

  // Leak ramps up more gradually so tiers remain beatable.
  return settings.leakBase + (tier * settings.leakTierStep);
}

/**
 * Returns the penalty for missing an obstacle.
 *
 * @returns {number} Water percentage removed on a miss.
 */
function getObstacleMissPenalty() {
  const settings = getDifficultySettings();
  // Keep misses meaningful without wiping too much progress for new players.
  return settings.missPenaltyBase + (tier * settings.missPenaltyTierStep);
}

/**
 * Returns the delay before the next obstacle should appear, if hazards are enabled.
 *
 * @returns {?number} Milliseconds until spawn, or null when hazards are disabled.
 */
function getObstacleSpawnDelay() {
  const settings = getDifficultySettings();
  if (tier < 2) {
    return null;
  }

  // Tier 2 is intentionally calmer; Tier 3 speeds up slightly.
  if (tier === 2) {
    return settings.obstacleTier2DelayMs;
  }

  if (tier === 3) {
    return settings.obstacleTier3DelayMs;
  }

  return settings.obstacleBeyondDelayMs;
}

/**
 * Refreshes the HUD values and progress indicators.
 */
function updateHud() {
  const roundsRequired = getRoundsRequiredForTier();
  const tierProgressPercent = clamp((roundsCompletedInTier / roundsRequired) * 100, 0, 100);

  timerEl.textContent = `${Math.ceil(timeLeft)}s`;
  purityEl.textContent = `${Math.round(waterLevel)}%`;
  tierEl.textContent = `Tier ${tier}`;
  tierProgressFillEl.style.width = `${tierProgressPercent}%`;
  tierProgressTextEl.textContent = `Progress ${roundsCompletedInTier}/${roundsRequired} rounds`;
  meterFillEl.style.height = `${waterLevel}%`;
}

/**
 * Updates the status text based on the current water level milestone.
 */
function showMilestoneMessage() {
  if (waterLevel >= 100) {
    statusTextEl.textContent = 'Powered state reached!';
    return;
  }

  if (waterLevel >= 75) {
    statusTextEl.textContent = 'Village milestone reached! Keep pumping!';
    return;
  }

  if (waterLevel >= 25) {
    statusTextEl.textContent = 'Family milestone reached. Momentum is building!';
    return;
  }

  statusTextEl.textContent = 'Tap rapidly to power the pump and fill the well!';
}

/**
 * Highlights rapid tapping feedback and toggles the glow state.
 */
function updateSpeedFeedback() {
  const now = Date.now();
  recentTapTimes = recentTapTimes.filter((stamp) => now - stamp < 1000);

  if (recentTapTimes.length >= 7) {
    meterFillEl.classList.add('glow');
    statusTextEl.textContent = 'Gusher speed! You are overpowering the leak!';
  } else {
    meterFillEl.classList.remove('glow');
    showMilestoneMessage();
  }
}

/**
 * Plays the pump animation and restarts the droplet effect.
 */
function animatePump() {
  pumpBtn.classList.add('pumping');
  dropletEl.classList.remove('active');

  // Restart the droplet animation by forcing a reflow.
  void dropletEl.offsetWidth;
  dropletEl.classList.add('active');

  setTimeout(() => {
    pumpBtn.classList.remove('pumping');
  }, 90);
}

/**
 * Hides the contamination obstacle.
 */
function hideObstacle() {
  obstacleEl.classList.add('hidden');
}

/**
 * Applies the miss penalty when the obstacle times out.
 */
function handleMissedObstacle() {
  if (!isPlaying) {
    return;
  }

  if (obstacleEl.classList.contains('hidden')) {
    return;
  }

  waterLevel = clamp(waterLevel - getObstacleMissPenalty(), 0, 100);
  recentTapTimes = [];
  meterFillEl.classList.remove('glow');
  statusTextEl.textContent = 'You missed the contamination! Purity dropped.';
  updateHud();
  hideObstacle();
}

/**
 * Places the contamination obstacle at a random point in the playfield.
 */
function showObstacle() {
  if (!isPlaying) {
    return;
  }

  const settings = getDifficultySettings();

  const panelRect = pumpPanel.getBoundingClientRect();
  const obstacleSize = 44;
  const horizontalPadding = 20;
  const topPadding = 66;
  const availableWidth = Math.max(0, panelRect.width - obstacleSize - (horizontalPadding * 2));
  const availableHeight = Math.max(0, panelRect.height - obstacleSize - topPadding - 20);
  const randomX = horizontalPadding + (Math.random() * availableWidth);
  const randomY = topPadding + (Math.random() * availableHeight);

  obstacleEl.style.left = `${randomX}px`;
  obstacleEl.style.top = `${randomY}px`;
  obstacleEl.classList.remove('hidden');

  clearTimeout(obstacleHideTimeoutId);
  obstacleHideTimeoutId = setTimeout(handleMissedObstacle, settings.obstacleVisibleMs);
}

/**
 * Schedules the next contamination obstacle spawn if hazards are active.
 */
function scheduleObstacleSpawn() {
  clearTimeout(obstacleSpawnTimeoutId);

  if (!isPlaying) {
    return;
  }

  const spawnDelay = getObstacleSpawnDelay();
  if (spawnDelay === null) {
    hideObstacle();
    return;
  }

  obstacleSpawnTimeoutId = setTimeout(() => {
    showObstacle();
    scheduleObstacleSpawn();
  }, spawnDelay);
}

/**
 * Clears every active timer and timeout used by the game loops.
 */
function stopLoops() {
  clearInterval(timerIntervalId);
  clearInterval(leakIntervalId);
  clearTimeout(obstacleSpawnTimeoutId);
  clearTimeout(obstacleHideTimeoutId);
  timerIntervalId = null;
  leakIntervalId = null;
  obstacleSpawnTimeoutId = null;
  obstacleHideTimeoutId = null;
}

/**
 * Shows the end screen and copies the final win/lose message into the UI.
 *
 * @param {boolean} isWin - Whether the player completed the game successfully.
 */
function showEndScreen(isWin) {
  isPlaying = false;
  stopLoops();

  endOverlay.classList.remove('hidden');

  if (isWin) {
    resultTitle.textContent = 'Victory';
    resultMessage.textContent = 'Well Powered! Your fast tapping brought clean water to a community!';
  } else {
    resultTitle.textContent = 'Game Over';
    resultMessage.textContent = 'Time ran out before the well reached 100%. Try again!';
  }
}

/**
 * Advances the game to the next tier and resets round state.
 */
function levelUpTier() {
  tier += 1;
  roundsCompletedInTier = 0;
  timeLeft = getTierTime(tier);
  waterLevel = 0;
  recentTapTimes = [];
  statusTextEl.textContent = `Tier ${tier} unlocked. Leak pressure increased!`;

  if (tier === 2) {
    statusTextEl.textContent = 'Tier 2 unlocked. Contamination hazard activated!';
  } else if (tier >= 3) {
    statusTextEl.textContent = 'Tier 3 unlocked. Hazards appear more often!';
  }

  updateHud();
  scheduleObstacleSpawn();
}

/**
 * Restarts the tier progress animation.
 */
function pulseTierProgress() {
  tierProgressFillEl.classList.remove('pulse');

  // Restart animation for consecutive round clears.
  void tierProgressFillEl.offsetWidth;
  tierProgressFillEl.classList.add('pulse');
}

/**
 * Resets the timer and playfield for another round in the same tier.
 */
function startNextRoundInSameTier() {
  timeLeft = getTierTime(tier);
  waterLevel = 0;
  recentTapTimes = [];
  meterFillEl.classList.remove('glow');
  hideObstacle();
  updateHud();
  scheduleObstacleSpawn();
}

/**
 * Handles a completed round and decides whether the tier advances.
 */
function completeRound() {
  const roundsRequired = getRoundsRequiredForTier();
  roundsCompletedInTier += 1;
  updateHud();
  pulseTierProgress();

  if (roundsCompletedInTier >= roundsRequired) {
    if (tier >= FINAL_TIER) {
      showEndScreen(true);
      return;
    }

    levelUpTier();
    return;
  }

  startNextRoundInSameTier();
  statusTextEl.textContent = `Round clear! Tier ${tier} progress ${roundsCompletedInTier}/${roundsRequired}.`;
}

/**
 * Performs one timer tick and ends the game when time runs out.
 */
function tickTimer() {
  if (!isPlaying) {
    return;
  }

  timeLeft -= 1;
  updateHud();

  if (timeLeft <= 0) {
    showEndScreen(false);
  }
}

/**
 * Applies the passive leak effect for the current tier.
 */
function tickLeak() {
  if (!isPlaying) {
    return;
  }

  const leakAmount = getLeakAmount();
  if (leakAmount <= 0) {
    return;
  }

  waterLevel = clamp(waterLevel - leakAmount, 0, 100);
  updateHud();
  updateSpeedFeedback();
}

/**
 * Handles a pump tap, updates water level, and checks for round completion.
 */
function handlePumpTap() {
  if (!isPlaying) {
    return;
  }

  recentTapTimes.push(Date.now());
  animatePump();

  const tapGain = getTapGainForTier();
  waterLevel = clamp(waterLevel + tapGain, 0, 100);
  updateHud();
  updateSpeedFeedback();

  if (waterLevel >= TIER_UNLOCK_PERCENT) {
    completeRound();
  }
}

/**
 * Handles a successful obstacle tap.
 */
function handleObstacleTap() {
  if (!isPlaying) {
    return;
  }

  statusTextEl.textContent = 'Great catch! Contamination blocked.';
  hideObstacle();
}

/**
 * Restores the game state without starting a new run.
 */
function resetGameState() {
  const settings = getDifficultySettings();
  stopLoops();
  isPlaying = false;
  timeLeft = settings.baseTimeSeconds;
  waterLevel = 0;
  tier = 0;
  roundsCompletedInTier = 0;
  recentTapTimes = [];
  meterFillEl.classList.remove('glow');
  statusTextEl.textContent = 'Tap rapidly to power the pump and fill the well!';
  missionCardEl.classList.remove('hidden');
  hideObstacle();
  updateHud();
}

/**
 * Starts a fresh game session and activates all gameplay loops.
 */
function startGame() {
  resetGameState();
  isPlaying = true;

  introOverlay.classList.add('hidden');
  missionOverlay.classList.add('hidden');
  difficultyOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  missionCardEl.classList.add('hidden');
  pumpBtn.classList.remove('hidden');

  timerIntervalId = setInterval(tickTimer, 1000);
  leakIntervalId = setInterval(tickLeak, LEAK_TICK_MS);
  scheduleObstacleSpawn();
}

/**
 * Replays the game after the end screen.
 */
function replayGame() {
  endOverlay.classList.add('hidden');
  startGame();
}

/**
 * Returns the user to the intro screen and clears active game UI.
 */
function resetToStartScreen() {
  resetGameState();
  endOverlay.classList.add('hidden');
  missionOverlay.classList.add('hidden');
  difficultyOverlay.classList.add('hidden');
  hud.classList.add('hidden');
  missionCardEl.classList.remove('hidden');
  pumpBtn.classList.add('hidden');
  introOverlay.classList.remove('hidden');
}

openDifficultyBtn.addEventListener('click', showMissionOverlay);
continueToDifficultyBtn.addEventListener('click', showDifficultySelection);
pumpBtn.addEventListener('pointerdown', handlePumpTap);
obstacleEl.addEventListener('pointerdown', handleObstacleTap);
playAgainBtn.addEventListener('click', replayGame);
resetBtn.addEventListener('click', resetToStartScreen);
difficultyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (isPlaying) {
      return;
    }

    setDifficulty(button.dataset.difficulty);
    startGame();
  });
});

// Initialize static values before the game starts.
updateDifficultyUi();
updateHud();
