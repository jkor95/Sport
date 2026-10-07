(function (SK) {
  'use strict';
  const {isoDay, addDays, dayIndex, monday, daysBetween, uid, roundKm, clone, sports, zonedInstant} = SK;
  const validStatuses = new Set(['planned','done','skipped','cancelled','held']);
  const finalStatuses = new Set(['done','skipped','cancelled']);
  const notificationDefaults = Object.freeze({enabled:true,appBadge:true,systemNotifications:true,upcoming:true,upcomingHours:4,pending:true,pendingDelayMinutes:30});
  function freshState() {
    return {schemaVersion:1, profile:null, slots:[], workouts:[], adjustments:[], excludedOccurrences:[], hold:false, holdSince:null, lastResume:null, notifications:{...notificationDefaults}};
  }
  function validateProfile(p, slots) {
    if (!p || !String(p.name || '').trim()) throw new Error('Vul je voornaam in.');
    if (!SK.goals[p.goal]) throw new Error('Kies een geldig doel.');
    if (!(+p.baseWeeklyKm >= 1 && +p.baseWeeklyKm <= 150)) throw new Error('Vul je werkelijke gemiddelde hardloopkilometers per week in (1-150).');
    if (!(+p.longestKm >= 1 && +p.longestKm <= +p.baseWeeklyKm)) throw new Error('Je recente langste loop moet tussen 1 km en je weektotaal liggen.');
    if (!(+p.pace >= 3 && +p.pace <= 15)) throw new Error('Vul een rustig tempo in tussen 3:00 en 15:00 min/km.');
    if (p.timezone !== 'Europe/Amsterdam') throw new Error('Deze versie gebruikt Europe/Amsterdam.');
    if (!slots.length || slots.length > 14) throw new Error('Kies 1-14 vaste sportmomenten.');
    const runs = slots.filter(s=>s.sport==='run');
    if (runs.length < 1 || runs.length > 4) throw new Error('Deze versie ondersteunt 1-4 hardloopmomenten per week.');
    const normalizedKind=s=>s.kind==='easy'?'short':s.kind;
    if (runs.filter(s=>normalizedKind(s)==='long').length > 1) throw new Error('Kies maximaal een lange duurloop per week.');
    if (runs.filter(s=>normalizedKind(s)==='interval').length > 1) throw new Error('Kies maximaal een intervaldag per week.');
    if (p.planMode && !['goal','fixed'].includes(p.planMode)) throw new Error('Kies hoe ver vooruit je wilt plannen.');
    if (p.planMode==='goal' && !p.raceDate) throw new Error('Kies een doeldatum of zet vooruit plannen op een vast aantal weken.');
    if (p.planMode==='fixed' && !(Number.isInteger(+p.horizon) && +p.horizon>=4 && +p.horizon<=52)) throw new Error('Kies 4-52 weken vooruit.');
    const seen = new Set();
    for(const s of slots) {
      if (seen.has(s.id)) throw new Error('Een vast sportmoment staat dubbel.'); seen.add(s.id);
      if (!Number.isInteger(+s.day) || +s.day < 0 || +s.day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) || !sports[s.sport]) throw new Error('Controleer dag, begintijd en sport van je vaste momenten.');
      if (s.sport==='run' && !['easy','short','long','interval'].includes(s.kind||'short')) throw new Error('Kies voor iedere hardloopdag kort, lang of interval.');
      for(const t of slots) if(t.id!==s.id && +t.day===+s.day && t.time===s.time) throw new Error('Twee vaste sportmomenten hebben exact dezelfde begintijd.');
    }
    if(p.raceDate && !/^\d{4}-\d{2}-\d{2}$/.test(p.raceDate)) throw new Error('Ongeldige doeldatum.');
  }
  function overlap(a,b) { return SK.clockMinutes(a.time) < SK.clockMinutes(b.time)+Number(b.minutes) && SK.clockMinutes(b.time)<SK.clockMinutes(a.time)+Number(a.minutes); }
  function validateState(s) {
    if(!s || s.schemaVersion!==1 || !Array.isArray(s.workouts) || !Array.isArray(s.slots) || !Array.isArray(s.adjustments)) throw new Error('Onbekend gegevensformaat.');
    if(s.profile) validateProfile(s.profile,s.slots);
    if(s.workouts.length>3000) throw new Error('Maximaal 3000 trainingen per account in deze versie. Exporteer eerst je historie.');
    const ids = new Set();
    for(const w of s.workouts) {
      if(ids.has(w.id) || !/^[A-Za-z0-9_-]{1,80}$/.test(w.id||'')) throw new Error('Dubbele training in gegevens.'); ids.add(w.id);
      if(!validStatuses.has(w.status) || !sports[w.sport] || !/^\d{4}-\d{2}-\d{2}$/.test(w.date)) throw new Error('Ongeldige training.');
      if(!Number.isFinite(w.km) || w.km<0 || w.km>300 || !Number.isFinite(w.minutes) || w.minutes<0 || w.minutes>1440) throw new Error('Ongeldige afstand of tijdsduur.');
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(w.time)) throw new Error('Ongeldige begintijd.');
      if(w.actual && (!Number.isFinite(w.actual.km)||w.actual.km<0||!Number.isFinite(w.actual.minutes)||w.actual.minutes<0||!Number.isInteger(w.actual.rpe)||w.actual.rpe<1||w.actual.rpe>10)) throw new Error('Ongeldige registratie.');
    }
    return true;
  }
  function touch(w, at) { w.sequence=(w.sequence||0)+1; w.updatedAt=at; }
  function changeLog(state, title, detail, changes, now) {
    state.adjustments.unshift({id:uid(),at:now.toISOString(),title,detail,changes});
    state.adjustments=state.adjustments.slice(0,200);
  }
  function eventSnap(w) { return {km:w.km,minutes:w.minutes,status:w.status,date:w.date,time:w.time}; }
  function resetCoachHistory(state) {
    if(!state || !Array.isArray(state.adjustments)) throw new Error('Onbekend gegevensformaat.');
    state.adjustments=[];
    return state;
  }
  function makeWorkout(x, now = new Date()) {
    const km=Number(x.km||0), minutes=Number(x.minutes||30);
    return {id:uid(),date:x.date,time:x.time||'18:30',sport:x.sport||'run',kind:x.kind||'easy',title:x.title||sports[x.sport||'run'],km,minutes,baseKm:km,baseMinutes:minutes,status:'planned',source:'manual',slotId:null,locked:false,actual:null,sequence:0,updatedAt:now.toISOString(),createdAt:now.toISOString(),...x};
  }

  function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
  function raceDistance(goal){return {fit:0,'5k':5,'10k':10,half:21.1,marathon:42.2}[goal]||0;}
  function normalizeKind(kind){return kind==='easy'?'short':(kind||'short');}
  function goalWeeks(p,start=isoDay()) {
    if(!p.raceDate || p.raceDate<start) return null;
    return Math.max(1,Math.ceil(daysBetween(start,p.raceDate)/7));
  }
  function planMode(p){return p.planMode|| (p.raceDate?'goal':'fixed');}
  function planWindow(p,start=isoDay()){
    const mode=planMode(p), toGoal=mode==='goal'?goalWeeks(p,start):null;
    if(mode==='goal'&&toGoal!==null) return {mode,weeks:Math.min(52,Math.max(1,toGoal)),toGoal};
    return {mode:'fixed',weeks:clamp(Number(p.horizon)||12,4,52),toGoal:null};
  }
  function taperWeeks(goal,total) {
    if(total<=2) return 0;
    if(goal==='marathon') return total>=8?3:(total>=6?2:1);
    if(goal==='half') return total>=8?2:1;
    if(goal==='10k'||goal==='5k') return 1;
    return 0;
  }
  const OFFLINE_MODEL_CACHE={};
  function buildOfflineModel(goal,weeks){
    const total=clamp(Math.round(Number(weeks)||12),4,52), key=goal+':'+total;
    if(OFFLINE_MODEL_CACHE[key]) return OFFLINE_MODEL_CACHE[key];
    const taper=taperWeeks(goal,total), peak=Math.max(0,total-taper-1), out=[];
    for(let i=0;i<total;i++){
      const progress=peak<=0?1:clamp(i/peak,0,1);
      const eased=progress<.5?2*progress*progress:1-Math.pow(-2*progress+2,2)/2;
      let phase=progress<.28?'basis':progress<.82?'opbouw':'piek';
      let load=1,longLoad=1;
      const recovery=i>0 && (i+1)%4===0 && i<peak-1;
      if(recovery){phase='herstel';load=.84;longLoad=.80;}
      if(i>peak){
        phase='taper';
        const n=i-peak;
        if(taper>=2&&n===1){load=.76;longLoad=.62;}else{load=.58;longLoad=.38;}
      }
      out.push({index:i,progress:eased,phase,load,longLoad,recovery,qualityIndex:i%4});
    }
    OFFLINE_MODEL_CACHE[key]=out;return out;
  }
  // Preload every requested 4-52 week model so the planner is fully local and deterministic.
  const OFFLINE_MODELS={};
  for(const goal of ['fit','5k','10k','half','marathon']){
    OFFLINE_MODELS[goal]={};
    for(let weeks=4;weeks<=52;weeks++) OFFLINE_MODELS[goal][weeks]=buildOfflineModel(goal,weeks);
  }
  function peakWeeklyTarget(p){
    const base=Number(p.baseWeeklyKm);
    return Math.min(90,{
      fit:Math.max(base*1.12,base+2),
      '5k':Math.max(base*1.28,20),
      '10k':Math.max(base*1.45,28),
      half:Math.max(base*1.68,38),
      marathon:Math.max(base*1.95,50)
    }[p.goal]||base);
  }
  function peakLongTarget(p){
    const longest=Number(p.longestKm);
    return Math.min(32,{
      fit:Math.max(longest,Math.min(12,longest*1.25)),
      '5k':Math.max(longest,6),
      '10k':Math.max(longest,11),
      half:Math.max(longest,18),
      marathon:Math.max(longest,32)
    }[p.goal]||longest);
  }
  function maxLongBuildStep(goal){
    return {fit:1,'5k':1,'10k':1.5,half:2,marathon:3}[goal]||1;
  }
  function longRunTargetForModel(p,total,modelIndex){
    const longest=Number(p.longestKm), modelSet=OFFLINE_MODELS[p.goal]?.[total]||buildOfflineModel(p.goal,total);
    const taperStart=modelSet.findIndex(x=>x.phase==='taper'), peakIndex=taperStart<0?total-1:Math.max(0,taperStart-1);
    const buildWeeks=modelSet.slice(0,peakIndex+1).filter(x=>!x.recovery);
    const buildSteps=Math.max(0,buildWeeks.length-1);
    const desiredPeak=peakLongTarget(p), achievablePeak=Math.min(desiredPeak,longest+buildSteps*maxLongBuildStep(p.goal),32);
    if(modelIndex>peakIndex){
      const n=modelIndex-peakIndex, taperFactors=p.goal==='marathon'?[.62,.40,.22]:p.goal==='half'?[.55,.30]:[.45];
      const factor=taperFactors[Math.min(n-1,taperFactors.length-1)]||.30;
      return {km:Math.max(3,achievablePeak*factor),peakKm:achievablePeak,peakIndex};
    }
    const before=buildWeeks.filter(x=>x.index<=modelIndex).length;
    const progress=buildSteps<=0?1:clamp((before-1)/buildSteps,0,1);
    let km=longest+(achievablePeak-longest)*progress;
    const current=modelSet[modelIndex];
    if(current?.recovery){
      const prevBuild=buildWeeks.filter(x=>x.index<modelIndex).at(-1);
      if(prevBuild){
        const prevBefore=buildWeeks.filter(x=>x.index<=prevBuild.index).length;
        const prevProgress=buildSteps<=0?1:clamp((prevBefore-1)/buildSteps,0,1);
        const prevKm=longest+(achievablePeak-longest)*prevProgress;
        km=Math.max(Math.min(longest,prevKm),prevKm*.78);
      }
    }
    return {km:Math.min(32,km),peakKm:achievablePeak,peakIndex};
  }
  function targetForWeek(p, wi, firstWeek, planWeeks=null) {
    const weekStart=addDays(firstWeek,wi*7), base=Number(p.baseWeeklyKm), longest=Number(p.longestKm);
    const mode=planMode(p), toGoal=p.raceDate?Math.ceil(daysBetween(weekStart,p.raceDate)/7):null;
    const requested=Math.max(1,Number(planWeeks)||Number(p.horizon)||12);
    let total=clamp(requested,4,52), modelIndex=clamp(wi,0,total-1), preGoalBase=false;
    if(mode==='goal'&&p.raceDate){
      const initialFromWeek=Math.max(1,Math.ceil(daysBetween(firstWeek,p.raceDate)/7));
      if(initialFromWeek>52){
        if(toGoal>52){preGoalBase=true;total=52;modelIndex=0;}
        else {total=52;modelIndex=clamp(52-Math.max(1,toGoal),0,51);}
      } else {
        total=clamp(requested,4,52);
        const skipped=Math.max(0,4-requested);
        modelIndex=clamp(wi+skipped,0,total-1);
      }
    }
    if(preGoalBase){
      const gentle=clamp(1+wi*.004,1,1.12);
      return {weekStart,weeklyKm:roundKm(base*gentle),longKm:roundKm(Math.min(32,longest*gentle)),phase:'basis',left:toGoal,totalWeeks:total,modelIndex,modelWeeks:total,peakLongKm:peakLongTarget(p)};
    }
    const model=OFFLINE_MODELS[p.goal]?.[total]?.[modelIndex]||buildOfflineModel(p.goal,total)[modelIndex];
    const peakWeekly=peakWeeklyTarget(p), longTarget=longRunTargetForModel(p,total,modelIndex);
    const buildStep=Math.max(0,modelIndex-Math.floor(modelIndex/4));
    const feasibleWeekly=Math.min(90,base*Math.pow(1.08,buildStep));
    let weekly=Math.min(base+(peakWeekly-base)*model.progress,feasibleWeekly,90);
    let longKm=longTarget.km;
    weekly*=model.load;
    if(model.phase==='taper') weekly=Math.max(base*.55,weekly);
    const requiredWeekly=longKm/0.62;
    weekly=Math.max(weekly,Math.min(peakWeekly,requiredWeekly));
    longKm=Math.min(32,longKm,Math.max(3,weekly*.64));
    return {weekStart,weeklyKm:roundKm(Math.max(1,weekly)),longKm:roundKm(Math.max(1,longKm)),phase:model.phase,left:toGoal,totalWeeks:total,modelIndex,modelWeeks:total,peakLongKm:roundKm(longTarget.peakKm),peakIndex:longTarget.peakIndex};
  }
  function paceText(pace){
    const sec=Math.max(180,Math.round(Number(pace)*60)),m=Math.floor(sec/60),s=String(sec%60).padStart(2,'0');return `${m}:${s}`;
  }
  function intervalPrescription(p,target,wi,sessionKm=8){
    const phase=target.phase, km=Math.max(3,Number(sessionKm)||8), easySec=Math.round(Number(p.pace)*60);
    if(phase==='herstel'||km<5.5) return {summary:'6 x 1 min vlot',detail:'12-15 min rustig inlopen, 6 x 1 min vlot met 2 min rustig dribbelen, daarna rustig uitlopen tot je geplande afstand.',effort:'RPE 6/10 - soepel, niet sprinten'};
    if(phase==='taper') return {summary:'4 x 400 m ontspannen vlot',detail:'12-15 min rustig inlopen, 4 x 400 m vlot met 400 m zeer rustig herstel, daarna rustig uitlopen.',effort:'RPE 6-7/10 - fris eindigen'};
    const banks={
      fit:[{s:'6 x 1 min',d:'6 x 1 min vlot / 2 min rustig',need:4},{s:'5 x 2 min',d:'5 x 2 min vlot / 2 min rustig',need:5.5},{s:'6 x 2 min',d:'6 x 2 min vlot / 90 sec rustig',need:6.5},{s:'8 x 1 min',d:'8 x 1 min vlot / 90 sec rustig',need:5.5}],
      '5k':[{s:'6 x 400 m',d:'6 x 400 m / 200 m rustig',need:6},{s:'6 x 600 m',d:'6 x 600 m / 300 m rustig',need:7.5},{s:'5 x 800 m',d:'5 x 800 m / 400 m rustig',need:8.5},{s:'4 x 1 km',d:'4 x 1 km / 400 m rustig',need:9}],
      '10k':[{s:'6 x 400 m',d:'6 x 400 m / 200 m rustig',need:6},{s:'5 x 800 m',d:'5 x 800 m / 400 m rustig',need:8.5},{s:'4 x 1 km',d:'4 x 1 km / 400 m rustig',need:9},{s:'3 x 1,6 km',d:'3 x 1,6 km / 600 m rustig',need:10.5}],
      half:[{s:'6 x 400 m',d:'6 x 400 m / 200 m rustig',need:6},{s:'4 x 1 km',d:'4 x 1 km / 400 m rustig',need:9},{s:'3 x 1,6 km',d:'3 x 1,6 km / 600 m rustig',need:10.5},{s:'3 x 2 km',d:'3 x 2 km / 800 m rustig',need:12}],
      marathon:[{s:'6 x 400 m',d:'6 x 400 m / 200 m rustig',need:6},{s:'5 x 800 m',d:'5 x 800 m / 400 m rustig',need:8.5},{s:'4 x 1 km',d:'4 x 1 km / 400 m rustig',need:9},{s:'3 x 2 km',d:'3 x 2 km / 800 m rustig',need:12}]
    };
    const bank=banks[p.goal]||banks.fit, preferred=target.modelIndex%bank.length;
    let choice=bank[preferred];
    if(choice.need>km){const fitting=bank.filter(x=>x.need<=km);choice=fitting.length?fitting.at(-1):bank[0];}
    const faster=p.goal==='fit'?25:p.goal==='marathon'?40:p.goal==='half'?45:55, lo=Math.max(180,easySec-faster-15),hi=Math.max(lo+5,easySec-faster+5);
    return {summary:choice.s,detail:`12-15 min rustig inlopen, ${choice.d}, daarna rustig uitlopen tot ongeveer ${roundKm(km)} km totaal. Richttempo snelle stukken ongeveer ${paceText(lo/60)}-${paceText(hi/60)}/km als dat gecontroleerd voelt.`,effort:phase==='piek'?'RPE 7-8/10 - stevig maar controleerbaar':'RPE 7/10 - controle houden'};
  }
  function runAllocations(p,runs,target,wi){
    const out=new Map(), normalized=runs.map(s=>({...s,kind:normalizeKind(s.kind)}));
    const long=normalized.find(s=>s.kind==='long'), interval=normalized.find(s=>s.kind==='interval'), shorts=normalized.filter(s=>s.kind==='short');
    const cap=s=>Math.max(0,(Number(s.minutes)-10)/Number(p.pace));
    let remaining=target.weeklyKm;
    const intervalReserve=interval?Math.min(remaining,cap(interval),Math.max(3,Math.min(target.weeklyKm*.24,10))):0;
    const shortReserve=shorts.length?Math.min(remaining*.18,shorts.length*3):0;
    if(long){
      const maxForLong=Math.max(0,remaining-intervalReserve-shortReserve), km=roundKm(Math.min(32,target.longKm,Math.max(maxForLong,target.weeklyKm*.35)));
      out.set(long.id,{km,kind:'long',dynamicDuration:true});remaining=Math.max(0,remaining-km);
    }
    if(interval){const km=roundKm(Math.min(intervalReserve,remaining,cap(interval)));out.set(interval.id,{km,kind:'interval',interval:intervalPrescription(p,target,wi,km)});remaining=Math.max(0,remaining-km);}
    const other=shorts.length?shorts:normalized.filter(s=>!out.has(s.id));
    if(other.length){for(let i=0;i<other.length;i++){const s=other[i],left=other.length-i,desired=remaining/left,km=roundKm(Math.min(desired,cap(s),32));out.set(s.id,{km,kind:normalizeKind(s.kind)});remaining=Math.max(0,remaining-km);}}
    if(normalized.length===1){
      const s=normalized[0],kind=normalizeKind(s.kind),km=roundKm(kind==='long'?Math.min(32,target.longKm):Math.min(target.weeklyKm,cap(s)));
      out.set(s.id,{km,kind,dynamicDuration:kind==='long',interval:kind==='interval'?intervalPrescription(p,target,wi,km):null});
    }
    return out;
  }
  function generatePlan(state, {start=isoDay(),weeks=12,now=new Date()} = {}) {
    const p=state.profile; validateProfile(p,state.slots);
    const window=planWindow(p,start), goalAware=window.mode==='goal'&&!!p.raceDate;
    weeks=goalAware?window.weeks:clamp(Number(weeks)||Number(p.horizon)||12,4,52);
    if(!Number.isInteger(weeks)||weeks<1||weeks>52) throw new Error('Kies 4-52 weken of gebruik je doeldatum.');
    const exactGoal=goalAware?goalWeeks(p,start):null;
    const end=goalAware&&exactGoal!==null&&exactGoal<=52?p.raceDate:addDays(monday(start),weeks*7-1), at=now.toISOString();
    const runs=state.slots.filter(s=>s.sport==='run');
    const currentGoalKey=(goalAware&&p.raceDate&&p.goal!=='fit')?p.goal+':'+p.raceDate:'';
    const activeKeys=new Set(), changes=[]; const firstWeek=monday(start);
    const excluded=new Set(state.excludedOccurrences||[]); let blocked=0;
    // Free dates that belonged to an older goal before rebuilding the normal plan.
    // This must happen before conflict detection, otherwise an old locked goal event
    // can keep the date blocked even after the user moved the goal date.
    const staleGoalDates=new Set();
    for(const w of state.workouts) {
      if(w.source!=='goal'||w.status==='done'||w.status==='skipped'||w.date<start) continue;
      if(!currentGoalKey||w.goalKey!==currentGoalKey) {
        staleGoalDates.add(w.date);
        if(w.status!=='cancelled') {
          const before=eventSnap(w);w.status='cancelled';touch(w,at);changes.push({id:w.id,title:w.title,before,after:eventSnap(w)});
        }
      }
    }
    const oldMap=new Map(state.workouts.filter(w=>w.source==='plan').map(w=>[w.slotId+':'+w.date,w]));
    const allocationCache=new Map();
    for(let day=start;day<=end;day=addDays(day,1)) {
      const wi=Math.max(0,Math.floor(daysBetween(firstWeek,day)/7));
      const target=targetForWeek(p,wi,firstWeek,weeks);
      if(!allocationCache.has(wi)) allocationCache.set(wi,runAllocations(p,runs,target,wi));
      const allocations=allocationCache.get(wi), todays=state.slots.filter(s=>Number(s.day)===dayIndex(day));
      for(const slot of todays) {
        const key=slot.id+':'+day; activeKeys.add(key); if(excluded.has(key)) continue; const existing=oldMap.get(key);
        // A plan workout can be cancelled automatically because the goal/race day
        // temporarily occupies that date. Once the goal moves, restore that normal
        // training instead of treating the date as permanently deleted.
        if(existing && existing.status==='cancelled' && !excluded.has(key) && (existing.cancelReason==='goal-day' || staleGoalDates.has(day))) {
          existing.status=state.hold?'held':'planned';
          delete existing.cancelReason; delete existing.suppressedGoalKey;
          touch(existing,at);
        }
        if(existing && (finalStatuses.has(existing.status)||existing.locked)) continue;
        if(!existing && zonedInstant(day,slot.time,p.timezone)<now) continue;
        if(goalAware&&p.raceDate===day && slot.sport==='run' && p.goal!=='fit'){
          if(existing&&!finalStatuses.has(existing.status)&&!existing.locked){existing.status='cancelled';existing.cancelReason='goal-day';existing.suppressedGoalKey=currentGoalKey;touch(existing,at);}
          continue;
        }
        let km=0,minutes=Math.max(15,Number(slot.minutes)||60),kind=normalizeKind(slot.kind),interval=null;
        if(slot.sport==='run') {
          const a=allocations.get(slot.id)||{km:0,kind}; km=a.km;kind=a.kind;interval=a.interval||null;
          minutes=Math.max(15,Math.ceil(km*p.pace+10));
        }
        const title=slot.sport==='run'?(kind==='long'?`Lange duurloop - ${target.phase}`:kind==='interval'?`Interval - ${interval?.summary||'kwaliteit'}`:`Korte rustige loop - ${target.phase}`):sports[slot.sport];
        const conflict=state.workouts.find(w=>w.id!==existing?.id && w.date===day && ['planned','done','held'].includes(w.status) && (w.source!=='plan'||w.locked||w.status==='done') && overlap(w,{time:slot.time,minutes}));
        if(conflict){blocked++;activeKeys.delete(key);continue;}
        if(existing) {
          const before=eventSnap(existing);
          Object.assign(existing,{time:slot.time,sport:slot.sport,kind,title,baseKm:km,baseMinutes:minutes,km,minutes,planPhase:target.phase,interval,adaptation:''});
          if(JSON.stringify(before)!==JSON.stringify(eventSnap(existing))) {touch(existing,at);changes.push({id:existing.id,title,before,after:eventSnap(existing)});}
        } else {
          const w=makeWorkout({date:day,time:slot.time,sport:slot.sport,kind,title,km,minutes,source:'plan',slotId:slot.id,planPhase:target.phase,interval},now); state.workouts.push(w);
        }
      }
    }
    for(const w of state.workouts) if(w.source==='plan'&&w.date>=start&&w.date<=end&&!activeKeys.has(w.slotId+':'+w.date)&&!finalStatuses.has(w.status)&&!w.locked) {
      const before=eventSnap(w);w.status='cancelled';touch(w,at);changes.push({id:w.id,title:w.title,before,after:eventSnap(w)});
    }
    const distance=raceDistance(p.goal);
    if(goalAware&&p.raceDate&&distance&&p.raceDate>=start&&p.raceDate<=end){
      let race=state.workouts.find(w=>w.source==='goal'&&w.goalKey===p.goal+':'+p.raceDate);
      const raceMinutes=Math.max(30,Math.ceil(distance*p.pace));
      if(!race) {
        race=makeWorkout({date:p.raceDate,time:'09:00',sport:'run',kind:'race',title:`Doeldag - ${SK.goals[p.goal]}`,km:distance,minutes:raceMinutes,baseKm:distance,baseMinutes:raceMinutes,source:'goal',slotId:null,locked:true,goalKey:p.goal+':'+p.raceDate},now);
        state.workouts.push(race);
      } else if(race.status==='cancelled') {
        const before=eventSnap(race);Object.assign(race,{km:distance,baseKm:distance,minutes:raceMinutes,baseMinutes:raceMinutes,title:`Doeldag - ${SK.goals[p.goal]}`,locked:true,status:state.hold?'held':'planned'});touch(race,at);changes.push({id:race.id,title:race.title,before,after:eventSnap(race)});
      } else if(!finalStatuses.has(race.status)) Object.assign(race,{km:distance,baseKm:distance,minutes:raceMinutes,baseMinutes:raceMinutes,title:`Doeldag - ${SK.goals[p.goal]}`,locked:true,status:state.hold?'held':'planned'});
    }
    state.planStart=start;state.planEnd=end;
    adaptPlan(state,{now,writeAudit:false});
    const descriptor=goalAware?(exactGoal>52?`Je doel ligt ${exactGoal} weken weg; de app plant de komende 52 weken en start automatisch het 52-weken-doelmodel zodra je binnen dat venster komt.`:`${exactGoal} weken tot je doeldatum via het lokale ${Math.max(4,exactGoal)}-wekenmodel.`):`${weeks} weken vooruit via het lokale model.`;
    changeLog(state,'Schema opgebouwd',`${descriptor} Korte, lange en intervaldagen volgen je gekozen weekindeling. Iedere vierde opbouwweek kan lichter zijn; richting een doel volgen piek en taper. Marathontrainingslopen blijven maximaal 32 km. ${blocked?blocked+' moment(en) niet ingepland wegens overlap. ':''}Alle berekeningen gebeuren lokaal in MijnLoop.`,changes,now);
    state.workouts.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    return state;
  }
  function adaptPlan(state, {now=new Date(),writeAudit=true,trigger=null}={}) {
    const today=isoDay(now,state.profile?.timezone), until=addDays(today,14), changes=[];
    const recent=state.workouts.filter(w=>(w.status==='done'||w.status==='skipped')&&w.actual&&w.date>=addDays(today,-21)&&w.date<=today&&(!state.lastResume||w.actual.loggedAt>state.lastResume)).sort((a,b)=>b.date.localeCompare(a.date)||b.actual.loggedAt.localeCompare(a.actual.loggedAt));
    const runs=recent.filter(w=>w.sport==='run');
    const ratio=w=>w.actual.plannedKm>0?w.actual.km/w.actual.plannedKm:1;
    const shortRuns=runs.filter(w=>w.actual.plannedKm>0 && ratio(w)<.80);
    const strongRuns=runs.filter(w=>w.actual.plannedKm>0 && ratio(w)>=1.02 && w.actual.rpe<=6 && w.actual.reason==='normal');
    const fatigued=recent.some(w=>w.actual.reason==='fatigue'||w.actual.rpe>=8);
    const repeated=shortRuns.filter(w=>!['time','weather'].includes(w.actual.reason)).length>=2;
    const positiveStreak=strongRuns.filter(w=>w.date>=addDays(today,-10)).length>=2;
    const missedPast=state.workouts.filter(w=>w.status==='planned'&&w.sport==='run'&&w.date<today&&w.date>=addDays(today,-14));
    const unlogged=missedPast.length>=2;
    for(const w of state.workouts) {
      if(finalStatuses.has(w.status)||w.date<today) continue;
      if(zonedInstant(w.date,w.time,state.profile.timezone)<now) continue;
      const before=eventSnap(w);
      if(state.hold) {
        w.status='held';w.adaptation='Planning gepauzeerd. Hervat alleen bewust via Coach.';
      } else if(w.locked) {
        if(w.status==='held') w.status='planned';
        w.adaptation=(fatigued||repeated)?'Vastgezet: niet aangepast. Controleer zelf of deze training nog passend is.':'';
      } else {
        if(w.status==='held') w.status='planned';
        w.km=w.baseKm;w.minutes=w.baseMinutes;w.adaptation='';
        if(w.sport==='run') {
          let factor=1; const reasons=[];
          if((fatigued||repeated)&&w.date<=until) {factor=.82;reasons.push(fatigued?'Lichtere periode na hoge inspanning of vermoeidheid.':'Meerdere moeilijke of sterk ingekorte trainingen: opbouw tijdelijk lager.');}
          if(unlogged) {factor=Math.min(factor,.90);reasons.push('Meerdere eerdere trainingen zijn niet geregistreerd; geen extra opbouw.');}
          if(positiveStreak&&!fatigued&&!repeated&&w.date<=addDays(today,10)&&normalizeKind(w.kind)!=='interval') {factor=Math.max(factor,1.03);reasons.push('Twee recente trainingen gingen comfortabel goed: kleine positieve bijstelling van maximaal 3%.');}
          let km=w.baseKm*factor;
          for(const r of shortRuns) {
            const left=daysBetween(r.date,w.date), sameSlot=r.slotId&&w.slotId===r.slotId, comparable=sameSlot||normalizeKind(r.kind)===normalizeKind(w.kind);
            if(comparable&&left>0&&left<=14&&r.actual.km>0) {
              const forgiving=['time','weather'].includes(r.actual.reason)?1.20:1.08;
              km=Math.min(km,r.actual.km*forgiving);
              reasons.push(`Vorige vergelijkbare loop: ${r.actual.km} van ${r.actual.plannedKm} km. Geen inhaalkilometers.`);
            }
          }
          const strongest=strongRuns.find(r=>{const left=daysBetween(r.date,w.date);return left>0&&left<=10&&(r.slotId&&w.slotId===r.slotId||normalizeKind(r.kind)===normalizeKind(w.kind));});
          if(strongest&&!fatigued&&!repeated&&factor>=1){
            const modest=Math.min(w.baseKm*1.03,strongest.actual.km*1.02);
            km=Math.max(km,modest);reasons.push('Een vergelijkbare recente loop ging rustig beter dan gepland; daarom slechts een kleine stap omhoog.');
          }
          const cap=normalizeKind(w.kind)==='long'?32:w.baseKm*1.03;
          w.km=roundKm(Math.max(0,Math.min(km,cap)));
          if(w.km!==w.baseKm) w.minutes=Math.min(w.baseMinutes,Math.max(15,Math.ceil(w.km*state.profile.pace+10)));
          w.adaptation=[...new Set(reasons)].join(' ');
        } else if(fatigued&&w.date<=addDays(today,7)) w.adaptation='Er is hoge inspanning gemeld. Beoordeel deze andere sport zelf; hardloopkilometers zijn niet uitwisselbaar met deze sport.';
      }
      if(JSON.stringify(before)!==JSON.stringify(eventSnap(w))) {touch(w,now.toISOString());changes.push({id:w.id,title:w.title,before,after:eventSnap(w)});}
    }
    if(writeAudit) {
      let detail=state.hold?'Alle toekomstige trainingen zijn gepauzeerd. Pijn of ziekte wordt niet met extra trainingen gecompenseerd.':changes.length?`${changes.length} training(en) lokaal aangepast. Een goede dag geeft hooguit een kleine stap omhoog; vermoeidheid of herhaald inkorten verlaagt tijdelijk de belasting. Gemiste kilometers worden nooit ingehaald.`:'Geen afstand aangepast. Je voorgerekende model blijft leidend.';
      if(trigger) detail=`${trigger} ${detail}`;
      changeLog(state,state.hold?'Herstel eerst':'Schema lokaal opnieuw beoordeeld',detail,changes,now);
    }
    return changes;
  }
  function logWorkout(state,id,actual,{now=new Date()}={}) {
    const w=state.workouts.find(x=>x.id===id);if(!w) throw new Error('Training niet gevonden.');
    if(w.date>isoDay(now,state.profile.timezone)) throw new Error('Een toekomstige training kun je nog niet afronden.');
    if(w.status==='cancelled') throw new Error('Deze training is verwijderd.');
    const km=Number(actual.km),minutes=Number(actual.minutes),rpe=Number(actual.rpe);
    if(!Number.isFinite(km)||km<0||km>300||!Number.isFinite(minutes)||minutes<0||minutes>1440||!Number.isInteger(rpe)||rpe<1||rpe>10) throw new Error('Controleer afstand, minuten en inspanning (1-10).');
    if(km>0&&minutes<=0) throw new Error('Vul de werkelijke tijdsduur in.');
    if(!['normal','time','fatigue','weather','pain','illness','other','missed'].includes(actual.reason)) throw new Error('Kies een reden.');
    const old=w.actual;
    w.actual={km,minutes,rpe,reason:actual.reason,notes:String(actual.notes||'').slice(0,1000),plannedKm:old?.plannedKm??w.km,plannedMinutes:old?.plannedMinutes??w.minutes,loggedAt:now.toISOString(),...(w.external?{needsReview:false}:{})};
    w.status=km===0&&minutes===0?'skipped':'done';touch(w,now.toISOString());
    if(actual.reason==='pain'||actual.reason==='illness') {state.hold=true;state.holdSince=now.toISOString();}
    const trigger=w.sport==='run'?`${w.actual.km} van ${w.actual.plannedKm} km geregistreerd.`:`${w.actual.minutes} minuten ${sports[w.sport].toLowerCase()} geregistreerd.`;
    if(state.profile.autoAdapt||state.hold) adaptPlan(state,{now,trigger});
    else changeLog(state,'Training opgeslagen','Automatisch aanpassen staat uit. Beoordeel je schema via Coach.',[],now);
    return state;
  }
  function checkMove(state,w) {
    zonedInstant(w.date,w.time,state.profile.timezone);
    if(SK.clockMinutes(w.time)+w.minutes>1440) throw new Error('Kies een eindtijd voor middernacht.');
    for(const t of state.workouts) if(t.id!==w.id&&t.date===w.date&&['planned','held','done'].includes(t.status)&&overlap(t,w)) throw new Error('Dit moment overlapt met een andere sportactiviteit. Kies een andere tijd.');
  }
  function editWorkout(state,id,patch,{now=new Date()}={}) {
    const w=state.workouts.find(x=>x.id===id);if(!w||!['planned','held'].includes(w.status)) throw new Error('Deze training kan niet meer worden verplaatst.');
    const before=eventSnap(w), next={...w,...patch};checkMove(state,next);
    if(w.date!==next.date||w.time!==next.time) {
      if(w.source==='plan'&&w.slotId){state.excludedOccurrences=[...new Set([...(state.excludedOccurrences||[]),w.slotId+':'+w.date])];}
      next.source='manual';next.slotId=null;
    }
    Object.assign(w,next,{baseKm:next.km,baseMinutes:next.minutes});touch(w,now.toISOString());
    changeLog(state,'Training gewijzigd','Handmatige wijziging. Datum en tijd worden niet vanzelf teruggezet.',[{id,title:w.title,before,after:eventSnap(w)}],now);
    return state;
  }
  function cancelWorkout(state,id,{now=new Date()}={}) {
    const w=state.workouts.find(x=>x.id===id);if(!w||finalStatuses.has(w.status)) throw new Error('Alleen een geplande training kan worden verwijderd.');
    const before=eventSnap(w);
    // A deliberate deletion of a recurring plan occurrence must remain deleted on
    // future rebuilds. Automatic goal-day suppression never writes this exclusion.
    if(w.source==='plan'&&w.slotId){state.excludedOccurrences=[...new Set([...(state.excludedOccurrences||[]),w.slotId+':'+w.date])];}
    w.status='cancelled';delete w.cancelReason;delete w.suppressedGoalKey;touch(w,now.toISOString());
    changeLog(state,'Training verwijderd','De agendakoppeling krijgt een annulering met hetzelfde afspraak-ID.',[{id,title:w.title,before,after:eventSnap(w)}],now);
    return state;
  }
  function resumePlan(state,weekly,longest,{now=new Date()}={}) {
    const p={...state.profile,baseWeeklyKm:Number(weekly),longestKm:Number(longest)};validateProfile(p,state.slots);
    state.profile=p;state.hold=false;state.holdSince=null;state.lastResume=now.toISOString();
    for(const w of state.workouts) if(w.status==='held') {w.status='planned';touch(w,now.toISOString());}
    generatePlan(state,{now,start:isoDay(now),weeks:planWindow(state.profile,isoDay(now)).weeks});
    changeLog(state,'Bewust hervat','Opnieuw opgebouwd vanaf het door jou bevestigde startniveau.',[],now);return state;
  }
  function warnings(state,now=new Date()) {
    const notes=[];if(!state.profile) return notes;
    if(state.hold) notes.push('Je planning staat gepauzeerd. Er worden geen nieuwe actieve trainingen ingepland totdat je bewust hervat.');
    const p=state.profile,today=isoDay(now);
    const pending=state.workouts.filter(w=>w.status==='planned'&&w.date<today);
    if(pending.length) notes.push(`${pending.length} eerdere training(en) nog niet geregistreerd. Vul de werkelijke uitvoering in; de app kan deze niet raden.`);
    const runs=state.slots.filter(s=>s.sport==='run'), days=new Set(runs.map(s=>Number(s.day)));
    const capacity=runs.reduce((a,s)=>a+(normalizeKind(s.kind)==='long'?32:Math.max(0,(s.minutes-10)/p.pace)),0);
    if(capacity<p.baseWeeklyKm*.9)notes.push('Je vaste korte/intervalmomenten plus maximaal 32 km op je lange dag bieden minder ruimte dan je opgegeven hardloopbasis. Het schema kan daardoor worden ingekort.');
    if([...days].some(d=>days.has((d+1)%7))) notes.push('Je hebt hardloopdagen direct achter elkaar gekozen. Beoordeel zelf of je genoeg hersteltijd hebt.');
    if(runs.length>=2&&!runs.some(s=>normalizeKind(s.kind)==='long')) notes.push('Je hebt meerdere hardloopdagen maar geen lange afstandsdag gekozen. Voor 10 km, halve marathon en marathon is een rustige langere loop meestal nuttig.');
    if(runs.some(s=>normalizeKind(s.kind)==='interval')&&runs.length<2) notes.push('Je enige hardloopdag staat als interval. Voor de meeste doelen is ook rustige duurtraining nodig; overweeg een extra rustige dag.');
    if(p.goal==='marathon') notes.push('Marathondoel: trainingsduurloop maximaal 32 km. De wedstrijddag kan 42,2 km zijn; het schema blijft software en geen persoonlijke medische begeleiding.');
    if(planMode(p)==='goal'&&p.raceDate) {
      const left=daysBetween(today,p.raceDate),weeks=Math.max(1,Math.ceil(left/7));
      if(left<0) notes.push('Je doeldatum is voorbij. Werk je doel bij.');
      else if(weeks>52) notes.push(`Je doel ligt ongeveer ${weeks} weken weg. De app plant maximaal 52 weken vooruit en blijft daarvoor eerst in een rustige basisfase.`);
      else if(left>0&&left<28) notes.push('Je hebt minder dan 4 weken tot je doeldatum. De app gebruikt het conservatieve einde van het 4-wekenmodel en forceert geen inhaalsprong.');
      if(p.goal!=='fit'&&left>0){
        const total=clamp(weeks,4,52), model=OFFLINE_MODELS[p.goal][total], peakIndex=Math.max(0,...model.map((w,i)=>w.phase==='piek'?i:0));
        const possible=targetForWeek(p,peakIndex,monday(today),total), desired=peakLongTarget(p);
        if(possible.longKm<desired-1) notes.push(`Met je huidige langste loop en ${weeks} weken tot je doel komt de veilige voorgerekende piekduurloop rond ${possible.longKm} km uit in plaats van ${desired} km. De app bouwt wel maximaal op binnen dit venster, maar forceert geen onrealistische sprong.`);
      }
    }
    if(planMode(p)==='fixed'&&state.planEnd&&daysBetween(today,state.planEnd)<21) notes.push('Je planning loopt binnenkort af. Bouw in Instellingen opnieuw verder op; afgeronde trainingen blijven bewaard.');
    return notes;
  }
  function externalRunId(provider,id){return String(provider||'external')+':'+String(id||'');}
  function mergeExternalRuns(state,activities,{now=new Date()}={}) {
    if(!Array.isArray(activities)) throw new Error('Ongeldige importgegevens.');
    let imported=0,updated=0;
    const changes=[];
    for(const a of activities){
      if(!a||!a.id||!/^[0-9A-Za-z_-]{1,80}$/.test(String(a.id))) continue;
      const date=String(a.date||''); if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const km=roundKm(Number(a.distanceKm)||0), minutes=Math.max(0,Math.round((Number(a.movingSeconds)||0)/60));
      if(km<=0||minutes<=0) continue;
      const extId=externalRunId(a.provider||'strava',a.id);
      let w=state.workouts.find(x=>x.external?.id===extId);
      const incomingEfforts=Array.isArray(a.bestEfforts)?a.bestEfforts.slice(0,20).map(e=>({name:String(e.name||''),distanceKm:roundKm(Number(e.distanceKm)||0),seconds:Math.max(1,Math.round(Number(e.seconds)||0))})).filter(e=>e.distanceKm>0):[];
      const external={id:extId,provider:String(a.provider||'strava'),providerId:String(a.id),url:String(a.url||''),deviceName:String(a.deviceName||''),elevationGain:Number(a.elevationGain)||0,movingSeconds:Math.max(1,Math.round(Number(a.movingSeconds)||minutes*60)),averagePaceSeconds:Number(a.averagePaceSeconds)||Math.round((minutes*60)/km),averageHeartrate:Number(a.averageHeartrate)||0,maxHeartrate:Number(a.maxHeartrate)||0,averageCadence:Number(a.averageCadence)||0,bestEfforts:incomingEfforts};
      if(w){
        external.bestEfforts=incomingEfforts.length?incomingEfforts:(w.external?.bestEfforts||[]);
        external.deviceName=external.deviceName||w.external?.deviceName||'';
        w.external=external;w.actual={...(w.actual||{}),km,minutes,plannedKm:w.actual?.plannedKm??w.km,plannedMinutes:w.actual?.plannedMinutes??w.minutes,loggedAt:w.actual?.loggedAt||now.toISOString(),rpe:w.actual?.rpe??5,reason:w.actual?.reason||'other',notes:w.actual?.notes||'Automatisch geimporteerd. Bevestig inspanning en reden als je wilt dat de lokale planner deze training gebruikt voor bijsturing.',needsReview:w.actual?.needsReview??true};
        w.status='done';touch(w,now.toISOString());updated++;continue;
      }
      w=state.workouts.find(x=>x.sport==='run'&&x.date===date&&['planned','held'].includes(x.status)&&!x.actual&&!x.external);
      if(w){
        w.actual={km,minutes,rpe:5,reason:'other',notes:'Automatisch geimporteerd. Bevestig inspanning en reden als je wilt dat de lokale planner deze training gebruikt voor bijsturing.',plannedKm:w.km,plannedMinutes:w.minutes,loggedAt:now.toISOString(),needsReview:true};
        w.status='done';w.external=external;touch(w,now.toISOString());
      } else {
        const time=/^\d{2}:\d{2}$/.test(String(a.time||''))?String(a.time):'12:00';
        w=makeWorkout({date,time,sport:'run',kind:'short',title:String(a.name||'Geimporteerde hardlooptraining').slice(0,120),km,minutes,baseKm:km,baseMinutes:minutes,status:'done',source:'strava',locked:false,external},now);
        w.actual={km,minutes,rpe:5,reason:'other',notes:'Automatisch geimporteerd. Bevestig inspanning en reden als je wilt dat de lokale planner deze training gebruikt voor bijsturing.',plannedKm:km,plannedMinutes:minutes,loggedAt:now.toISOString(),needsReview:true};
        state.workouts.push(w);
      }
      changes.push({id:w.id,title:w.title,before:{km:w.actual?.plannedKm||km,status:'planned',date:w.date,time:w.time},after:eventSnap(w)});imported++;
    }
    if(imported||updated) changeLog(state,'Activiteiten geimporteerd',`${imported} nieuwe en ${updated} bijgewerkte hardloopactiviteit(en) uit externe bron. Geimporteerde activiteiten sturen het schema pas mee nadat je inspanning en reden hebt bevestigd.`,changes.slice(0,20),now);
    return {imported,updated};
  }
  function confirmImportedWorkout(state,id,actual,{now=new Date()}={}){
    const w=state.workouts.find(x=>x.id===id);if(!w||!w.external)throw new Error('Geimporteerde training niet gevonden.');
    if(!w.actual)throw new Error('Deze import bevat geen traininggegevens.');
    w.actual.needsReview=false;
    return logWorkout(state,id,actual,{now});
  }

  function notificationSettings(state){
    const raw=state&&state.notifications&&typeof state.notifications==='object'?state.notifications:{};
    return {
      enabled:raw.enabled!==false,
      appBadge:raw.appBadge!==false,
      systemNotifications:raw.systemNotifications!==false,
      upcoming:raw.upcoming!==false,
      upcomingHours:[1,2,4,8,12,24,48].includes(Number(raw.upcomingHours))?Number(raw.upcomingHours):4,
      pending:raw.pending!==false,
      pendingDelayMinutes:[0,15,30,60,120,180].includes(Number(raw.pendingDelayMinutes))?Number(raw.pendingDelayMinutes):30
    };
  }
  function workoutStartInstant(w){
    try{return zonedInstant(w.date,w.time||'00:00','Europe/Amsterdam');}catch{return new Date(w.date+'T'+(w.time||'00:00')+':00');}
  }
  function attentionItems(state, now=new Date()){
    if(!state||!Array.isArray(state.workouts))return [];
    const pref=notificationSettings(state);if(!pref.enabled)return [];
    const nowMs=now.getTime(), items=[];
    for(const w of state.workouts){
      if(!w||w.status!=='planned')continue;
      const start=workoutStartInstant(w),startMs=start.getTime(),duration=Math.max(0,Number(w.minutes)||0)*60000,endMs=startMs+duration;
      if(pref.upcoming&&startMs>nowMs&&startMs-nowMs<=pref.upcomingHours*3600000){
        items.push({key:`upcoming:${w.id}:${w.date}:${w.time}`,category:'upcoming',workoutId:w.id,date:w.date,time:w.time,title:'Training komt eraan',body:`${w.title} om ${w.time}${w.sport==='run'&&w.km?` · ${roundKm(w.km)} km`:''}.`,sortAt:startMs});
      }
      if(pref.pending&&endMs+pref.pendingDelayMinutes*60000<=nowMs&&nowMs-endMs<=7*86400000){
        items.push({key:`pending:${w.id}:${w.date}:${w.time}`,category:'pending',workoutId:w.id,date:w.date,time:w.time,title:'Training nog invullen',body:`${w.title} stond gepland op ${w.date} om ${w.time}. Vul in wat je werkelijk hebt gedaan.`,sortAt:endMs});
      }
    }
    return items.sort((a,b)=>a.sortAt-b.sortAt);
  }

  function personalRecords(state){
    const targets=[['1 km',1],['5 km',5],['10 km',10],['Halve marathon',21.0975],['Marathon',42.195]];
    const runs=state.workouts.filter(w=>w.sport==='run'&&w.status==='done'&&w.actual&&w.actual.km>0&&w.actual.minutes>0);
    const bestEfforts=[];
    for(const w of runs)for(const e of (w.external?.bestEfforts||[]))if(e.distanceKm>0&&e.seconds>0)bestEfforts.push({distanceKm:e.distanceKm,seconds:e.seconds,date:w.date,workoutId:w.id,estimated:false,source:w.external.provider});
    const records=targets.map(([label,target])=>{
      const exact=bestEfforts.filter(e=>Math.abs(e.distanceKm-target)<=Math.max(.08,target*.025)).sort((a,b)=>a.seconds-b.seconds)[0];
      if(exact)return {label,distanceKm:target,...exact};
      const candidates=runs.filter(w=>Math.abs(w.actual.km-target)<=Math.max(.12,target*.03)).map(w=>({seconds:Math.round((Number(w.external?.movingSeconds)||w.actual.minutes*60)*(target/w.actual.km)),date:w.date,workoutId:w.id,estimated:true,source:w.external?.provider||'manual'})).sort((a,b)=>a.seconds-b.seconds);
      return {label,distanceKm:target,...(candidates[0]||{seconds:null,date:null,workoutId:null,estimated:false,source:null})};
    });
    const longest=runs.slice().sort((a,b)=>b.actual.km-a.actual.km)[0]||null;
    const fastest=runs.filter(w=>w.actual.km>=3).map(w=>({workout:w,paceSeconds:(Number(w.external?.movingSeconds)||w.actual.minutes*60)/w.actual.km})).sort((a,b)=>a.paceSeconds-b.paceSeconds)[0]||null;
    return {records,longest:longest?{km:longest.actual.km,date:longest.date,workoutId:longest.id}:null,fastest:fastest?{paceSeconds:Math.round(fastest.paceSeconds),date:fastest.workout.date,workoutId:fastest.workout.id}:null};
  }
  Object.assign(SK,{freshState,validateProfile,validateState,generatePlan,adaptPlan,logWorkout,makeWorkout,checkMove,editWorkout,cancelWorkout,resumePlan,warnings,eventSnap,changeLog,resetCoachHistory,touch,targetForWeek,goalWeeks,taperWeeks,planWindow,buildOfflineModel,OFFLINE_MODELS,intervalPrescription,normalizeKind,mergeExternalRuns,confirmImportedWorkout,personalRecords,notificationDefaults,notificationSettings,attentionItems,peakLongTarget,longRunTargetForModel});
})(globalThis.SK ||= {});
