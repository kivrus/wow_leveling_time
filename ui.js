const english = {
  title:'Leveling Time Calculator 1–60',level:'Current level',played:'/played, hours',dailyHours:'Hours per day',
  bag:'+3% XP, from level 14',food:'+5% XP from kills',faction:'Faction',alliance:'Alliance',horde:'Horde',
  dungeons:'Dungeons',off:'Off',typical:'Typical',all:'All first runs',calculate:'Calculate',
  remaining:'Time to level 60',days:'Days of play',xp:'Remaining XP',saved:'Dungeon time saved ≈',
  chartFallback:'The chart could not load. The calculation still works.',
  note:'Baseline: ~150h. Rested included. /played adjusts your pace. Dungeons are estimated, especially after level 30.'
};
const messages = {
  ru:{total:'Общий /played',dayAxis:'Дни игры',levelAxis:'Уровень',game:'Версия игры',language:'Язык',results:'Результаты',
    stale:'Данные изменены — нажми «Рассчитать».',level:'Уровень: целое число от 1 до 59.',played:'/played: от 0 до 1 000 000 часов.',dailyHours:'Часов в день: от 0,1 до 24.',settings:'Проверь настройки.'},
  en:{total:'Total /played',dayAxis:'Days of play',levelAxis:'Level',game:'Game version',language:'Language',results:'Results',
    stale:'Inputs changed — press Calculate.',level:'Level must be a whole number from 1 to 59.',played:'/played must be between 0 and 1,000,000 hours.',dailyHours:'Daily hours must be between 0.1 and 24.',settings:'Check the settings.'}
};
const byId = id => document.getElementById(id);
const russian = Object.fromEntries([...document.querySelectorAll('[data-i18n]')].map(el=>[el.dataset.i18n,el.textContent]));
let language='ru',version='vanilla',chart=null;
try { const saved=localStorage.getItem('leveling-language'); if(['ru','en'].includes(saved)) language=saved; } catch (_) {}
function setLanguage(next) {
  language=next;
  try { localStorage.setItem('leveling-language',next); } catch (_) {}
  document.documentElement.lang=next;
  const dictionary=next==='ru'?russian:english;
  document.title=dictionary.title;
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=dictionary[el.dataset.i18n];});
  document.querySelectorAll('[data-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.lang===next)));
  byId('languages').setAttribute('aria-label',messages[next].language);
  byId('versions').setAttribute('aria-label',messages[next].game);
  document.querySelector('.results').setAttribute('aria-label',messages[next].results);
  byId('progressChart').setAttribute('aria-label',messages[next].levelAxis);
  calculate();
}
function setVersion(next) {
  version=next;
  const forever=next==='forever';
  document.querySelectorAll('[data-version]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.version===next)));
  byId('foreverOptions').hidden=!forever; byId('foreverOptions').disabled=!forever;
  byId('brand').classList.toggle('vanilla',!forever);
  byId('gameLogo').src=forever?'assets/forever-logo.avif':'assets/vanilla-logo.png';
  byId('gameLogo').alt=forever?'WoW Forever':'World of Warcraft Vanilla';
  calculate();
}
function calculate() {
  const played=byId('played');
  const options={level:byId('level').valueAsNumber,played:played.value===''&&!played.validity.badInput?0:played.valueAsNumber,
    dailyHours:byId('dailyHours').valueAsNumber,version,includeRested:true,sleepingBag:byId('sleepingBag').checked,
    foodBuff:byId('foodBuff').checked,faction:byId('faction').value,dungeonMode:byId('dungeonMode').value};
  let result;
  try { result=calculateProjection(options); }
  catch(error) { byId('formError').textContent=messages[language][error.message]||messages[language].settings; byId('formError').hidden=false; byId('resultStatus').textContent=messages[language].stale; byId('resultStatus').hidden=false; return; }
  byId('formError').hidden=true; byId('resultStatus').hidden=true;
  byId('res-time').textContent=formatDuration(result.remainingMinutes,false,language);
  byId('res-days').textContent=Math.ceil(result.daysRequired).toLocaleString(language);
  byId('res-xp').textContent=result.remainingXP.toLocaleString(language);
  byId('res-total').textContent=result.totalPlayedMinutes===null?'':`${messages[language].total}: ${formatDuration(result.totalPlayedMinutes,true,language)}`;
  byId('dungeonSaving').hidden=version!=='forever'||options.dungeonMode==='off';
  byId('res-dungeon').textContent=formatDuration(result.dungeonAdjustmentMinutes,false,language);
  drawChart(result.points);
}
function drawChart(points) {
  if(typeof Chart==='undefined') { byId('chartFallback').hidden=false; byId('chartWrapper').hidden=true; return; }
  byId('chartFallback').hidden=true; byId('chartWrapper').hidden=false;
  if(chart) chart.destroy();
  const m=messages[language];
  chart=new Chart(byId('progressChart'),{
    type:'line',data:{datasets:[{data:points,label:m.levelAxis,borderColor:'#e2bf65',backgroundColor:'rgba(226,191,101,.025)',
      borderWidth:2,pointRadius:2,pointHitRadius:12,pointHoverRadius:5,fill:true,tension:0}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},
      plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>`${m.dayAxis}: ${items[0].parsed.x.toLocaleString(language,{maximumFractionDigits:2})}`,label:ctx=>`${m.levelAxis} ${ctx.parsed.y}`}}},
      scales:{x:{type:'linear',min:0,max:Math.ceil(points[points.length-1].x),title:{display:true,text:m.dayAxis,color:'#c7c3b8',font:{size:14}},ticks:{color:'#bcb8af',maxTicksLimit:12},grid:{color:'#30302b'}},
        y:{min:points[0].y,max:60,title:{display:true,text:m.levelAxis,color:'#c7c3b8',font:{size:14}},ticks:{color:'#bcb8af',precision:0,maxTicksLimit:13},grid:{color:'#30302b'}}}}
  });
}
byId('calculatorForm').addEventListener('submit',event=>{event.preventDefault();calculate();});
byId('calculatorForm').addEventListener('change',calculate);
byId('calculatorForm').addEventListener('input',()=>{byId('resultStatus').textContent=messages[language].stale;byId('resultStatus').hidden=false;});
document.querySelectorAll('[data-lang]').forEach(el=>el.addEventListener('click',()=>setLanguage(el.dataset.lang)));
document.querySelectorAll('[data-version]').forEach(el=>el.addEventListener('click',()=>setVersion(el.dataset.version)));
setLanguage(language);
