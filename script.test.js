const test = require('node:test');
const assert = require('node:assert/strict');
const { xpPerLevel, referenceMinutesPerLevel, calculateProjection, formatDuration } = require('./script.js');
const baseline = (level, extra = {}) => calculateProjection({ level, dailyHours: 2, includeRested: false, ...extra });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('reference totals and requested acceptance levels', () => {
  assert.equal(xpPerLevel.length, 59);
  assert.equal(referenceMinutesPerLevel.length, 59);
  assert.equal(baseline(1).remainingXP, 4084700);
  for (const [level, minutes] of [[1, 8990], [20, 7980], [40, 4855], [50, 2705], [59, 295]]) {
    assert.equal(baseline(level).remainingMinutes, minutes);
  }
  assert.equal(baseline(59).remainingXP, 209800);
  assert.equal(referenceMinutesPerLevel[38], 210);
  assert.equal(referenceMinutesPerLevel[39], 190);
});

test('played modifies time in the right direction with a 15% blend', () => {
  const ref = baseline(25);
  const expectedHours = ref.expectedPlayedMinutes / 60;
  close(baseline(25, { played: expectedHours }).remainingMinutes, ref.remainingMinutes);
  close(baseline(25, { played: expectedHours * 0.8 }).remainingMinutes, ref.remainingMinutes * 0.97);
  close(baseline(25, { played: expectedHours * 1.2 }).remainingMinutes, ref.remainingMinutes * 1.03);
  assert.equal(baseline(1, { played: 5 }).playerMultiplier, 1);
  assert.equal(baseline(25).totalPlayedMinutes, null);
});

test('rested remains separate; daily hours affect days but not unboosted time', () => {
  const ref = baseline(40);
  const rested = baseline(40, { includeRested: true });
  close(rested.restedBonus, 0.055);
  close(rested.remainingMinutes, ref.remainingMinutes / 1.055);
  close(baseline(40, { dailyHours: 24, includeRested: true }).remainingMinutes, ref.remainingMinutes);
  assert.equal(baseline(40, { dailyHours: 0.5 }).remainingMinutes, ref.remainingMinutes);
  close(baseline(40, { dailyHours: 0.5 }).daysRequired, ref.daysRequired * 4);
});

test('every reached level is plotted and the endpoint matches the estimate', () => {
  for (let level = 1; level < 60; level++) {
    const result = baseline(level, { played: 31.5, dailyHours: 1.5, includeRested: true });
    assert.equal(result.points.length, 61 - level);
    assert.deepEqual(result.points[0], { x: 0, y: level });
    result.points.slice(1).forEach((point, i) => {
      assert.equal(point.y, level + i + 1);
      assert.ok(point.x > result.points[i].x);
    });
    assert.equal(result.points.at(-1).y, 60);
    close(result.points.at(-1).x, result.daysRequired);
    close(result.daysRequired * 90, result.remainingMinutes);
  }
});

test('invalid numeric inputs are rejected', () => {
  for (const level of [0, 60, 20.5, NaN, Infinity]) assert.throws(() => baseline(level), RangeError);
  for (const played of [-1, NaN, Infinity]) assert.throws(() => baseline(20, { played }), RangeError);
  for (const dailyHours of [0, -1, 25, NaN, Infinity]) assert.throws(() => baseline(20, { dailyHours }), RangeError);
});

test('minute display carries into hours and days', () => {
  assert.equal(formatDuration(295), '4h 55m');
  assert.equal(formatDuration(8990, true), '6d 5h 50m');
  assert.equal(formatDuration(1439.9, true), '1d 0h 0m');
  assert.equal(formatDuration(59.9), '1h 0m');
});

const { getXpBoost, getDungeonAdjustments, getDungeonExtraXP } = require('./script.js');
const { dungeonData, dungeonBlocks } = require('./dungeons.js');
const forever = { version:'forever', includeRested:false, dailyHours:2 };

test('Sleeping Bag starts at 14, food affects kills only, Vanilla ignores buffs',()=>{
  close(getXpBoost(13,{...forever,sleepingBag:true}).total,1);
  close(getXpBoost(14,{...forever,sleepingBag:true}).total,1.03);
  close(getXpBoost(30,{...forever,foodBuff:true}).total,1.02);
  close(getXpBoost(30,{...forever,foodBuff:true,sleepingBag:true}).total,1.05);
  close(getXpBoost(30,{...forever,version:'vanilla',foodBuff:true,sleepingBag:true}).total,1);
});

test('35 distinct dungeons, nine new, with valid level ranges and no duplicate package XP',()=>{
  assert.equal(dungeonData.length,35);
  assert.equal(new Set(dungeonData.map(d=>d.id)).size,35);
  assert.equal(dungeonData.filter(d=>d.kind==='new').length,9);
  for(const dungeon of dungeonData) {
    assert.ok(dungeon.typicalLevel>=dungeon.minLevel&&dungeon.typicalLevel<=dungeon.maxLevel);
  }
  for(const [group,total] of [['sm',11000],['dire-maul',70000],['stratholme',125000]]) {
    const members=dungeonData.filter(d=>d.packageId===group);
    close(members.reduce((sum,d)=>sum+d.packageShare,0),1);
    close(members.reduce((sum,d)=>sum+getDungeonExtraXP(d,'alliance')*d.packageShare,0),total);
  }
});

test('both factions receive a whole-route scenario and Typical applies 65% once',()=>{
  for(const faction of ['alliance','horde']) {
    const off=baseline(1,{...forever,faction});
    const all=baseline(1,{...forever,faction,dungeonMode:'all'});
    const typical=baseline(1,{...forever,faction,dungeonMode:'typical'});
    assert.equal(all.dungeonBreakdown.length,5);
    assert.ok(all.dungeonAdjustmentMinutes>600&&all.dungeonAdjustmentMinutes<1000);
    close(typical.dungeonAdjustmentMinutes,all.dungeonAdjustmentMinutes*0.65);
    assert.equal(all.remainingXP,off.remainingXP);
    assert.ok(all.remainingMinutes<typical.remainingMinutes&&typical.remainingMinutes<off.remainingMinutes);
    for(const block of all.dungeonBreakdown) close(block.reduction,block.routeQuestXP*0.4/block.blockXP);
  }
});

test('raw block budgets reconcile with the supplied route estimates',()=>{
  const alliance=baseline(1,{...forever,dungeonMode:'all'}).dungeonBreakdown;
  const horde=baseline(1,{...forever,faction:'horde',dungeonMode:'all'}).dungeonBreakdown;
  [56250,51100,128100,193500,402000].forEach((xp,i)=>close(alliance[i].routeQuestXP,xp));
  [44650,55400,133600,193500,407000].forEach((xp,i)=>close(horde[i].routeQuestXP,xp));
  assert.ok(alliance.at(-1).routeQuestXP<500000); // Not the sum of all theoretical late chains.
});

test('actual replacement rewards automatically update the model',()=>{
  const data=dungeonData.map(d=>({...d,questXp:{...d.questXp},classicQuestXp:{...d.classicQuestXp}}));
  const dm=data.find(d=>d.id==='deadmines');
  dm.questXp.alliance+=1000;
  const options={...forever,level:1,faction:'alliance',dungeonMode:'all'};
  const before=getDungeonAdjustments(options,referenceMinutesPerLevel).breakdown[0];
  const after=getDungeonAdjustments(options,referenceMinutesPerLevel,data).breakdown[0];
  close(after.rawQuestXP-before.rawQuestXP,1000);
  const late=data.find(d=>d.id==='shaper');
  late.questXp.alliance=150000;
  assert.equal(getDungeonExtraXP(late,'alliance'),150000);
});

test('past block savings are not re-awarded and late levels still benefit',()=>{
  for(const level of [13,15,20,30,40,50,59]) {
    const off=baseline(level,{...forever});
    const on=baseline(level,{...forever,dungeonMode:'typical'});
    assert.ok(on.remainingMinutes<off.remainingMinutes);
    assert.ok(on.dungeonBreakdown.every(block=>block.maxLevel>level));
  }
  const earlier=baseline(18,{...forever,dungeonMode:'all'});
  const later=baseline(19,{...forever,dungeonMode:'all'});
  assert.ok(later.dungeonAdjustmentMinutes<earlier.dungeonAdjustmentMinutes);
  close(baseline(59,{...forever,dungeonMode:'all'}).dungeonAdjustmentMinutes,
    referenceMinutesPerLevel[58]*baseline(1,{...forever,dungeonMode:'all'}).dungeonBreakdown.at(-1).reduction);
});

test('Vanilla unchanged; every mode keeps totals and graph aligned across all levels',()=>{
  close(baseline(1,{version:'vanilla',dungeonMode:'all'}).remainingMinutes,8990);
  for(let level=1;level<60;level++) {
    for(const dungeonMode of ['off','typical','all']) {
      const result=baseline(level,{...forever,includeRested:true,sleepingBag:true,foodBuff:true,played:31.5,dungeonMode});
      close(result.baseRemainingMinutes-result.dungeonAdjustmentMinutes,result.remainingMinutes);
      close(result.dungeonBreakdown.reduce((sum,item)=>sum+item.savedMinutes,0),result.dungeonAdjustmentMinutes);
      close(result.points.at(-1).x*120,result.remainingMinutes);
      result.points.slice(1).forEach((point,i)=>assert.ok(point.x>result.points[i].x));
    }
  }
});

test('extreme reward data cannot erase a level, and invalid settings fail',()=>{
  const giant=dungeonData.map(d=>({...d,questXp:{alliance:1e12,horde:1e12},classicQuestXp:{alliance:0,horde:0}}));
  const result=getDungeonAdjustments({...forever,level:1,faction:'alliance',dungeonMode:'all'},referenceMinutesPerLevel,giant);
  result.adjustments.forEach((minutes,i)=>assert.ok(minutes<=referenceMinutesPerLevel[i]*0.3+1e-8));
  for(const options of [{version:'invalid'},{faction:'invalid'},{dungeonMode:'invalid'},{dailyHours:0.001}]) assert.throws(()=>baseline(20,options),RangeError);
});
