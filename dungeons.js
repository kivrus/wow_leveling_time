// Working route scenario, updated from the user's 2026-11-13 research.
// Quest packages retain their confidence/scope; not all are live measurements.
const DUNGEON_MOB_XP_MULTIPLIER = 0.60;
const DUNGEON_EFFECTIVE_FACTOR = 0.4;
const DUNGEON_TYPICAL_FACTOR = 0.65;
// Retained net route calibration for time, travel and baseline overlap.
// This is NOT the old 40% mob XP rate. Never scale quest XP by 0.60 or 1.50.
const dungeonBlocks = [
  { minLevel: 13, maxLevel: 20, routeCoverage: 1 },
  { minLevel: 20, maxLevel: 30, routeCoverage: 1 },
  { minLevel: 30, maxLevel: 40, routeCoverage: 1 },
  { minLevel: 40, maxLevel: 50, routeCoverage: 0.9 },
  { minLevel: 50, maxLevel: 60, routeCoverage: 0.5 }
];
// Each row is one dungeon. Shared quest packages are divided among wings once.
// Old: extraQuestXP = Forever minus Classic. New: extraQuestXP = new quest package.
// Late route coverage reflects the supplied ~160–230k / ~300–500k block budgets:
// a first visit does not complete every chain in every high-level dungeon.
const dungeonRows = [
  ['thanes','Hall of Thanes',13,18,16,'new',[13300,14350],[2300,2300],'conflicting',null,1],
  ['ragefire','Ragefire Chasm',13,18,16,'old',null,[6500,6500],'reported',null,1],
  ['lordaeron','Ruins of Lordaeron',15,20,18,'new',[22500,22680],[28000,30150],'reported',null,1],
  ['wailing','Wailing Caverns',17,24,19,'old',[8550,8550],[12300,12300],'reported',null,1],
  ['deadmines','Deadmines',17,26,19,'old',[9850,9850],null,'beta',null,1],
  ['shadowfang','Shadowfang Keep',22,30,25,'old',null,[12400,12400],'reported',null,1],
  ['excavation','Excavation Site: Wetlands',24,29,27,'new',[39300,39300],[22800,22800],'beta',null,1],
  ['blackfathom','Blackfathom Deeps',24,32,27,'old',[13200,13200],[18000,18000],'reported',null,1],
  ['stockade','Stockade',24,32,27,'old',[12900,12900],null,'reported',null,1],
  ['dalaran','City of Dalaran',28,33,31,'new',[37600,37600],[37600,37600],'database',null,1],
  ['gnomeregan','Gnomeregan',29,38,33,'old',[10000,11000],[3000,3000],'partial',null,1],
  ['razorfen-kraul','Razorfen Kraul',29,38,33,'old',[7100,7100],[7100,7100],'partial',null,1],
  ['sm-graveyard','SM Graveyard',30,38,32,'old',[11000,11000],[15000,15000],'estimated','sm',0.25],
  ['sm-library','SM Library',33,41,35,'old',[11000,11000],[15000,15000],'estimated','sm',0.25],
  ['drowned','The Drowned City',35,40,38,'new',[40000,60000],[40000,60000],'estimated',null,1],
  ['sm-armory','SM Armory',36,44,38,'old',[11000,11000],[15000,15000],'estimated','sm',0.25],
  ['razorfen-downs','Razorfen Downs',37,46,39,'old',[17000,17000],[26000,26000],'estimated',null,1],
  ['sm-cathedral','SM Cathedral',38,46,39,'old',[11000,11000],[15000,15000],'estimated','sm',0.25],
  ['kroldok',"Krol'dok Stronghold",40,45,43,'new',[50000,75000],[50000,75000],'estimated',null,1],
  ['uldaman','Uldaman',41,51,45,'old',[35000,50000],[35000,50000],'estimated',null,1],
  ['zulfarrak',"Zul'Farrak",44,54,47,'old',[50000,55000],[50000,55000],'estimated',null,1],
  ['maraudon','Maraudon',46,55,49,'old',[55000,60000],[55000,60000],'estimated',null,1],
  ['alcaz','Alcaz Prison',48,53,50,'new',[70000,100000],[70000,100000],'estimated',null,1],
  ['sunken','Sunken Temple',50,60,53,'old',[49000,49000],[59000,59000],'estimated',null,1],
  ['brd','Blackrock Depths',52,60,55,'old',[50000,80000],[50000,80000],'estimated',null,1],
  ['dm-east','Dire Maul East',54,60,56,'old',[50000,90000],[50000,90000],'estimated','dire-maul',1/3],
  ['blackmaw','Blackmaw Hold',55,60,57,'new',[90000,130000],[90000,130000],'estimated',null,1],
  ['lbrs','Lower Blackrock Spire',55,60,57,'old',[40000,70000],[40000,70000],'estimated',null,1],
  ['dm-north','Dire Maul North',56,60,57,'old',[50000,90000],[50000,90000],'estimated','dire-maul',1/3],
  ['dm-west','Dire Maul West',56,60,57,'old',[50000,90000],[50000,90000],'estimated','dire-maul',1/3],
  ['scholomance','Scholomance',58,60,59,'old',[70000,100000],[70000,100000],'estimated',null,1],
  ['shaper',"Shaper's Terrace",58,60,59,'new',[100000,140000],[100000,140000],'estimated',null,1],
  ['strath-main','Stratholme Main Gate',58,60,59,'old',[100000,150000],[100000,150000],'estimated','stratholme',0.5],
  ['strath-service','Stratholme Service Gate',58,60,59,'old',[100000,150000],[100000,150000],'estimated','stratholme',0.5],
  ['ubrs','Upper Blackrock Spire',59,60,59,'old',[30000,50000],[30000,50000],'estimated',null,1]
];
const knownQuestPackages = {
  thanes:[null,2300], ragefire:[null,12750], lordaeron:[null,null],
  wailing:[17550,25150], deadmines:[18450,null], shadowfang:[null,19800],
  excavation:[39300,22800], dalaran:[37600,37600],
  blackfathom:[22850,31000], stockade:[24650,null], gnomeregan:[23300,5800], 'razorfen-kraul':[12250,12250]
};
// Approximate Classic counterparts inferred once from the supplied early package/delta pairs.
const classicPackages={ragefire:[null,6250],wailing:[9000,12850],deadmines:[8600,null],shadowfang:[null,7400],
  blackfathom:[9650,13000],stockade:[11750,null],gnomeregan:[12800,2800],'razorfen-kraul':[5150,5150]};
const dungeonData = dungeonRows.map(([id,name,minLevel,maxLevel,typicalLevel,kind,alliance,horde,confidence,packageId,packageShare]) => ({
  id,name,minLevel,maxLevel,typicalLevel,kind,faction:alliance&&horde?'both':alliance?'alliance':'horde',
  questXp:{alliance:knownQuestPackages[id]?.[0]??null,horde:knownQuestPackages[id]?.[1]??null},
  classicQuestXp:{alliance:classicPackages[id]?.[0]??null,horde:classicPackages[id]?.[1]??null},
  extraQuestXP:{alliance,horde},confidence,packageId,packageShare,
  source:['thanes','lordaeron','deadmines','excavation','dalaran'].includes(id)?'user-research-2026-11-13':'user-scenario-2026-10-06',
  // Not a new quest budget: keep incompatible scopes separate from the route.
  observations:id==='wailing'?{questXpMinimum:{alliance:12400,horde:20000},confidence:'partial',usedInRoute:false}
    :id==='ragefire'?{questXpWithChains:{horde:17500},confidence:'chain-inclusive',usedInRoute:false}:null,
  // Oct beta sample, five players levels 25–29, player level 28.
  // Its 40%-of-Era rate is an assumption from the supplied research.
  // No fabricated counts for unmeasured dungeons; null does not mean zero XP.
  mobSample:id==='blackfathom'?{xp:4929,eraMultiplier:0.40,confidence:'beta-extrapolation',
    runMinutes:45,groupMinutes:13,source:'user-research-2026-11-13'}:null
}));

function getDungeonMobXP(dungeon, multiplier = DUNGEON_MOB_XP_MULTIPLIER) {
  return dungeon.mobSample ? dungeon.mobSample.xp / dungeon.mobSample.eraMultiplier * multiplier : null;
}

function getDungeonMobDelta(dungeon) {
  const current = getDungeonMobXP(dungeon);
  return current === null ? 0 : Math.max(0, current - dungeon.mobSample.xp);
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { dungeonData, dungeonBlocks, DUNGEON_EFFECTIVE_FACTOR, DUNGEON_TYPICAL_FACTOR,
    DUNGEON_MOB_XP_MULTIPLIER, getDungeonMobXP, getDungeonMobDelta };
}
