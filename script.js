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

function getDifficultySettings() {
  return DIFFICULTY_PRESETS[selectedDifficulty] || DIFFICULTY_PRESETS.normal;
}

function getRoundsRequiredForTier() {
  const settings = getDifficultySettings();
  const tierTargets = settings.roundsNeededByTier || [2, 2, 3, 3];
  const fallbackTarget = tierTargets[tierTargets.length - 1] || 3;
  return tierTargets[tier] || fallbackTarget;
}

function updateDifficultyUi() {
  const settings = getDifficultySettings();
  modeDisplayEl.textContent = `Mode: ${settings.label}`;

  difficultyButtons.forEach((button) => {
    const isActive = button.dataset.difficulty === selectedDifficulty;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function setDifficulty(nextDifficulty) {
  if (!DIFFICULTY_PRESETS[nextDifficulty]) {
    return;
  }

  selectedDifficulty = nextDifficulty;
  updateDifficultyUi();
  resetGameState();
}

function showMissionOverlay() {
  introOverlay.classList.add('hidden');
  missionOverlay.classList.remove('hidden');
}

function showDifficultySelection() {
  missionOverlay.classList.add('hidden');
  difficultyOverlay.classList.remove('hidden');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTierTime(secondsTier) {
  const settings = getDifficultySettings();
  // Time increases a little each tier, but not enough to cancel the difficulty jump.
  const scaled = settings.baseTimeSeconds + (secondsTier * settings.timePerTierSeconds);
  return Math.min(scaled, MAX_TIME_SECONDS);
}

function getTapGainForTier() {
  const settings = getDifficultySettings();
  // Difficulty still rises by tier, but with a gentler drop in tap reward.
  return Math.max(settings.minTapGain, settings.baseTapGain - (tier * settings.tapGainDropPerTier));
}

function getLeakAmount() {
  const settings = getDifficultySettings();
  if (tier === 0) {
    return 0;
  }

  // Leak ramps up more gradually so tiers remain beatable.
  return settings.leakBase + (tier * settings.leakTierStep);
}

function getObstacleMissPenalty() {
  const settings = getDifficultySettings();
  // Keep misses meaningful without wiping too much progress for new players.
  return settings.missPenaltyBase + (tier * settings.missPenaltyTierStep);
}

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

function hideObstacle() {
  obstacleEl.classList.add('hidden');
}

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

function pulseTierProgress() {
  tierProgressFillEl.classList.remove('pulse');

  // Restart animation for consecutive round clears.
  void tierProgressFillEl.offsetWidth;
  tierProgressFillEl.classList.add('pulse');
}

function startNextRoundInSameTier() {
  timeLeft = getTierTime(tier);
  waterLevel = 0;
  recentTapTimes = [];
  meterFillEl.classList.remove('glow');
  hideObstacle();
  updateHud();
  scheduleObstacleSpawn();
}

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

function handleObstacleTap() {
  if (!isPlaying) {
    return;
  }

  statusTextEl.textContent = 'Great catch! Contamination blocked.';
  hideObstacle();
}

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

function replayGame() {
  endOverlay.classList.add('hidden');
  startGame();
}

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
