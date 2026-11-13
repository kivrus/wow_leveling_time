// Estimates supplied by the user, 2026-11-13. Not verified live rewards.
const planning = typeof module !== 'undefined' && module.exports
  ? require('./data/dungeon-estimates.json') : dungeonPlanningEstimates;
const DUNGEON_MOB_XP_MULTIPLIER = planning.dungeon_mob_multiplier_classic;
const DUNGEON_PRE_HOTFIX_MULTIPLIER = 0.40;
const DUNGEON_EFFECTIVE_FACTOR = 0.4; // Net route calibration, NOT the mob XP rate.
const DUNGEON_TYPICAL_FACTOR = 0.65;
const CLASSIC_QUEST_FALLBACK_RATIO = 2.3; // Estimate only, never multiplies Forever rewards.
const dungeonBlocks = [
  {"minLevel":13,"maxLevel":20,"routeCoverage":1},
  {"minLevel":20,"maxLevel":30,"routeCoverage":1},
  {"minLevel":30,"maxLevel":40,"routeCoverage":1},
  {"minLevel":40,"maxLevel":50,"routeCoverage":0.9},
  {"minLevel":50,"maxLevel":60,"routeCoverage":0.5}
];
// Preserve route levels and faction access, even when source catalog ranges differ.
const dungeonLayout = [
  {"id":"thanes","name":"Hall of Thanes","minLevel":13,"maxLevel":18,"typicalLevel":16,"faction":"both","record":"Hall of Thanes","packageId":null,"packageShare":1},
  {"id":"ragefire","name":"Ragefire Chasm","minLevel":13,"maxLevel":18,"typicalLevel":16,"faction":"horde","record":"Ragefire Chasm","packageId":null,"packageShare":1},
  {"id":"lordaeron","name":"Ruins of Lordaeron","minLevel":15,"maxLevel":20,"typicalLevel":18,"faction":"both","record":"Ruins of Lordaeron","packageId":null,"packageShare":1},
  {"id":"wailing","name":"Wailing Caverns","minLevel":17,"maxLevel":24,"typicalLevel":19,"faction":"both","record":"Wailing Caverns","packageId":null,"packageShare":1},
  {"id":"deadmines","name":"Deadmines","minLevel":17,"maxLevel":26,"typicalLevel":19,"faction":"alliance","record":"Deadmines","packageId":null,"packageShare":1},
  {"id":"shadowfang","name":"Shadowfang Keep","minLevel":22,"maxLevel":30,"typicalLevel":25,"faction":"horde","record":"Shadowfang Keep","packageId":null,"packageShare":1},
  {"id":"excavation","name":"Excavation Site: Wetlands","minLevel":24,"maxLevel":29,"typicalLevel":27,"faction":"both","record":"Excavation Site: Wetlands","packageId":null,"packageShare":1},
  {"id":"blackfathom","name":"Blackfathom Deeps","minLevel":24,"maxLevel":32,"typicalLevel":27,"faction":"both","record":"Blackfathom Deeps","packageId":null,"packageShare":1},
  {"id":"stockade","name":"Stockade","minLevel":24,"maxLevel":32,"typicalLevel":27,"faction":"alliance","record":"The Stockade","packageId":null,"packageShare":1},
  {"id":"dalaran","name":"City of Dalaran","minLevel":28,"maxLevel":33,"typicalLevel":31,"faction":"both","record":"City of Dalaran","packageId":null,"packageShare":1},
  {"id":"gnomeregan","name":"Gnomeregan","minLevel":29,"maxLevel":38,"typicalLevel":33,"faction":"both","record":"Gnomeregan","packageId":null,"packageShare":1},
  {"id":"razorfen-kraul","name":"Razorfen Kraul","minLevel":29,"maxLevel":38,"typicalLevel":33,"faction":"both","record":"Razorfen Kraul","packageId":null,"packageShare":1},
  {"id":"sm-graveyard","name":"SM Graveyard","minLevel":30,"maxLevel":38,"typicalLevel":32,"faction":"both","record":"Scarlet Monastery: Graveyard","packageId":"sm","packageShare":0.25},
  {"id":"sm-library","name":"SM Library","minLevel":33,"maxLevel":41,"typicalLevel":35,"faction":"both","record":"Scarlet Monastery: Library","packageId":"sm","packageShare":0.25},
  {"id":"drowned","name":"The Drowned City","minLevel":35,"maxLevel":40,"typicalLevel":38,"faction":"both","record":"The Drowned City","packageId":null,"packageShare":1},
  {"id":"sm-armory","name":"SM Armory","minLevel":36,"maxLevel":44,"typicalLevel":38,"faction":"both","record":"Scarlet Monastery: Armory","packageId":"sm","packageShare":0.25},
  {"id":"razorfen-downs","name":"Razorfen Downs","minLevel":37,"maxLevel":46,"typicalLevel":39,"faction":"both","record":"Razorfen Downs","packageId":null,"packageShare":1},
  {"id":"sm-cathedral","name":"SM Cathedral","minLevel":38,"maxLevel":46,"typicalLevel":39,"faction":"both","record":"Scarlet Monastery: Cathedral","packageId":"sm","packageShare":0.25},
  {"id":"kroldok","name":"Krol'dok Stronghold","minLevel":40,"maxLevel":45,"typicalLevel":43,"faction":"both","record":"Krol’dok Stronghold","packageId":null,"packageShare":1},
  {"id":"uldaman","name":"Uldaman","minLevel":41,"maxLevel":51,"typicalLevel":45,"faction":"both","record":"Uldaman","packageId":null,"packageShare":1},
  {"id":"zulfarrak","name":"Zul'Farrak","minLevel":44,"maxLevel":54,"typicalLevel":47,"faction":"both","record":"Zul’Farrak","packageId":null,"packageShare":1},
  {"id":"maraudon","name":"Maraudon","minLevel":46,"maxLevel":55,"typicalLevel":49,"faction":"both","record":"Maraudon (all sections)","packageId":null,"packageShare":1},
  {"id":"alcaz","name":"Alcaz Prison","minLevel":48,"maxLevel":53,"typicalLevel":50,"faction":"both","record":"Alcaz Prison","packageId":null,"packageShare":1},
  {"id":"sunken","name":"Sunken Temple","minLevel":50,"maxLevel":60,"typicalLevel":53,"faction":"both","record":"Sunken Temple","packageId":null,"packageShare":1},
  {"id":"brd","name":"Blackrock Depths","minLevel":52,"maxLevel":60,"typicalLevel":55,"faction":"both","record":"Blackrock Depths","packageId":null,"packageShare":1},
  {"id":"dm-east","name":"Dire Maul East","minLevel":54,"maxLevel":60,"typicalLevel":56,"faction":"both","record":"Dire Maul (three wings)","packageId":"dire-maul","packageShare":0.3333333333333333},
  {"id":"blackmaw","name":"Blackmaw Hold","minLevel":55,"maxLevel":60,"typicalLevel":57,"faction":"both","record":"Blackmaw Hold","packageId":null,"packageShare":1},
  {"id":"lbrs","name":"Lower Blackrock Spire","minLevel":55,"maxLevel":60,"typicalLevel":57,"faction":"both","record":"Blackrock Spire (LBRS+UBRS)","packageId":"blackrock-spire","packageShare":0.5},
  {"id":"dm-north","name":"Dire Maul North","minLevel":56,"maxLevel":60,"typicalLevel":57,"faction":"both","record":"Dire Maul (three wings)","packageId":"dire-maul","packageShare":0.3333333333333333},
  {"id":"dm-west","name":"Dire Maul West","minLevel":56,"maxLevel":60,"typicalLevel":57,"faction":"both","record":"Dire Maul (three wings)","packageId":"dire-maul","packageShare":0.3333333333333333},
  {"id":"scholomance","name":"Scholomance","minLevel":58,"maxLevel":60,"typicalLevel":59,"faction":"both","record":"Scholomance","packageId":null,"packageShare":1},
  {"id":"shaper","name":"Shaper's Terrace","minLevel":58,"maxLevel":60,"typicalLevel":59,"faction":"both","record":"Shaper’s Terrace","packageId":null,"packageShare":1},
  {"id":"strath-main","name":"Stratholme Main Gate","minLevel":58,"maxLevel":60,"typicalLevel":59,"faction":"both","record":"Stratholme (both sides)","packageId":"stratholme","packageShare":0.5},
  {"id":"strath-service","name":"Stratholme Service Gate","minLevel":58,"maxLevel":60,"typicalLevel":59,"faction":"both","record":"Stratholme (both sides)","packageId":"stratholme","packageShare":0.5},
  {"id":"ubrs","name":"Upper Blackrock Spire","minLevel":59,"maxLevel":60,"typicalLevel":59,"faction":"both","record":"Blackrock Spire (LBRS+UBRS)","packageId":"blackrock-spire","packageShare":0.5}
];
// Retain approximate Classic comparisons only for established early quest sets.
// Gnomeregan/RFK now contain larger sets; their former partial baselines do not match.
const classicPackages = {ragefire:[null,6250],wailing:[9000,12850],deadmines:[8600,null],shadowfang:[null,7400],
  blackfathom:[9650,13000],stockade:[11750,null]};
const sourceByName = new Map(planning.data.map(row=>[row.dungeon,row]));
// Armory/Cathedral have identical faction totals and potentially shared chains.
// Conservatively count that pool once, plus Library and Graveyard; retain source rows.
const smQuestPool = faction => {
  const key='quest_xp_'+faction+'_estimate';
  return sourceByName.get('Scarlet Monastery: Graveyard')[key]
    +sourceByName.get('Scarlet Monastery: Library')[key]
    +Math.max(sourceByName.get('Scarlet Monastery: Armory')[key],sourceByName.get('Scarlet Monastery: Cathedral')[key]);
};
const dungeonData = dungeonLayout.map(layout=>{
  const row=sourceByName.get(layout.record);
  if(!row) throw new Error('Missing dungeon estimate: '+layout.record);
  const questXp={},classicQuestXp={},classicQuestBasis={};
  for(const [index,faction] of ['alliance','horde'].entries()) {
    questXp[faction]=layout.packageId==='sm'?smQuestPool(faction):row['quest_xp_'+faction+'_estimate'];
    const known=classicPackages[layout.id]?.[index];
    classicQuestXp[faction]=row.is_new?0:(known??questXp[faction]/CLASSIC_QUEST_FALLBACK_RATIO);
    classicQuestBasis[faction]=row.is_new?'new-dungeon':known!=null?'approximate-early-pair':'estimated-from-forever/2.3';
  }
  const mobShare=['dire-maul','stratholme','blackrock-spire'].includes(layout.packageId)?layout.packageShare:1;
  return {...layout,kind:row.is_new?'new':'old',questXp,classicQuestXp,classicQuestBasis,
    extraQuestXP:{alliance:null,horde:null},confidence:row.accuracy,
    source:'data/dungeon-estimates.json',sourceNotes:row.notes,sourceLevelRange:row.level_range,
    mobConfidence:'estimated',mobShare,mobXpClassicEstimate:row.mob_xp_classic_estimate,
    mobXpForeverEstimate:row.mob_xp_forever_estimate};
});
function getDungeonMobXP(dungeon,multiplier=DUNGEON_MOB_XP_MULTIPLIER) {
  // New-dungeon estimates are ALREADY at 60%; do not multiply them by 0.60 again.
  const xp=dungeon.kind==='old'?dungeon.mobXpClassicEstimate*multiplier
    :dungeon.mobXpForeverEstimate*multiplier/DUNGEON_MOB_XP_MULTIPLIER;
  return xp*dungeon.mobShare;
}
function getDungeonMobDelta(dungeon) {
  // Increment above the pre-hotfix route; never add the whole clear twice.
  return Math.max(0,getDungeonMobXP(dungeon)-getDungeonMobXP(dungeon,DUNGEON_PRE_HOTFIX_MULTIPLIER));
}
if(typeof module!=='undefined' && module.exports) module.exports={dungeonData,dungeonBlocks,
  DUNGEON_EFFECTIVE_FACTOR,DUNGEON_TYPICAL_FACTOR,DUNGEON_MOB_XP_MULTIPLIER,
  DUNGEON_PRE_HOTFIX_MULTIPLIER,CLASSIC_QUEST_FALLBACK_RATIO,getDungeonMobXP,getDungeonMobDelta};
