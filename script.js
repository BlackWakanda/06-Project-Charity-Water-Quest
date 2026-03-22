const BASE_TIME_SECONDS = 20;
const MAX_TIME_SECONDS = 180;
const BASE_TAP_GAIN = 2.9;
const MIN_TAP_GAIN = 2.0;
const LEAK_TICK_MS = 100;
const TIER_UNLOCK_PERCENT = 100;
const OBSTACLE_VISIBLE_MS = 1400;
const FINAL_TIER = 3;

const startOverlay = document.getElementById('start-overlay');
const endOverlay = document.getElementById('end-overlay');
const hud = document.getElementById('hud');
const pumpPanel = document.querySelector('.pump-panel');

const timerEl = document.getElementById('timer');
const purityEl = document.getElementById('purity');
const tierEl = document.getElementById('tier');
const meterFillEl = document.getElementById('meter-fill');
const statusTextEl = document.getElementById('status-text');
const dropletEl = document.getElementById('droplet');
const obstacleEl = document.getElementById('obstacle');

const startBtn = document.getElementById('start-game');
const pumpBtn = document.getElementById('pump-btn');
const playAgainBtn = document.getElementById('play-again');
const resetBtn = document.getElementById('reset-game');

const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');

let isPlaying = false;
let timeLeft = BASE_TIME_SECONDS;
let waterLevel = 0;
let tier = 0;
let timerIntervalId = null;
let leakIntervalId = null;
let obstacleSpawnTimeoutId = null;
let obstacleHideTimeoutId = null;
let recentTapTimes = [];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTierTime(secondsTier) {
  // Time increases a little each tier, but not enough to cancel the difficulty jump.
  const scaled = BASE_TIME_SECONDS + (secondsTier * 5);
  return Math.min(scaled, MAX_TIME_SECONDS);
}

function getTapGainForTier() {
  // Difficulty still rises by tier, but with a gentler drop in tap reward.
  return Math.max(MIN_TAP_GAIN, BASE_TAP_GAIN - (tier * 0.25));
}

function getLeakAmount() {
  if (tier === 0) {
    return 0;
  }

  // Leak ramps up more gradually so tiers remain beatable.
  return 0.28 + (tier * 0.12);
}

function getObstacleMissPenalty() {
  return 9 + (tier * 3);
}

function getObstacleSpawnDelay() {
  if (tier < 2) {
    return null;
  }

  // Tier 2 is intentionally calmer; Tier 3 speeds up slightly.
  if (tier === 2) {
    return 3800;
  }

  if (tier === 3) {
    return 2700;
  }

  return 2200;
}

function updateHud() {
  timerEl.textContent = `${Math.ceil(timeLeft)}s`;
  purityEl.textContent = `${Math.round(waterLevel)}%`;
  tierEl.textContent = `Tier ${tier}`;
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
  obstacleHideTimeoutId = setTimeout(handleMissedObstacle, OBSTACLE_VISIBLE_MS);
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
    if (tier >= FINAL_TIER) {
      showEndScreen(true);
      return;
    }

    levelUpTier();
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
  stopLoops();
  isPlaying = false;
  timeLeft = BASE_TIME_SECONDS;
  waterLevel = 0;
  tier = 0;
  recentTapTimes = [];
  meterFillEl.classList.remove('glow');
  statusTextEl.textContent = 'Tap rapidly to power the pump and fill the well!';
  hideObstacle();
  updateHud();
}

function startGame() {
  resetGameState();
  isPlaying = true;

  startOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
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
  hud.classList.add('hidden');
  pumpBtn.classList.add('hidden');
  startOverlay.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
pumpBtn.addEventListener('pointerdown', handlePumpTap);
obstacleEl.addEventListener('pointerdown', handleObstacleTap);
playAgainBtn.addEventListener('click', replayGame);
resetBtn.addEventListener('click', resetToStartScreen);

// Initialize static values before the game starts.
updateHud();
