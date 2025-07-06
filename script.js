// XP required for each level from 1→60
const xpPerLevel = [
  400, 900, 1400, 2100, 2800, 3600, 4500, 5400, 6500, 7600,
  8800, 10100, 11400, 12900, 14400, 16000, 17700, 19400, 21300, 23200,
  25200, 27300, 29400, 31700, 34000, 36400, 38900, 41400, 44300, 47400,
  50800, 54500, 58600, 62800, 67100, 71600, 76100, 80800, 85700, 90700,
  95800, 101000, 106300, 111800, 117500, 123200, 129100, 135100, 141200, 147500,
  153900, 160400, 167100, 173900, 180800, 187900, 195000, 202300, 209800
];

// XP rate formula based on community data: XP/h ≈ 1500 + 630 × level
function getLevelRate(lvl) {
  return 1500 + 630 * lvl; // return baseline XP/hour for given level
}

let chart = null; // global Chart.js instance

function calculate() {
  // read and parse user inputs
  const level = parseInt(document.getElementById('level').value, 10);
  const played = parseFloat(document.getElementById('played').value) || 0;
  const dailyHours = parseFloat(document.getElementById('dailyHours').value) || 0;

  // validate level input
  if (isNaN(level) || level < 1 || level >= 60) {
    alert('Please enter a valid level between 1 and 59');
    return;
  }

  // calculate XP so far and remaining XP to level 60
  //const xpSoFar = xpPerLevel.slice(0, level - 1).reduce((sum, xp) => sum + xp, 0);
  const remainingXP = xpPerLevel.slice(level - 1).reduce((sum, xp) => sum + xp, 0);

  // calculate rested bonus multiplier
  const killFraction = 0.4; // fraction of XP from kills
  const offlineHours = Math.max(0, 24 - dailyHours); // hours offline per day
  const bubbles = Math.min(offlineHours / 8, 30); // max 30 bubbles
  const bonusOnKills = bubbles * 0.05; // 5% per bubble
  const restedBonus = Math.min(killFraction * bonusOnKills, killFraction * 1.5); // cap at 1.5 bubbles worth
  const xpBoost = 1 + restedBonus; // total XP multiplier

  // determine baseline and adjusted XP/hour rates
  const startingRate = getLevelRate(level); // baseline XP/h at current level

  let expectedHours = 0;
  for (let i = 0; i < level - 1; i++) {
    const lvl = i + 1;
    const rate = getLevelRate(lvl);
    expectedHours += xpPerLevel[i] / rate;
  }

  const adjustmentFactor = 0.15
  const expectedToPlayed = played > 0 ? expectedHours / played : 1;
  const playerMultiplier = 1 * (1 - adjustmentFactor) + expectedToPlayed * adjustmentFactor;
  const xpPerHour = startingRate * playerMultiplier * xpBoost;

  // calculate precise hours left to reach level 60
  let hoursLeftPrecise = 0;
  for (let i = level - 1; i < xpPerLevel.length; i++) {
    const lvl = i + 1;
    const levelRate = getLevelRate(lvl);
    const effRate = xpPerHour * (levelRate / startingRate); // adjust per level difficulty
    hoursLeftPrecise += xpPerLevel[i] / effRate;
  }

  // derive displayed hours left (rounded up)
  const hoursLeftDisplay = Math.ceil(hoursLeftPrecise);

  // total hours played including projected
  const totalPlayedHours = played + hoursLeftDisplay;
  const totalDays = Math.floor(totalPlayedHours / 24); // full days
  const totalHoursRem = totalPlayedHours % 24; // leftover hours

  // calculate days left based on dailyHours using displayed hours
  let daysLeftDays = 0;
  let daysLeftHours = 0;
  if (dailyHours > 0) {
    daysLeftDays = Math.floor(hoursLeftDisplay / dailyHours);
    daysLeftHours = hoursLeftDisplay - daysLeftDays * dailyHours;
  }

  // update HTML elements with computed values
  document.getElementById('res-speed').innerText = `+${Math.round(restedBonus * 100)}% rested`;
  document.getElementById('res-xp').innerText = remainingXP.toLocaleString();
  document.getElementById('res-time').innerText = `${hoursLeftDisplay}h (total /played: ${totalDays}d ${totalHoursRem}h)`;
  document.getElementById('res-daily').innerText = dailyHours;
  document.getElementById('res-days').innerText = `${daysLeftDays}d ${daysLeftHours}h`;

  // redraw chart with new rates
  drawChart(xpPerHour, dailyHours, startingRate, level);
}

function drawChart(playerRate, dailyHours, baseRate, startLevel) {
  const data = [];
  let currentDay = 0;
  let lastDay = -1;

  data.push({ x: 0, y: startLevel });

  // Loop through levels from startLevel to 60
  for (let i = startLevel - 1; i < xpPerLevel.length; i++) {
    const lvl = i + 1;
    const levelRate = getLevelRate(lvl);
    const effRate = playerRate * (levelRate / baseRate);
    const hours = xpPerLevel[i] / effRate;
    const days = dailyHours > 0 ? hours / dailyHours : 0;

    currentDay += days;
    const dayInt = Math.floor(currentDay);
    if (dayInt > lastDay) {
      data.push({ x: dayInt, y: lvl });
      lastDay = dayInt;
    }
  }

  const finalPreciseDay = currentDay;
  const finalRoundedDay = Math.ceil(currentDay);
  data.push({ x: finalRoundedDay, y: 60 });
  
  if (data[data.length - 1].y < 60) {
    const trueFinalX = currentDay;
    const displayFinalX = Math.round(trueFinalX);
    data.push({ x: trueFinalX, y: 60 });
    data.push({ x: displayFinalX, y: 60 });
  }

  const ctx = document.getElementById('progressChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Daily Level Progression',
        data,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        borderColor: '#ffcc00', borderWidth: 4, pointRadius: 3, fill: false, tension: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      layout: { padding: { top: 40, right: 30, bottom: 40, left: 30 } },
      plugins: {
        title: { display: true, text: 'Level Progression by Day', color: '#ffcc00', font: { size: 24, weight: 'bold' }, padding: { top: 20, bottom: 20 } },
        legend: { display: false },
        tooltip: { enabled: true, callbacks: { label: ctx => `Day ${Math.round(ctx.parsed.x)} → Level ${ctx.parsed.y}` }}
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          offset: true,
          min: 0,
          max: finalRoundedDay + 1,
          title: { display: true, text: 'Days', color: '#fff', font: { size: 18, weight: 'bold' }, padding: { top: 20, bottom: 10 } },
          ticks: { color: '#fff', stepSize: 1, font: { size: 14 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 15 },
          grid: { color: '#333' }
        },
        y: {
          offset: true,
          title: { display: true, text: 'Level', color: '#fff', font: { size: 18, weight: 'bold' }, padding: { top: 10, bottom: 10 } },
          min: startLevel,
          max: 60,
          ticks: { color: '#fff', stepSize: 5, font: { size: 14 } },
          grid: { color: '#333' }
        }
      }
    }
  });
}
