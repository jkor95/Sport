(function(SK){
  SK.demoState=function(now=new Date()) {
    const s=SK.freshState(),today=SK.isoDay(now),m=SK.monday(today);
    s.profile={name:'Jeremy (demo)',goal:'fit',baseWeeklyKm:22,longestKm:10,pace:6.5,timezone:'Europe/Amsterdam',raceDate:'',autoAdapt:true,planMode:'fixed',horizon:12};
    s.slots=[{id:'tue',day:1,time:'18:30',minutes:75,sport:'run',kind:'short'},{id:'thu',day:3,time:'18:30',minutes:75,sport:'run',kind:'interval'},{id:'sat',day:5,time:'10:00',minutes:60,sport:'strength',kind:'short'},{id:'sun',day:6,time:'09:30',minutes:100,sport:'run',kind:'long'}];
    SK.generatePlan(s,{now,start:today,weeks:12});
    // Entirely fictional history, not data retrieved from a watch or account.
    for(let week=4;week>=1;week--) for(const [offset,km] of [[1,5],[3,6],[6,9]]) {
      const date=SK.addDays(m,-7*week+offset),w=SK.makeWorkout({date,time:'18:30',sport:'run',kind:offset===6?'long':'short',title:offset===6?'Lange duurloop':'Korte rustige loop',km,minutes:Math.round(km*6.5),status:'done'},now);
      w.actual={km,minutes:w.minutes,rpe:5,reason:'normal',notes:'Fictieve voorbeeldtraining',plannedKm:km,plannedMinutes:w.minutes,loggedAt:date+'T19:00:00Z'};s.workouts.push(w);
    }
    // A demo card for the exact 10 -> 5 km scenario, ready to record today.
    s.workouts.push(SK.makeWorkout({date:today,time:'07:00',sport:'run',kind:'long',title:'Probeer: 10 km wordt 5 km',km:10,minutes:75,slotId:null},now));
    s.adjustments=[];SK.changeLog(s,'Welkom in de demo','Alle afstanden, sportmomenten en resultaten zijn fictief. Registreer vandaag 5 van de geplande 10 km en bekijk wat er verandert.',[],now);
    return s;
  };
})(globalThis.SK ||= {});
