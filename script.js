// script.js

// XP required for each level from 1→60
const xpPerLevel = [
  400, 900, 1400, 2100, 2800, 3600, 4500, 5400, 6500, 7600,
  8800, 10100, 11400, 12900, 14400, 16000, 17700, 19400, 21300, 23200,
  25200, 27300, 29400, 31700, 34000, 36400, 38900, 41400, 44300, 47400,
  50800, 54500, 58600, 62800, 67100, 71600, 76100, 80800, 85700, 90700,
  95800, 101000, 106300, 111800, 117500, 123200, 129100, 135100, 141200, 147500,
  153900, 160400, 167100, 173900, 180800, 187900, 195000, 202300, 209800
];

// XP rate formula based on community data: XP/h ≈ 1500 + 500 × level
function getLevelRate(lvl) {
  return 1500 + 630 * lvl;
}

let chart = null;

function calculate() {
  const level      = parseInt(document.getElementById('level').value, 10);
  const played     = parseFloat(document.getElementById('played').value) || 0;
  const dailyHours = parseFloat(document.getElementById('dailyHours').value) || 0;
  const defaultXpPerHour = 26024;

  // Approximate fraction of XP from kills
  const killFraction = 0.4;
  // Rested bonus: 1 bubble (5%) per 8h offline, max 30 bubbles
  const offlineHours = Math.max(0, 24 - dailyHours);
  const bubbles      = Math.min(offlineHours / 8, 30);
  const bonusOnKills = bubbles * 0.05;
  const restedBonus  = Math.min(killFraction * bonusOnKills, killFraction * 1.5);
  const xpBoost      = 1 + restedBonus;

  if (level < 1 || level >= 60) {
    document.getElementById('result').innerText = 'Enter a level between 1 and 59.';
    return;
  }

  const xpSoFar     = xpPerLevel.slice(0, level - 1).reduce((a, x) => a + x, 0);
  const remainingXP = xpPerLevel.slice(level - 1).reduce((a, x) => a + x, 0);

  const baseXpPerHour = played > 0 ? xpSoFar / played : defaultXpPerHour;
  const xpPerHour     = baseXpPerHour * xpBoost;

  let hoursLeft = 0;
  for (let i = level - 1; i < xpPerLevel.length; i++) {
    const lvl      = i + 1;
    const levelRate = getLevelRate(lvl);
    const effRate  = xpPerHour * (levelRate / baseXpPerHour);
    hoursLeft     += xpPerLevel[i] / effRate;
  }

  const daysLeft = hoursLeft / dailyHours;
  const totalPlayedHours = played + hoursLeft;
  const totalDays        = Math.floor(totalPlayedHours / 24);
  const totalHoursRem    = Math.round(totalPlayedHours % 24);

  const d = Math.floor(daysLeft);
  const h = Math.round((daysLeft - d) * dailyHours);

  document.getElementById('result').innerText = `
Based on your speed (+${Math.round(restedBonus * 100)}% rested on kills):
Remaining XP: ${remainingXP.toLocaleString()}
Estimated time to 60: ${Math.ceil(hoursLeft)}h (total /played: ${totalDays}d ${totalHoursRem}h)
Days left (at ${dailyHours}h/day): ${d}d ${h}h
`;

  drawChart(xpPerHour, dailyHours, baseXpPerHour, level);
}

function drawChart(playerRate, dailyHours, baseRate, startLevel) {
  const data = [];
  let currentDay = 0;
  let lastDay    = -1;

  data.push({ x: 0, y: startLevel });

  for (let i = startLevel - 1; i < xpPerLevel.length; i++) {
    const lvl       = i + 1;
    const levelRate = getLevelRate(lvl);
    const effRate   = playerRate * (levelRate / baseRate);
    const hours     = xpPerLevel[i] / effRate;
    const days      = hours / dailyHours;

    currentDay += days;
    const dayInt = Math.floor(currentDay);
    if (dayInt > lastDay) {
      if (dayInt >= 365) {
        data.push({ x: 365, y: 60 });
        break;
      }
      data.push({ x: dayInt, y: lvl });
      lastDay = dayInt;
    }
  }

  const ctx = document.getElementById('progressChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [{
      label: 'Daily Level Progression',
      data,
      parsing: { xAxisKey: 'x', yAxisKey: 'y' },
      borderColor: '#ffcc00', borderWidth: 4, pointRadius: 3, fill: false, tension: 0
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 40, right: 30, bottom: 40, left: 30 } },
      plugins: {
        title: { display: true, text: 'Level Progression by Day', color: '#ffcc00', font: { size: 24, weight: 'bold' }, padding: { top: 20, bottom: 20 } },
        legend: { display: false },
        tooltip:{ callbacks:{ label: ctx=> `Day ${ctx.parsed.x} → Level ${ctx.parsed.y}` }}
      },
      scales:{
        x:{ type:'linear', position:'bottom', offset:true,
          title:{ display:true, text:'Days', color:'#fff', font:{ size:18, weight:'bold' }, padding:{ top:20, bottom:10 } },
          ticks:{ color:'#fff', stepSize:1, font:{ size:14 }, maxRotation:0, autoSkip:true, autoSkipPadding:15 }, grid:{ color:'#333' }
        },
        y:{ offset:true,
          title:{ display:true, text:'Level', color:'#fff', font:{ size:18, weight:'bold' }, padding:{ top:10, bottom:10 } },
          min:startLevel, max:60, ticks:{ color:'#fff', stepSize:5, font:{ size:14 } }, grid:{ color:'#333' }
        }
      }
    }
  });
}