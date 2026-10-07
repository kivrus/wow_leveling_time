// XP required for each level from 1 to 60; index 0 is 1 → 2.
const xpPerLevel = [
  400, 900, 1400, 2100, 2800, 3600, 4500, 5400, 6500, 7600,
  8800, 10100, 11400, 12900, 14400, 16000, 17700, 19400, 21300, 23200,
  25200, 27300, 29400, 31700, 34000, 36400, 38900, 41400, 44300, 47400,
  50800, 54500, 58600, 62800, 67100, 71600, 76100, 80800, 85700, 90700,
  95800, 101000, 106300, 111800, 117500, 123200, 129100, 135100, 141200, 147500,
  153900, 160400, 167100, 173900, 180800, 187900, 195000, 202300, 209800
];

// Chosen reference pace, not a measured population average. No rested included.
const referenceMinutesPerLevel = [
  // 1–10
  10, 15, 20, 25, 30, 30, 35, 40, 40,
  // 10–20
  60, 60, 65, 70, 75, 80, 85, 85, 90, 95,
  // 20–30
  110, 115, 120, 125, 130, 135, 140, 145, 145, 155,
  // 30–40
  150, 155, 165, 170, 175, 185, 190, 200, 205, 210,
  // 40–50
  190, 195, 200, 205, 210, 220, 225, 230, 235, 240,
  // 50–60
  245, 250, 255, 260, 270, 275, 280, 285, 290, 295
];

const dungeonModel = typeof module !== 'undefined' && module.exports
  ? require('./dungeons.js') : { dungeonData, dungeonBlocks, DUNGEON_EFFECTIVE_FACTOR, DUNGEON_TYPICAL_FACTOR };
const KILL_XP_FRACTION = 0.4; // Planning assumption; the rest is quests/exploration.

// Existing approximation retained. Assume logout in a rested area between sessions.
function getRestedBonus(dailyHours) {
  return KILL_XP_FRACTION * Math.max(0, 24 - dailyHours) / 8 * 0.05;
}

function getXpBoost(level, { version = 'vanilla', sleepingBag = false, foodBuff = false, dailyHours, includeRested = true }) {
  const rested = includeRested ? getRestedBonus(dailyHours) : 0;
  const bag = version === 'forever' && sleepingBag && level >= 14 ? 0.03 : 0;
  const food = version === 'forever' && foodBuff ? 0.05 : 0;
  // Additive bonuses are a modeling assumption, not a verified in-game stacking rule.
  return { total: 1 + rested + bag + KILL_XP_FRACTION * food,
    quest: 1 + bag, mob: 1 + rested / KILL_XP_FRACTION + bag + food };
}

function getDungeonExtraXP(dungeon, faction) {
  const quest=dungeon.questXp[faction], classic=dungeon.classicQuestXp[faction];
  if(Number.isFinite(quest) && (dungeon.kind==='new' || Number.isFinite(classic))) {
    return Math.max(0, dungeon.kind==='new'?quest:quest-classic);
  }
  const range=dungeon.extraQuestXP[faction];
  return range ? (range[0]+range[1])/2 : 0;
}

// Block-level planning scenario. No free XP subtraction and no second mob/run penalty.
function getDungeonAdjustments({ level, faction, dungeonMode, version }, levelMinutes, data = dungeonModel.dungeonData) {
  const adjustments = Array(59).fill(0);
  const breakdown = [];
  if (version !== 'forever' || dungeonMode === 'off') return { adjustments, breakdown };
  const attendance = dungeonMode === 'typical' ? dungeonModel.DUNGEON_TYPICAL_FACTOR : 1;
  for (const block of dungeonModel.dungeonBlocks) {
    const dungeons = data.filter(dungeon => dungeon.typicalLevel >= block.minLevel && dungeon.typicalLevel < block.maxLevel && (dungeon.faction === faction || dungeon.faction === 'both'));
    const rawQuestXP = dungeons.reduce((sum, dungeon) => {
      return sum + getDungeonExtraXP(dungeon, faction) * dungeon.packageShare;
    }, 0);
    const routeQuestXP = rawQuestXP * block.routeCoverage;
    const effectiveXP = routeQuestXP * dungeonModel.DUNGEON_EFFECTIVE_FACTOR * attendance;
    const blockXP = xpPerLevel.slice(block.minLevel - 1, block.maxLevel - 1).reduce((sum, xp) => sum + xp, 0);
    const reduction = Math.min(0.3, effectiveXP / blockXP); // Forecast guard, not a game rule.
    let savedMinutes = 0;
    // Completed parts of a block are never credited again. Smooth the scenario over the block.
    for (let lvl = Math.max(level, block.minLevel); lvl < block.maxLevel; lvl++) {
      adjustments[lvl - 1] = levelMinutes[lvl - 1] * reduction;
      savedMinutes += adjustments[lvl - 1];
    }
    if (level < block.maxLevel) breakdown.push({ ...block, rawQuestXP, routeQuestXP, effectiveXP, blockXP, reduction, savedMinutes });
  }
  return { adjustments, breakdown };
}

function calculateProjection({ level, played = 0, dailyHours, includeRested = true,
  version = 'vanilla', sleepingBag = false, foodBuff = false, faction = 'alliance', dungeonMode = 'off' }) {
  if (!Number.isInteger(level) || level < 1 || level > 59) throw new RangeError('level');
  if (!Number.isFinite(played) || played < 0 || played > 1000000) throw new RangeError('played');
  if (!Number.isFinite(dailyHours) || dailyHours < 0.1 || dailyHours > 24) throw new RangeError('dailyHours');
  if (!['vanilla', 'forever'].includes(version) || !['alliance', 'horde'].includes(faction)
      || !['off', 'typical', 'all'].includes(dungeonMode)) throw new RangeError('settings');
  const sum = values => values.reduce((total, value) => total + value, 0);
  const options = { level, version, sleepingBag, foodBuff, dailyHours, includeRested, faction, dungeonMode };
  const expectedPlayedMinutes = sum(referenceMinutesPerLevel.slice(0, level - 1));
  const rawMultiplier = played > 0 && expectedPlayedMinutes > 0 ? played * 60 / expectedPlayedMinutes : 1;
  const playerMultiplier = 0.85 + rawMultiplier * 0.15;
  const levelMinutes = referenceMinutesPerLevel.map((minutes, i) => {
    // Amortize 3 minutes of setup per 120 active buff minutes, without rounding
    // separately at each level or restarting the cycle every play session.
    const bagTimeFactor = version === 'forever' && sleepingBag && i + 1 >= 14 ? 123 / 120 : 1;
    return minutes * playerMultiplier / getXpBoost(i + 1, options).total * bagTimeFactor;
  });
  const dungeonResult = getDungeonAdjustments(options, levelMinutes);
  const baseRemainingMinutes = sum(levelMinutes.slice(level - 1));
  let remainingMinutes = 0;
  const points = [{ x: 0, y: level }];
  for (let lvl = level; lvl < 60; lvl++) {
    remainingMinutes += levelMinutes[lvl - 1] - dungeonResult.adjustments[lvl - 1];
    points.push({ x: remainingMinutes / 60 / dailyHours, y: lvl + 1 });
  }
  return {
    remainingXP: sum(xpPerLevel.slice(level - 1)), expectedPlayedMinutes, playerMultiplier,
    restedBonus: includeRested ? getRestedBonus(dailyHours) : 0,
    referenceRemainingMinutes: sum(referenceMinutesPerLevel.slice(level - 1)), baseRemainingMinutes,
    dungeonAdjustmentMinutes: sum(dungeonResult.adjustments),
    dungeonBreakdown: dungeonResult.breakdown,
    remainingMinutes, daysRequired: remainingMinutes / 60 / dailyHours,
    totalPlayedMinutes: played > 0 || level === 1 ? played * 60 + remainingMinutes : null, points
  };
}

function formatDuration(minutes, useDays = false, language = 'en') {
  const rounded = Math.round(Math.abs(minutes));
  const days = useDays ? Math.floor(rounded / 1440) : 0;
  const hours = Math.floor((rounded - days * 1440) / 60);
  const units = language === 'ru' ? ['д', 'ч', 'мин'] : ['d', 'h', 'm'];
  return `${useDays ? `${days}${units[0]} ` : ''}${hours}${units[1]} ${rounded % 60}${units[2]}`;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { xpPerLevel, referenceMinutesPerLevel, calculateProjection, formatDuration,
    getXpBoost, getDungeonAdjustments, getDungeonExtraXP };
}
