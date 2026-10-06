(function (SK) {
  'use strict';
  const {isoDay, addDays, dayIndex, monday, daysBetween, uid, roundKm, clone, sports, zonedInstant} = SK;
  const validStatuses = new Set(['planned','done','skipped','cancelled','held']);
  const finalStatuses = new Set(['done','skipped','cancelled']);
  function freshState() {
    return {schemaVersion:1, profile:null, slots:[], workouts:[], adjustments:[], excludedOccurrences:[], hold:false, holdSince:null, lastResume:null};
  }
  function validateProfile(p, slots) {
    if (!p || !String(p.name || '').trim()) throw new Error('Vul je voornaam in.');
    if (!SK.goals[p.goal]) throw new Error('Kies een geldig doel.');
    if (!(+p.baseWeeklyKm >= 1 && +p.baseWeeklyKm <= 150)) throw new Error('Vul je werkelijke gemiddelde hardloopkilometers per week in (1-150).');
    if (!(+p.longestKm >= 1 && +p.longestKm <= +p.baseWeeklyKm)) throw new Error('Je recente langste loop moet tussen 1 km en je weektotaal liggen.');
    if (!(+p.pace >= 3 && +p.pace <= 15)) throw new Error('Vul een rustig tempo in tussen 3 en 15 min/km.');
    if (p.timezone !== 'Europe/Amsterdam') throw new Error('Deze versie gebruikt Europe/Amsterdam.');
    if (!slots.length || slots.length > 14) throw new Error('Kies 1-14 vaste sportmomenten.');
    const runs = slots.filter(s=>s.sport==='run');
    if (runs.length < 1 || runs.length > 4) throw new Error('Deze eerste versie ondersteunt 1-4 hardloopmomenten per week.');
    if (runs.filter(s=>s.kind==='long').length > 1) throw new Error('Kies maximaal een lange duurloop per week.');
    const seen = new Set();
    for(const s of slots) {
      if (seen.has(s.id)) throw new Error('Een vast sportmoment staat dubbel.'); seen.add(s.id);
      if (!Number.isInteger(+s.day) || +s.day < 0 || +s.day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) || !(+s.minutes>=15 && +s.minutes<=300) || !sports[s.sport]) throw new Error('Controleer dag, begintijd, sport en tijdsduur van je vaste momenten.');
      if (SK.clockMinutes(s.time)+Number(s.minutes)>1440) throw new Error('Laat een training voor middernacht eindigen.');
      for(const t of slots) if(t.id!==s.id && +t.day===+s.day && overlap(s,t)) throw new Error('Twee vaste sportmomenten overlappen elkaar.');
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
  function goalWeeks(p,start=isoDay()) {
    if(!p.raceDate || p.raceDate<start) return null;
    return Math.max(1,Math.ceil(daysBetween(start,p.raceDate)/7));
  }
  function taperWeeks(goal,total) {
    if(total<=2) return 0;
    if(goal==='marathon') return total>=6?2:1;
    if(goal==='half') return 1;
    if(goal==='10k'||goal==='5k') return 1;
    return 0;
  }
  function targetForWeek(p, wi, firstWeek, planWeeks=null) {
    const weekStart=addDays(firstWeek,wi*7), base=Number(p.baseWeeklyKm), longest=Number(p.longestKm);
    const ai=(p.aiMode&&p.aiStrategy&&Array.isArray(p.aiStrategy.weeks))?p.aiStrategy.weeks.find(x=>Number(x.index)===wi):null;
    const total=planWeeks!=null?Math.max(1,Number(planWeeks)):p.raceDate?Math.max(1,Math.ceil(daysBetween(firstWeek,p.raceDate)/7)):Math.max(1,Number(p.horizon)||12);
    const taper=taperWeeks(p.goal,total), peakIndex=Math.max(0,total-taper-1);
    const left=p.raceDate?Math.ceil(daysBetween(weekStart,p.raceDate)/7):null;
    const goalPeakWeekly={fit:base,'5k':Math.max(base,20),'10k':Math.max(base*1.35,28),half:Math.max(base*1.55,38),marathon:Math.max(base*1.9,48)}[p.goal];
    const goalPeakLong={fit:longest,'5k':Math.max(longest,6),'10k':Math.max(longest,11),half:Math.max(longest,18),marathon:Math.max(longest,30)}[p.goal];
    const buildProgress=peakIndex<=0?1:clamp(wi/peakIndex,0,1);
    // Goal curve: use all available weeks, but never let the date itself force a huge leap.
    const feasibleWeekly=base*Math.pow(1.10,Math.max(0,Math.min(wi,peakIndex)));
    const feasibleLong=longest*Math.pow(1.15,Math.max(0,Math.min(wi,peakIndex)));
    let weekly=Math.min(base+(goalPeakWeekly-base)*buildProgress,feasibleWeekly,90);
    let longKm=Math.min(longest+(goalPeakLong-longest)*buildProgress,feasibleLong,32);
    let phase=buildProgress<.20?'basis':buildProgress<.82?'opbouw':'piek';
    if(ai && wi<=peakIndex){
      const aiWeekly=Number(ai.weeklyKm), aiLong=Number(ai.longKm);
      const recovery=String(ai.phase||'')==='herstel';
      if(Number.isFinite(aiWeekly)) weekly=clamp(aiWeekly,weekly*(recovery?.72:.90),feasibleWeekly);
      if(Number.isFinite(aiLong)) longKm=clamp(aiLong,longKm*(recovery?.70:.90),feasibleLong);
      phase=String(ai.phase||phase);
    }
    // Every fourth build week can be lighter, except the final peak week.
    if(wi>0&&wi%4===3&&wi<peakIndex){weekly*=.86;longKm*=.82;phase='herstel';}
    // Taper is determined by distance to the goal. The race itself is a separate goal event.
    if(p.raceDate&&wi>peakIndex){
      const taperIndex=wi-peakIndex;
      if(taper>=2&&taperIndex===1){weekly=Math.min(weekly,Math.max(base*.80,weekly*.78));longKm=Math.min(longKm,Math.max(8,goalPeakLong*.62),22);phase='taper';}
      else {weekly=Math.min(weekly,Math.max(base*.60,weekly*.62));longKm=Math.min(longKm,Math.max(5,goalPeakLong*.38),14);phase='taper';}
    }
    // A long run may be a large share of a low-mileage week, but never more than 70%.
    longKm=Math.min(longKm,Math.max(longest,weekly*.70));
    return {weekStart,weeklyKm:roundKm(Math.max(1,weekly)),longKm:roundKm(Math.max(1,longKm)),phase,left,totalWeeks:total,peakIndex};
  }
  function generatePlan(state, {start=isoDay(),weeks=12,now=new Date()} = {}) {
    const p=state.profile; validateProfile(p,state.slots);
    const exactGoalWeeks=goalWeeks(p,start);
    if(exactGoalWeeks!==null) weeks=exactGoalWeeks;
    if(!Number.isInteger(weeks)||weeks<1||weeks>52) throw new Error('Kies 1-52 weken.');
    const end=p.raceDate&&p.raceDate>=start?p.raceDate:addDays(monday(start),weeks*7-1), at=now.toISOString();
    const runs=state.slots.filter(s=>s.sport==='run');
    const longSlot=runs.find(s=>s.kind==='long') || [...runs].sort((a,b)=>b.minutes-a.minutes)[0];
    const oldMap=new Map(state.workouts.filter(w=>w.source==='plan').map(w=>[w.slotId+':'+w.date,w]));
    const activeKeys=new Set(), changes=[]; const firstWeek=monday(start);
    const excluded=new Set(state.excludedOccurrences||[]); let blocked=0;
    for(let day=start;day<=end;day=addDays(day,1)) {
      const wi=Math.max(0,Math.floor(daysBetween(firstWeek,day)/7));
      const target=targetForWeek(p,wi,firstWeek,weeks), budget=target.weeklyKm;
      const todays=state.slots.filter(s=>Number(s.day)===dayIndex(day));
      for(const slot of todays) {
        const key=slot.id+':'+day; activeKeys.add(key); if(excluded.has(key)) continue; const existing=oldMap.get(key);
        if(existing && (finalStatuses.has(existing.status)||existing.locked)) continue;
        if(!existing && zonedInstant(day,slot.time,p.timezone)<now) continue;
        // On the exact goal date the goal event replaces the ordinary run; other sports stay visible.
        if(p.raceDate===day && slot.sport==='run' && p.goal!=='fit'){ if(existing&&!finalStatuses.has(existing.status)&&!existing.locked){existing.status='cancelled';touch(existing,at);} continue; }
        let km=0,minutes=Number(slot.minutes),kind=slot.kind||'easy';
        if(slot.sport==='run') {
          let share;
          if(slot.id===longSlot.id) share=Math.min(.62,Math.max(runs.length===1?1:.38,target.longKm/Math.max(1,budget)));
          else share=(1-Math.min(.62,Math.max(.38,target.longKm/Math.max(1,budget))))/Math.max(1,runs.length-1);
          const desired=slot.id===longSlot.id?target.longKm:budget*share;
          km=roundKm(Math.min(desired,32,Math.max(0,(slot.minutes-10)/p.pace)));
          minutes=Math.min(slot.minutes,Math.max(15,Math.ceil(km*p.pace+10)));
          kind=slot.id===longSlot.id?'long':'easy';
        }
        const title=slot.sport==='run'?(kind==='long'?`Rustige duurloop - ${target.phase}`:`Rustig hardlopen - ${target.phase}`):sports[slot.sport];
        const conflict=state.workouts.find(w=>w.id!==existing?.id && w.date===day && ['planned','done','held'].includes(w.status) && (w.source!=='plan'||w.locked||w.status==='done') && overlap(w,{time:slot.time,minutes}));
        if(conflict){blocked++;activeKeys.delete(key);continue;}
        if(existing) {
          const before=eventSnap(existing);
          Object.assign(existing,{time:slot.time,sport:slot.sport,kind,title,baseKm:km,baseMinutes:minutes,km,minutes,planPhase:target.phase,adaptation:''});
          if(JSON.stringify(before)!==JSON.stringify(eventSnap(existing))) {touch(existing,at);changes.push({id:existing.id,title,before,after:eventSnap(existing)});}
        } else {
          const w=makeWorkout({date:day,time:slot.time,sport:slot.sport,kind,title,km,minutes,source:'plan',slotId:slot.id,planPhase:target.phase},now); state.workouts.push(w);
        }
      }
    }
    for(const w of state.workouts) if(w.source==='plan'&&w.date>=start&&w.date<=end&&!activeKeys.has(w.slotId+':'+w.date)&&!finalStatuses.has(w.status)&&!w.locked) {
      const before=eventSnap(w);w.status='cancelled';touch(w,at);changes.push({id:w.id,title:w.title,before,after:eventSnap(w)});
    }
    // Cancel obsolete future goal-day events when goal or target date changes.
    const currentGoalKey=(p.raceDate&&p.goal!=='fit')?p.goal+':'+p.raceDate:'';
    for(const w of state.workouts) {
      if(w.source!=='goal'||w.status==='done'||w.status==='skipped'||w.date<start) continue;
      if(!currentGoalKey||w.goalKey!==currentGoalKey) {
        if(w.status!=='cancelled'){w.status='cancelled';touch(w,at);changes.push({id:w.id,title:w.title,before:{...eventSnap(w),status:'planned'},after:eventSnap(w)});}
      }
    }
    // Add one explicit goal-day event when it falls inside the generated horizon.
    const distance=raceDistance(p.goal);
    if(p.raceDate&&distance&&p.raceDate>=start&&p.raceDate<=end){
      let race=state.workouts.find(w=>w.source==='goal'&&w.goalKey===p.goal+':'+p.raceDate);
      const raceMinutes=Math.max(30,Math.ceil(distance*p.pace));
      if(!race) {
        race=makeWorkout({date:p.raceDate,time:'09:00',sport:'run',kind:'race',title:`Doeldag - ${SK.goals[p.goal]}`,km:distance,minutes:raceMinutes,baseKm:distance,baseMinutes:raceMinutes,source:'goal',slotId:null,locked:true,goalKey:p.goal+':'+p.raceDate},now);
        state.workouts.push(race);
      } else if(race.status==='cancelled') {
        const before=eventSnap(race);
        Object.assign(race,{km:distance,baseKm:distance,minutes:raceMinutes,baseMinutes:raceMinutes,title:`Doeldag - ${SK.goals[p.goal]}`,locked:true,status:state.hold?'held':'planned'});
        touch(race,at);changes.push({id:race.id,title:race.title,before,after:eventSnap(race)});
      } else if(!finalStatuses.has(race.status)) {
        Object.assign(race,{km:distance,baseKm:distance,minutes:raceMinutes,baseMinutes:raceMinutes,title:`Doeldag - ${SK.goals[p.goal]}`,locked:true,status:state.hold?'held':'planned'});
      }
    }
    state.planStart=start;state.planEnd=end;
    adaptPlan(state,{now,writeAudit:false});
    const mode=p.aiMode&&p.aiStrategy?'AI-strategie + veiligheidsgrenzen':'doeldatumgerichte planner';
    changeLog(state,'Schema opgebouwd',`${weeks} weekblokken via ${mode}. Met een doeldatum gebruikt de planner exact de resterende tijd tot die datum, met opbouw, lichtere weken, piek en taper. De groei blijft begrensd door je startniveau en beschikbare trainingstijd. ${blocked?blocked+' moment(en) niet ingepland wegens overlap. ':''}Een doeldatum is geen garantie dat de afstand haalbaar is.`,changes,now);
    state.workouts.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    return state;
  }
  function adaptPlan(state, {now=new Date(),writeAudit=true,trigger=null}={}) {
    const today=isoDay(now,state.profile?.timezone), until=addDays(today,14), changes=[];
    const recent=state.workouts.filter(w=>(w.status==='done'||w.status==='skipped')&&w.actual&&w.date>=addDays(today,-14)&&w.date<=today&&(!state.lastResume||w.actual.loggedAt>state.lastResume)).sort((a,b)=>b.date.localeCompare(a.date)||b.actual.loggedAt.localeCompare(a.actual.loggedAt));
    const runs=recent.filter(w=>w.sport==='run');
    const shortRuns=runs.filter(w=>w.actual.plannedKm>0 && w.actual.km/w.actual.plannedKm<.75);
    const fatigued=recent.some(w=>w.actual.reason==='fatigue'||w.actual.rpe>=8);
    const repeated=shortRuns.length>=2;
    const missedPast=state.workouts.filter(w=>w.status==='planned'&&w.sport==='run'&&w.date<today&&w.date>=addDays(today,-14));
    // A missing log is unknown, not a completed workout. Hold volume rather than infer success.
    const unlogged=missedPast.length>=2;
    for(const w of state.workouts) {
      if(finalStatuses.has(w.status)||w.date<today) continue;
      if(zonedInstant(w.date,w.time,state.profile.timezone)<now) continue;
      const before=eventSnap(w);
      if(state.hold) {
        w.status='held';w.adaptation='Planning gepauzeerd. Hervat alleen bewust via Coach.';
      } else if(w.locked) {
        // Fixed means the whole manually locked session. Safety holds always override it.
        if(w.status==='held') w.status='planned';
        w.adaptation=(fatigued||repeated)?'Vastgezet: niet aangepast. Controleer zelf of deze training nog passend is.':'';
      } else {
        if(w.status==='held') w.status='planned';
        w.km=w.baseKm;w.minutes=w.baseMinutes;w.adaptation='';
        if(w.sport==='run') {
          let factor=1; const reasons=[];
          if((fatigued||repeated)&&w.date<=until) {factor=.8;reasons.push(fatigued?'Lichtere periode na hoge inspanning of vermoeidheid.':'Meerdere korte of gemiste trainingen: opbouw tijdelijk lager.');}
          if(unlogged) {factor=Math.min(factor,.9);reasons.push('Meerdere eerdere trainingen zijn niet afgevinkt; geen extra opbouw.');}
          let km=w.baseKm*factor;
          for(const r of shortRuns) {
            const left=daysBetween(r.date,w.date);
            const sameSlot=r.slotId&&w.slotId===r.slotId;
            const comparable=sameSlot||(!r.slotId&&r.kind===w.kind);
            if(comparable&&left>0&&left<=14&&r.actual.km>0) {
              km=Math.min(km,r.actual.km*(r.actual.reason==='time'||r.actual.reason==='weather'?1.2:1.1));
              reasons.push(`Vorige vergelijkbare loop: ${r.actual.km} van ${r.actual.plannedKm} km. Geen inhaalkilometers.`);
            }
          }
          w.km=roundKm(km);
          if(w.km<w.baseKm) w.minutes=Math.min(w.baseMinutes,Math.max(15,Math.ceil(w.km*state.profile.pace+10)));
          w.adaptation=[...new Set(reasons)].join(' ');
        } else if(fatigued&&w.date<=addDays(today,7)) {
          w.adaptation='Er is hoge inspanning gemeld. Beoordeel deze andere sport zelf; hardloopkilometers zijn niet uitwisselbaar met deze sport.';
        }
      }
      if(JSON.stringify(before)!==JSON.stringify(eventSnap(w))) {touch(w,now.toISOString());changes.push({id:w.id,title:w.title,before,after:eventSnap(w)});}
    }
    if(writeAudit) {
      let detail=state.hold?'Alle toekomstige trainingen zijn gepauzeerd. Pijn of ziekte wordt niet met extra trainingen gecompenseerd.':changes.length?`${changes.length} training(en) aangepast. Vaste dagen en begintijden blijven staan. Gemiste kilometers worden niet op andere trainingen gestapeld.`:'Geen afstand aangepast. Vaste momenten blijven staan; er worden geen gemiste kilometers ingehaald.';
      if(trigger) detail=`${trigger} ${detail}`;
      changeLog(state,state.hold?'Herstel eerst':'Schema opnieuw beoordeeld',detail,changes,now);
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
    w.actual={km,minutes,rpe,reason:actual.reason,notes:String(actual.notes||'').slice(0,1000),plannedKm:old?.plannedKm??w.km,plannedMinutes:old?.plannedMinutes??w.minutes,loggedAt:now.toISOString()};
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
    const before=eventSnap(w);w.status='cancelled';touch(w,now.toISOString());
    changeLog(state,'Training verwijderd','De agendakoppeling krijgt een annulering met hetzelfde afspraak-ID.',[{id,title:w.title,before,after:eventSnap(w)}],now);
    return state;
  }
  function resumePlan(state,weekly,longest,{now=new Date()}={}) {
    const p={...state.profile,baseWeeklyKm:Number(weekly),longestKm:Number(longest)};validateProfile(p,state.slots);
    state.profile=p;state.hold=false;state.holdSince=null;state.lastResume=now.toISOString();
    for(const w of state.workouts) if(w.status==='held') {w.status='planned';touch(w,now.toISOString());}
    generatePlan(state,{now,start:isoDay(now),weeks:state.profile.horizon||12});
    changeLog(state,'Bewust hervat','Opnieuw opgebouwd vanaf het door jou bevestigde startniveau.',[],now);return state;
  }
  function warnings(state,now=new Date()) {
    const notes=[];if(!state.profile) return notes;
    if(state.hold) notes.push('Je planning staat gepauzeerd. Er worden geen nieuwe actieve trainingen ingepland totdat je bewust hervat.');
    const p=state.profile,today=isoDay(now);
    const pending=state.workouts.filter(w=>w.status==='planned'&&w.date<today);
    if(pending.length) notes.push(`${pending.length} eerdere training(en) nog niet geregistreerd. Vul de werkelijke uitvoering in; de app kan deze niet raden.`);
    const runs=state.slots.filter(s=>s.sport==='run');
    const days=new Set(runs.map(s=>Number(s.day)));
    const capacity=runs.reduce((a,s)=>a+Math.max(0,(s.minutes-10)/p.pace),0);
    if(capacity<p.baseWeeklyKm*.9)notes.push('Je vaste momenten bieden minder tijd dan je opgegeven hardloopbasis nodig heeft. Het schema wordt ingekort; maak alleen extra ruimte als dat voor jou passend is.');
    if([...days].some(d=>days.has((d+1)%7))) notes.push('Je hebt hardloopdagen direct achter elkaar gekozen. Beoordeel zelf of je genoeg hersteltijd hebt.');
    if(p.goal==='marathon') notes.push('Marathondoel: de app bouwt nu terug vanaf de doeldatum met piek- en taperweken, maar dit blijft trainingssoftware en geen medische of persoonlijke loopbegeleiding.');
    if(p.raceDate) {
      const left=daysBetween(today,p.raceDate);
      if(left<0) notes.push('Je doeldatum is voorbij. Werk je doel bij.');
      else if(left<84&&['half','marathon'].includes(p.goal)) notes.push(`Je hebt nog ongeveer ${Math.max(1,Math.ceil(left/7))} weken tot je doel. Sport-app gebruikt precies die resterende weken voor de opbouw; een te korte voorbereiding wordt niet kunstmatig gecompenseerd met een extreme sprong.`);
      if(p.goal==='marathon'&&left>0){
        const total=Math.max(1,Math.ceil(left/7)), peak=Math.max(0,total-taperWeeks('marathon',total)-1), possible=roundKm(Math.min(34,p.longestKm*Math.pow(1.15,peak)));
        if(possible<26) notes.push(`Met je huidige langste loop en ${total} resterende weken komt een realistische piekduurloop waarschijnlijk rond maximaal ${possible} km uit. De app laat de wedstrijddag wel als doel staan, maar adviseert de haalbaarheid of datum met een looptrainer te beoordelen.`);
      }
    }
    if(p.aiMode&&!p.aiStrategy) notes.push('AI-modus staat aan, maar er is nog geen AI-strategie opgeslagen. Maak het AI-schema opnieuw via Coach of sla Instellingen opnieuw op.');
    if(!p.raceDate&&state.planEnd&&daysBetween(today,state.planEnd)<21) notes.push('Je planning loopt binnenkort af. Bouw in Instellingen opnieuw verder op; afgeronde trainingen blijven bewaard.');
    return notes;
  }
  Object.assign(SK,{freshState,validateProfile,validateState,generatePlan,adaptPlan,logWorkout,makeWorkout,checkMove,editWorkout,cancelWorkout,resumePlan,warnings,eventSnap,changeLog,resetCoachHistory,touch,targetForWeek,goalWeeks,taperWeeks});
})(globalThis.SK ||= {});
