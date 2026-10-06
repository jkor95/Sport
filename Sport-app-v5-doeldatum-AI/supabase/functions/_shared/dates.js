(function (SK) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  function isoDay(date = new Date(), zone = 'Europe/Amsterdam') {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function addDays(day, n) {
    const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
  }
  function dayIndex(day) { return (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7; }
  function monday(day) { return addDays(day, -dayIndex(day)); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function dateLabel(day, opts = {}) { return new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', day: 'numeric', month: 'short', ...opts }).format(new Date(day + 'T12:00:00Z')); }
  function clockMinutes(time) { const [h,m] = time.split(':').map(Number); return h*60+m; }
  function localClock(date = new Date(), zone = 'Europe/Amsterdam') { return new Intl.DateTimeFormat('en-GB', {timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(date); }
  function zonedInstant(day, time, zone = 'Europe/Amsterdam') {
    const [y, mo, d] = day.split('-').map(Number), [h, mi] = time.split(':').map(Number);
    const target = Date.UTC(y, mo-1, d, h, mi); let candidate = target;
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
    const parts = n => Object.fromEntries(fmt.formatToParts(new Date(n)).map(p => [p.type, p.value]));
    for (let i=0; i<4; i++) { const p=parts(candidate); const asUTC=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second); const shift=target-asUTC; if(!shift) break; candidate+=shift; }
    const check=parts(candidate);
    if (`${check.year}-${check.month}-${check.day}` !== day || `${check.hour}:${check.minute}` !== time) throw new Error('Dit tijdstip bestaat niet door de overgang naar zomertijd. Kies een andere tijd.');
    return new Date(candidate);
  }
  function uid() {
    if(crypto.randomUUID) return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16)); bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  function roundKm(n) { return Math.round(Math.max(0, n) * 10) / 10; }
  function clone(x) { return structuredClone(x); }
  const sports = { run:'Hardlopen', strength:'Krachttraining', cycle:'Fietsen', walk:'Wandelen', padel:'Padel', windsurf:'Windsurfen', other:'Overig' };
  const goals = { fit:'Fit blijven', '5k':'5 km opbouwen', '10k':'10 km opbouwen', half:'Halve marathon', marathon:'Marathon' };
  Object.assign(SK, {pad,isoDay,addDays,dayIndex,monday,daysBetween,dateLabel,clockMinutes,localClock,zonedInstant,uid,roundKm,clone,sports,goals});
})(globalThis.SK ||= {});
