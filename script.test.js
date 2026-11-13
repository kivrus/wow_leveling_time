const test = require('node:test');
const assert = require('node:assert/strict');
const { xpPerLevel, referenceMinutesPerLevel, calculateProjection, formatDuration, accrueRestedXP, simulateProgress,
  getRestedEfficiency, getLocalDateString, getCalendarDate, getMilestoneDates } = require('./script.js');
const baseline = (level, extra = {}) => calculateProjection({ level, dailyHours: 2, includeRested: false, ...extra });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('/played view adds known past time and preserves the original forecast and calendar days', () => {
  const {getProgressView}=require('./script.js');
  const result=calculateProjection({level:37,played:61,dailyHours:2});
  const before=structuredClone(result);
  const view=getProgressView(result,'played');
  assert.equal(view.hasTotalPlayed,true);
  close(view.points[0].x,61);
  close(view.points.at(-1).x*60,result.totalPlayedMinutes);
  view.points.forEach((p,i)=>{
    close(p.daysFromStart,result.points[i].x);
    close(p.playedMinutes,61*60+result.points[i].x*120);
  });
  assert.deepEqual(getProgressView(result,'days').points.map(({x,y})=>({x,y})),result.points);
  assert.deepEqual(result,before);
});

test('/played view labels unknown past time as remaining; a fresh character starts at zero', () => {
  const {getProgressView,formatPlayedTime}=require('./script.js');
  const existing=calculateProjection({level:37,dailyHours:2});
  const view=getProgressView(existing,'played');
  assert.equal(view.hasTotalPlayed,false);
  close(view.points[0].x,0);
  close(view.points.at(-1).playedMinutes,existing.remainingMinutes);
  assert.equal(getProgressView(calculateProjection({level:1,dailyHours:2}),'played').hasTotalPlayed,true);
  assert.equal(formatPlayedTime(1890),'1d 7h 30m');
  assert.equal(formatPlayedTime(1439.9),'1d');
  assert.equal(formatPlayedTime(0),'0m');
  assert.equal(formatPlayedTime(4445,'ru'),'3 д. 2 ч. 5 мин.');
  assert.equal(formatPlayedTime(1439.9,'ru'),'1 д.');
  assert.equal(formatPlayedTime(0,'ru'),'0 мин.');
});

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
  assert.ok(rested.remainingMinutes < ref.remainingMinutes);
  close(rested.restedBonus, ref.remainingMinutes / rested.remainingMinutes - 1);
  close(baseline(40, { dailyHours: 24, includeRested: true }).remainingMinutes, ref.remainingMinutes);
  assert.equal(baseline(40, { dailyHours: 0.5 }).remainingMinutes, ref.remainingMinutes);
  close(baseline(40, { dailyHours: 0.5 }).daysRequired, ref.daysRequired * 4);
});

test('rested bar units, overnight accumulation, and ten-day cap', () => {
  close(accrueRestedXP(0, 10000, 8), 250); // 500 displayed XP = 250 normal + 250 bonus.
  close(accrueRestedXP(0, 10000, 23), 718.75);
  close(accrueRestedXP(0, 10000, 240), 7500);
  close(accrueRestedXP(7400, 10000, 1000), 7500);
  close(accrueRestedXP(250, 10000, 0), 250);
});

test('pool depletes on kills only, never on quest XP', () => {
  const segment = {xp:1000, xpPerMinute:10, killXpPerMinute:4};
  const options = {dailyHours:24, includeRested:true, initialRestedXP:100};
  const depleted = simulateProgress([segment], options);
  close(depleted.levelMinutes[0], 90); // 100 bonus XP replaces ten minutes.
  close(depleted.restedXP, 100);
  close(depleted.remainingRestedXP, 0);
  const quests = simulateProgress([{...segment, killXpPerMinute:0}], options);
  close(quests.levelMinutes[0], 100);
  close(quests.remainingRestedXP, 100);
  const full = simulateProgress([segment], {...options, initialRestedXP:750});
  close(full.levelMinutes[0], 100/1.4);
});

test('sessions span levels, reserve stays in absolute XP, and partial final sessions do not accrue rest', () => {
  const options = {dailyHours:1, includeRested:true, initialRestedXP:0};
  const segments = [
    {xp:300, xpPerMinute:10, killXpPerMinute:4}, // 30 minutes, no rest.
    {xp:1000, xpPerMinute:10, killXpPerMinute:4}
  ];
  const result = simulateProgress(segments, options);
  // At minute 60: +71.875 bonus XP, spent before next rest at minute 120.
  // The next session starts with 71.875 more, and finishes while still rested.
  const finalXP = 1000 - 300 - 600 - 71.875;
  close(result.levelMinutes[0], 30);
  close(result.levelMinutes[1], 90 + finalXP / 14);
  close(result.remainingRestedXP, 71.875 - finalXP / 14 * 4);
  const carry = simulateProgress([
    {xp:100, xpPerMinute:10, killXpPerMinute:0},
    {xp:1000, xpPerMinute:10, killXpPerMinute:4}
  ], {...options, dailyHours:24, initialRestedXP:50});
  close(carry.levelMinutes[1], 95); // Pool does not grow tenfold at a level-up.
});

test('repeated sessions remain accurate when the pool caps or empties', () => {
  const options = {dailyHours:1, includeRested:true, initialRestedXP:0};
  // Quest-only progress takes exactly 100 sessions; the reserve caps at 750.
  const questOnly = simulateProgress([{xp:1000, xpPerMinute:1/6, killXpPerMinute:0}], options);
  close(questOnly.levelMinutes[0], 6000);
  close(questOnly.remainingRestedXP, 750);
  // Same-rate levels have identical time to one continuous level when there
  // is no nightly refill (24h/day), even if the initial pool runs out midway.
  const whole = simulateProgress([{xp:2000, xpPerMinute:1, killXpPerMinute:0.4}], {...options,dailyHours:24,initialRestedXP:100});
  const split = simulateProgress(Array(2).fill({xp:1000,xpPerMinute:1,killXpPerMinute:0.4}), {...options,dailyHours:24,initialRestedXP:100});
  close(split.levelMinutes.reduce((a,b)=>a+b,0), whole.levelMinutes[0]);
  const extreme = baseline(2, {played:1000000,dailyHours:0.1,includeRested:true});
  assert.ok(Number.isFinite(extreme.remainingMinutes));
  assert.ok(extreme.remainingMinutes > 0);
});

test('rested benefit is bounded, depends on level pace, and preserves daily-time semantics', () => {
  const noRest = baseline(50, {played:99});
  const oneHour = baseline(50, {played:99, dailyHours:1, includeRested:true});
  const sixHours = baseline(50, {played:99, dailyHours:6, includeRested:true});
  assert.ok(oneHour.remainingMinutes < sixHours.remainingMinutes);
  assert.ok(oneHour.daysRequired > sixHours.daysRequired);
  assert.ok(oneHour.remainingMinutes >= noRest.remainingMinutes / 1.4);
  close(oneHour.playerMultiplier, noRest.playerMultiplier);
  const early = baseline(15, {dailyHours:1, includeRested:true});
  const earlyTime = early.points.find(p=>p.y===20).x * 60;
  const earlyBaseline = referenceMinutesPerLevel.slice(14,19).reduce((a,b)=>a+b,0);
  assert.ok(1 - oneHour.remainingMinutes/noRest.remainingMinutes > 1 - earlyTime/earlyBaseline);
  close(baseline(1, {includeRested:true}).initialRestedXP, 0);
  close(oneHour.initialRestedXP, xpPerLevel[49]*23*0.025/8*getRestedEfficiency(50));
  for (const initialRestedXP of [-1, NaN, Infinity]) assert.throws(()=>baseline(50,{initialRestedXP}), RangeError);
});

test('rested calibration is smooth, bounded, and only affects new accrual', () => {
  for(let level=1;level<=60;level++) {
    const efficiency=getRestedEfficiency(level);
    assert.ok(efficiency>0 && efficiency<1);
    if(level>1) assert.ok(efficiency>getRestedEfficiency(level-1));
  }
  assert.ok(getRestedEfficiency(15)<0.3);
  assert.ok(getRestedEfficiency(60)>0.8);
  close(accrueRestedXP(500,10000,8,getRestedEfficiency(15)),500+250*getRestedEfficiency(15));
  close(accrueRestedXP(500,10000,0,getRestedEfficiency(15)),500);
  close(baseline(15,{includeRested:true,initialRestedXP:500}).initialRestedXP,500);
  assert.deepEqual(baseline(15,{initialRestedXP:500}),baseline(15));
  close(baseline(1).remainingMinutes,8990);
});

test('nightly accrual and both repeated-cycle optimizations use calibrated efficiency', () => {
  for(const level of [15,38,59]) {
    const nightly=1000*23*0.025/8*getRestedEfficiency(level);
    const depleted=simulateProgress([{level,xp:1000,xpPerMinute:1,killXpPerMinute:0.4}],
      {dailyHours:1,includeRested:true,initialRestedXP:nightly});
    // Each full session earns 60 normal XP plus its nightly pool (all consumed).
    if(nightly<=24) {
      const complete=Math.ceil(1000/(60+nightly))-1;
      const left=1000-complete*(60+nightly);
      const finalMinutes=left<=nightly/0.4*1.4?left/1.4:left-nightly;
      close(depleted.levelMinutes[0],complete*60+finalMinutes);
    }
    // Slow progression with a full pool remains rested throughout, across
    // many capped/replenished cycles regardless of the utilization factor.
    const full=simulateProgress([{level,xp:1000,xpPerMinute:1/6,killXpPerMinute:1/15}],
      {dailyHours:1,includeRested:true,initialRestedXP:750});
    close(full.levelMinutes[0],1000/(1/6+1/15));
  }
});

test('validation checkpoints stay in broad sanity ranges without retuning other coefficients', () => {
  for(const [level,played,target,min,max] of [[15,10,26,28,30],[26,31,31,42,44],[31,45,37,60,62],
    [37,61,50,100,102],[50,99,60,134,136]]) {
    const result=calculateProjection({level,played,dailyHours:1});
    const total=played+result.points.find(p=>p.y===target).x;
    assert.ok(total>min && total<max,`${level} -> ${target}: ${total}`);
  }
  const full=calculateProjection({level:1,played:0,dailyHours:1});
  assert.ok(full.remainingMinutes/60>130 && full.remainingMinutes/60<133);
});

test('calendar uses the chosen date as session one and rounds fractional sessions up', () => {
  for(const [days,expected] of [[0,'2026-10-09'],[1,'2026-10-09'],[2,'2026-10-10'],
    [30,'2026-11-07'],[30.2,'2026-11-08']]) {
    assert.equal(getLocalDateString(getCalendarDate('2026-10-09',days)),expected);
  }
});

test('calendar handles month/year/leap-day and DST transitions in local time', () => {
  for(const [start,days,expected] of [['2026-01-31',2,'2026-02-01'],['2026-12-31',2,'2027-01-01'],
    ['2028-02-28',2,'2028-02-29'],['2028-02-28',3,'2028-03-01'],['2027-02-28',2,'2027-03-01'],
    ['2026-03-28',3,'2026-03-30'],['2026-10-24',3,'2026-10-26']]) {
    assert.equal(getLocalDateString(getCalendarDate(start,days)),expected);
  }
  assert.equal(getLocalDateString(new Date(2026,9,9,0,15)),'2026-10-09');
  assert.equal(getLocalDateString(new Date(2026,9,9,23,45)),'2026-10-09');
  for(const value of ['', '2026-02-30','2027-02-29','0000-01-01','2026-13-01']) {
    assert.throws(()=>getCalendarDate(value,1),RangeError);
  }
});

test('calendar reads existing graph points without changing the projection', () => {
  const result=calculateProjection({level:37,played:61,dailyHours:1});
  const before=structuredClone(result);
  const first=getMilestoneDates(result.points,'2026-10-09');
  const later=getMilestoneDates(result.points,'2026-12-01');
  assert.deepEqual(first.map(m=>m.level),[40,50,60]);
  first.forEach((m,i)=>assert.notEqual(m.date.getTime(),later[i].date.getTime()));
  assert.equal(first.at(-1).date.getTime(),getCalendarDate('2026-10-09',result.daysRequired).getTime());
  assert.deepEqual(result,before);
  assert.deepEqual(getMilestoneDates(calculateProjection({level:50,dailyHours:1}).points,'2026-10-09').map(m=>m.level),[60]);
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
const forever = { faction:'alliance', version:'forever', includeRested:false, dailyHours:2 };

test('Sleeping Bag starts at 14, food affects kills only, Vanilla ignores buffs',()=>{
  close(getXpBoost(13,{...forever,sleepingBag:true}).total,1);
  close(getXpBoost(14,{...forever,sleepingBag:true}).total,1.03);
  close(getXpBoost(30,{...forever,foodBuff:true}).total,1.02);
  close(getXpBoost(30,{...forever,foodBuff:true,sleepingBag:true}).total,1.05);
  close(getXpBoost(30,{...forever,version:'vanilla',foodBuff:true,sleepingBag:true}).total,1);
});

test('Sleeping Bag setup costs time only from level 14 and stays aligned with dungeon savings',()=>{
  const off = baseline(14, forever);
  const bag = baseline(14, {...forever, sleepingBag:true});
  close(bag.remainingMinutes, off.remainingMinutes * 123 / 120 / 1.03);
  assert.ok(bag.remainingMinutes < off.remainingMinutes);
  assert.ok(bag.remainingMinutes > off.remainingMinutes / 1.03);
  const from13 = baseline(13, {...forever, sleepingBag:true});
  close(from13.remainingMinutes - bag.remainingMinutes, referenceMinutesPerLevel[12]);
  close(baseline(1, {sleepingBag:true}).remainingMinutes, baseline(1).remainingMinutes);
  for (const dungeonMode of ['off','typical','all']) {
    const options = {...forever, sleepingBag:true, dungeonMode};
    const result = baseline(14, options);
    close(result.remainingMinutes, baseline(14, {...options, dailyHours:6}).remainingMinutes);
    close(result.points.at(-1).x * 120, result.remainingMinutes);
    close(result.baseRemainingMinutes-result.dungeonAdjustmentMinutes, result.remainingMinutes);
  }
});

test('35 distinct dungeons, nine new, with valid level ranges and no duplicate package XP',()=>{
  assert.equal(dungeonData.length,35);
  assert.equal(new Set(dungeonData.map(d=>d.id)).size,35);
  assert.equal(dungeonData.filter(d=>d.kind==='new').length,9);
  for(const dungeon of dungeonData) {
    assert.ok(dungeon.typicalLevel>=dungeon.minLevel&&dungeon.typicalLevel<=dungeon.maxLevel);
  }
  for(const [group,total] of [['sm',15000],['dire-maul',78150],['stratholme',109300],['blackrock-spire',107100]]) {
    const members=dungeonData.filter(d=>d.packageId===group);
    close(members.reduce((sum,d)=>sum+d.packageShare,0),1);
    close(members.reduce((sum,d)=>sum+d.questXp.alliance*d.packageShare,0),total);
    close(members.reduce((sum,d)=>sum+getDungeonExtraXP(d,'alliance')*d.packageShare,0),total-total/2.3);
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
    for(const block of all.dungeonBreakdown) close(block.reduction,(block.routeQuestXP+block.routeMobDeltaXP)*0.4/block.blockXP);
  }
});

test('route budgets separate full quest pools from their advantage over Classic',()=>{
  const alliance=baseline(1,{...forever,dungeonMode:'all'}).dungeonBreakdown;
  const horde=baseline(1,{...forever,faction:'horde',dungeonMode:'all'}).dungeonBreakdown;
  close(alliance[0].routeQuestXP,13300+22680+(17550-9000)+(18450-8600));
  close(horde[0].routeQuestXP,5250+34750+(25150-12850)+(14300-6250));
  close(alliance[1].routeQuestXP,39300+(28500-9650)+(24650-11750));
  close(horde[1].routeQuestXP,22800+(31000-13000)+(19800-7400));
  const advantage=x=>x-x/2.3;
  close(alliance[3].routeQuestXP,(61500+advantage(24245+37750+22800))*0.9);
  close(horde[3].routeQuestXP,(37350+advantage(19600+32500+22800))*0.9);
  close(alliance[4].routeQuestXP,(79000+43000+55000+advantage(79150+94250+107100+78150+84500+109300))*0.5);
  close(horde[4].routeQuestXP,(92000+44000+55000+advantage(74350+92400+113700+78150+94450+120850))*0.5);
});

test('November mob rate applies once across every bracket, independently of quest rewards',()=>{
  const {DUNGEON_MOB_XP_MULTIPLIER,getDungeonMobXP,getDungeonMobDelta}=require('./dungeons.js');
  assert.equal(DUNGEON_MOB_XP_MULTIPLIER,0.6);
  const bfd=dungeonData.find(d=>d.id==='blackfathom');
  close(getDungeonMobXP(bfd),8100);
  close(getDungeonMobDelta(bfd),2700);
  close(bfd.questXp.horde,31000);
  close(getDungeonExtraXP(bfd,'horde'),18000);
  close(getDungeonMobXP(dungeonData.find(d=>d.id==='drowned')),11000);
  for(const faction of ['alliance','horde']) {
    const options={...forever,level:1,faction,dungeonMode:'all'};
    const adjusted=getDungeonAdjustments(options,referenceMinutesPerLevel);
    const noMobs=getDungeonAdjustments(options,referenceMinutesPerLevel,dungeonData.map(d=>({...d,mobXpClassicEstimate:0,mobXpForeverEstimate:0})));
    adjusted.breakdown.forEach((block,i)=>{
      close(block.routeQuestXP,noMobs.breakdown[i].routeQuestXP);
      assert.ok(block.routeMobDeltaXP>0);
    });
    for(let level=13;level<60;level++) {
      assert.ok(adjusted.mobShares[level-1]>0);
      assert.ok(adjusted.adjustments[level-1]>noMobs.adjustments[level-1]);
    }
    assert.ok(getDungeonAdjustments({...options,dungeonMode:'off'},referenceMinutesPerLevel).adjustments.every(x=>x===0));
  }
});

test('updated quest packages preserve faction differences and mark inferred Classic values',()=>{
  const find=id=>dungeonData.find(d=>d.id===id);
  close(getDungeonExtraXP(find('thanes'),'alliance'),13300);
  close(getDungeonExtraXP(find('lordaeron'),'horde'),34750);
  close(getDungeonExtraXP(find('excavation'),'alliance'),39300);
  close(getDungeonExtraXP(find('excavation'),'horde'),22800);
  close(getDungeonExtraXP(find('dalaran'),'alliance'),37600);
  close(getDungeonExtraXP(find('deadmines'),'alliance'),9850);
  assert.equal(find('wailing').classicQuestBasis.alliance,'approximate-early-pair');
  assert.equal(find('gnomeregan').classicQuestBasis.alliance,'estimated-from-forever/2.3');
  assert.equal(find('shaper').confidence,'low');
});

test('all imported mob budgets are used once, including combined wings and new dungeons',()=>{
  const source=require('./data/dungeon-estimates.json');
  const {getDungeonMobXP,getDungeonMobDelta}=require('./dungeons.js');
  assert.equal(source.data.length,31);
  assert.equal(new Set(dungeonData.map(d=>d.record)).size,31);
  for(const row of source.data) {
    const members=dungeonData.filter(d=>d.record===row.dungeon);
    close(members.reduce((sum,d)=>sum+getDungeonMobXP(d),0),row.mob_xp_forever_estimate);
    close(members.reduce((sum,d)=>sum+getDungeonMobDelta(d),0),row.mob_xp_forever_estimate/3);
    if(!members.some(d=>d.packageId==='sm')) {
      for(const faction of ['alliance','horde']) close(members.reduce((sum,d)=>sum+d.questXp[faction]*d.packageShare,0),row['quest_xp_'+faction+'_estimate']);
    }
  }
});

test('static browser scripts load in HTML order and use the same data and forecast as Node',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const files=[...html.matchAll(/<script defer src="([^"?]+)(?:\?[^"\s]*)?"/g)].map(m=>m[1]).filter(f=>!f.startsWith('http')&&f!=='ui.js');
  assert.deepEqual(files,['data/dungeon-estimates.js','dungeons.js','script.js']);
  const context=vm.createContext({});
  for(const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context,{filename:file});
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(dungeonPlanningEstimates)',context)),require('./data/dungeon-estimates.json'));
  const options={level:40,...forever,includeRested:true,sleepingBag:true,foodBuff:true,faction:'horde',dungeonMode:'all'};
  close(vm.runInContext(`calculateProjection(${JSON.stringify(options)}).remainingMinutes`,context),calculateProjection(options).remainingMinutes);
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

 test('default dungeon route averages faction budgets without counting exclusive runs twice',()=>{
 const options={level:1,version:'forever',dailyHours:2,dungeonMode:'all',includeRested:false};
 const average=calculateProjection(options);
 const a=calculateProjection({...options,faction:'alliance'});
 const h=calculateProjection({...options,faction:'horde'});
 average.dungeonBreakdown.forEach((block,i)=>{
   for(const key of ['rawQuestXP','routeQuestXP','routeMobDeltaXP','effectiveXP']) close(block[key],(a.dungeonBreakdown[i][key]+h.dungeonBreakdown[i][key])/2);
 });
 close(average.remainingMinutes,(a.remainingMinutes+h.remainingMinutes)/2);
 });
