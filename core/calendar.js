(function(SK) {
  'use strict';
  const escapeICS=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');
  const stamp=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  function foldLine(line) {
    let out='',part='',bytes=0;
    for(const char of line) {const n=new TextEncoder().encode(char).length;if(bytes+n>75){out+=part+'\r\n';part=' ';bytes=1;}part+=char;bytes+=n;}
    return out+part;
  }
  function calendarText(state,{owner='sportkompas',minimal=true,now=new Date()}={}) {
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SportKompas//Sportagenda 1.0//NL','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:SportKompas','X-WR-TIMEZONE:Europe/Amsterdam','REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H'];
    for(const w of state.workouts) {
      // Keep cancellations for 180 days to let calendar clients remove known events.
      if(w.date<SK.addDays(SK.isoDay(now),-180)) continue;
      const start=SK.zonedInstant(w.date,w.time,state.profile?.timezone||'Europe/Amsterdam');
      const end=new Date(+start+Math.max(1,w.minutes)*60000);
      const cancelled=['cancelled','held','skipped'].includes(w.status);
      const summary=minimal?'Sporttraining':`${w.title}${w.sport==='run'?` - ${w.km} km`:''}`;
      lines.push('BEGIN:VEVENT',`UID:${w.id}.${owner}@sportkompas`, `DTSTAMP:${stamp(w.updatedAt||now)}`,`LAST-MODIFIED:${stamp(w.updatedAt||now)}`,`SEQUENCE:${w.sequence||0}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escapeICS(summary)}`,`DESCRIPTION:${escapeICS('Bekijk en wijzig deze training in SportKompas. Dit is een alleen-lezen agenda-abonnement.')}`,`STATUS:${cancelled?'CANCELLED':'CONFIRMED'}`,'CLASS:PRIVATE',`TRANSP:${cancelled?'TRANSPARENT':'OPAQUE'}`,'END:VEVENT');
    }
    lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';
  }
  Object.assign(SK,{escapeICS,calendarText,foldLine});
})(globalThis.SK ||= {});
