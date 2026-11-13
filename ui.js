const english = {
  title:'Leveling Time Calculator 1–60',level:'Current level',played:'/played, hours',dailyHours:'Hours per day',
  bag:'+3% XP from lvl 14; 3 min rest / 2 h',food:'+5% XP from kills',faction:'Faction',alliance:'Alliance',horde:'Horde',
  dungeons:'Dungeons',off:'Off',typical:'Typical',all:'All first runs',calculate:'Calculate',
  dungeonHint:'First runs with quests. Data: Nov 13, 2026.',
  remaining:'Time to level 60',days:'Days of play',xp:'Remaining XP',saved:'Dungeon time saved ≈',
  startDate:'Start date',eta60:'Estimated level 60',milestones:'Estimated milestones',
  byDays:'By days',byPlayed:'By /played',
  chartFallback:'The chart could not load. The calculation still works.',
  note:'Baseline: ~150h. Rested assumes daily inn logout. /played adjusts your pace. Dungeons are estimated, especially after level 30.'
};
const messages = {
  ru:{total:'Общий /played',dayAxis:'Дни игры',levelAxis:'Уровень',game:'Версия игры',language:'Язык',results:'Результаты',date:'Дата',startDate:'Выбери корректную дату начала.',
    chartMode:'Вид графика',remainingPlayed:'Оставшееся /played',playedMilestones:'Прогноз /played ≈',remainingMilestones:'Осталось игрового времени ≈',playedHint:'Укажи текущий /played, чтобы увидеть общее время. Пока показано оставшееся.',milestones:'Ориентиры ≈',
    stale:'Данные изменены — нажми «Рассчитать».',level:'Уровень: целое число от 1 до 59.',played:'/played: от 0 до 1 000 000 часов.',dailyHours:'Часов в день: от 0,1 до 24.',settings:'Проверь настройки.'},
  en:{total:'Total /played',dayAxis:'Days of play',levelAxis:'Level',game:'Game version',language:'Language',results:'Results',date:'Estimated date',startDate:'Choose a valid start date.',
    chartMode:'Chart view',remainingPlayed:'Remaining /played',playedMilestones:'Estimated /played',remainingMilestones:'Remaining playtime ≈',playedHint:'Enter your current /played to see total time. Showing remaining time for now.',milestones:'Estimated milestones',
    stale:'Inputs changed — press Calculate.',level:'Level must be a whole number from 1 to 59.',played:'/played must be between 0 and 1,000,000 hours.',dailyHours:'Daily hours must be between 0.1 and 24.',settings:'Check the settings.'}
};
const byId = id => document.getElementById(id);
const russian = Object.fromEntries([...document.querySelectorAll('[data-i18n]')].map(el=>[el.dataset.i18n,el.textContent]));
let language='ru',version='vanilla',chart=null,chartMode='days',lastForecast=null;
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
  byId('chartModes').setAttribute('aria-label',messages[next].chartMode);
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
  const startDate=byId('startDate').value;
  let result,milestones;
  try { result=calculateProjection(options); milestones=getMilestoneDates(result.points,startDate); }
  catch(error) { byId('formError').textContent=messages[language][error.message]||messages[language].settings; byId('formError').hidden=false; byId('resultStatus').textContent=messages[language].stale; byId('resultStatus').hidden=false; return; }
  byId('formError').hidden=true; byId('resultStatus').hidden=true;
  byId('res-time').textContent=formatDuration(result.remainingMinutes,false,language);
  byId('res-days').textContent=Math.ceil(result.daysRequired).toLocaleString(language);
  byId('res-date').textContent=formatCalendarDate(milestones.at(-1).date);
  byId('res-xp').textContent=result.remainingXP.toLocaleString(language);
  byId('res-total').textContent=result.totalPlayedMinutes===null?'':`${messages[language].total}: ${formatPlayedTime(result.totalPlayedMinutes,language)}`;
  byId('dungeonSaving').hidden=version!=='forever'||options.dungeonMode==='off';
  byId('res-dungeon').textContent=formatDuration(result.dungeonAdjustmentMinutes,false,language);
  lastForecast={result,startDate};
  renderProgress();
}
function formatCalendarDate(date) {
  return new Intl.DateTimeFormat(language==='ru'?'ru-RU':'en-US',{day:'numeric',month:'short',year:'numeric'}).format(date);
}
function renderProgress() {
  if(!lastForecast) return;
  const {result,startDate}=lastForecast;
  const view=getProgressView(result,chartMode);
  const m=messages[language],isPlayed=chartMode==='played';
  const playedLabel=view.hasTotalPlayed?m.total:m.remainingPlayed;
  document.querySelectorAll('[data-chart-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.chartMode===chartMode)));
  byId('playedHint').hidden=!isPlayed||view.hasTotalPlayed;
  byId('playedHint').textContent=m.playedHint;
  byId('milestoneLabel').textContent=isPlayed?(view.hasTotalPlayed?m.playedMilestones:m.remainingMilestones):m.milestones;
  byId('milestoneDates').parentElement.classList.toggle('played-milestones',isPlayed);
  byId('milestoneDates').replaceChildren(...view.points.filter(p=>p.y>view.points[0].y&&[20,30,40,50,60].includes(p.y)).map(point=>{
    const item=document.createElement('li');
    if(isPlayed) {
      const value=document.createElement('span'); value.className='played-value';
      value.textContent=formatPlayedTime(point.playedMinutes,language);
      item.append(`${m.levelAxis} ${point.y}`,value);
    } else {
      const date=getCalendarDate(startDate,point.daysFromStart),time=document.createElement('time');
      time.dateTime=getLocalDateString(date); time.textContent=formatCalendarDate(date);
      item.append(`${m.levelAxis} ${point.y} — `,time);
    }
    return item;
  }));
  drawChart(view.points,startDate,playedLabel);
}
function drawChart(points,startDate,playedLabel) {
  if(typeof Chart==='undefined') { byId('chartFallback').hidden=false; byId('chartWrapper').hidden=true; return; }
  byId('chartFallback').hidden=true; byId('chartWrapper').hidden=false;
  if(chart) chart.destroy();
  const m=messages[language],isPlayed=chartMode==='played';
  const axisLabel=isPlayed?playedLabel:m.dayAxis;
  byId('progressChart').setAttribute('aria-label',`${m.levelAxis} — ${axisLabel}`);
  chart=new Chart(byId('progressChart'),{
    type:'line',data:{datasets:[{data:points,label:m.levelAxis,borderColor:'#e2bf65',backgroundColor:'rgba(226,191,101,.025)',
      borderWidth:2,pointRadius:2,pointHitRadius:12,pointHoverRadius:5,fill:true,tension:0}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},
      plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>`${m.levelAxis} ${items[0].parsed.y}`,
        label:ctx=>`${playedLabel} ≈ ${formatPlayedTime(ctx.raw.playedMinutes,language)}`,
        afterLabel:ctx=>[`${m.dayAxis}: ${ctx.raw.daysFromStart.toLocaleString(language,{maximumFractionDigits:2})}`,`${m.date}: ${formatCalendarDate(getCalendarDate(startDate,ctx.raw.daysFromStart))}`]}}},
      scales:{x:{type:'linear',min:points[0].x,max:Math.ceil(points[points.length-1].x),title:{display:true,text:axisLabel,color:'#c7c3b8',font:{size:14}},ticks:{color:'#bcb8af',maxTicksLimit:isPlayed?7:12,...(isPlayed?{callback:value=>formatPlayedTime(value*60,language)}:{})},grid:{color:'#30302b'}},
        y:{min:points[0].y,max:60,title:{display:true,text:m.levelAxis,color:'#c7c3b8',font:{size:14}},ticks:{color:'#bcb8af',precision:0,maxTicksLimit:13},grid:{color:'#30302b'}}}}
  });
}
byId('calculatorForm').addEventListener('submit',event=>{event.preventDefault();calculate();});
byId('calculatorForm').addEventListener('change',calculate);
byId('calculatorForm').addEventListener('input',()=>{byId('resultStatus').textContent=messages[language].stale;byId('resultStatus').hidden=false;});
document.querySelectorAll('[data-lang]').forEach(el=>el.addEventListener('click',()=>setLanguage(el.dataset.lang)));
document.querySelectorAll('[data-version]').forEach(el=>el.addEventListener('click',()=>setVersion(el.dataset.version)));
document.querySelectorAll('[data-chart-mode]').forEach(el=>el.addEventListener('click',()=>{chartMode=el.dataset.chartMode;renderProgress();}));
byId('startDate').value=getLocalDateString();
setLanguage(language);
