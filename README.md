# MijnLoop v16

MijnLoop is een hardloopgerichte sportagenda met **lokale, adaptieve hardloopschema's van 4 t/m 52 weken**. De trainingsberekeningen werken zonder AI.

## Belangrijkste functies

- Doelen: fit blijven, 5 km, 10 km, halve marathon en marathon.
- Plannen op doeldatum of een vaste periode van 4 t/m 52 weken.
- Tempo invoeren als `mm:ss/km`, bijvoorbeeld `6:30`.
- Per hardloopdag: korte/rustige loop, lange afstand of interval.
- Concrete intervalopdrachten in de agenda.
- Lokale bijsturing na goede, zware of ingekorte trainingen.
- Geen inhaalschuld voor gemiste kilometers.
- Pijn/ziekte pauzeert de planning.
- Marathontrainingsloop maximaal 32 km; 42,2 km alleen als marathondoeldag.
- Coach-historie met resetknop.
- Agenda-abonnement, JSON-export en fysio-PDF.
- **PR-overzicht** voor 1 km, 5 km, 10 km, halve marathon en marathon.
- Langste loop en snelste gemiddelde tempo vanaf 3 km.
- **Optionele Strava-import** voor afstand, tijd, tempo, hoogte, apparaat, beschikbare best efforts en waar beschikbaar hartslag/cadans.
- Garmin kan praktisch via **Garmin Connect -> Strava -> MijnLoop** lopen.

## Geen actieve AI

MijnLoop v16 bevat geen actieve AI-knoppen of AI-aanroepen. De bestaande `ai-plan` Edge Function mag als standby in Supabase blijven staan en wordt niet door de app gebruikt.


## Als je v11/v12 nog niet hebt geinstalleerd
Dat is geen probleem. V16 bevat alle functies uit de vorige versies. Vervang direct je GitHub-bestanden door v16. Voor automatische Strava/Garmin-import volg je daarna eenmalig `STRAVA-EENMALIGE-SETUP.md`.

## Strava is optioneel

De basisupdate vereist alleen GitHub. Voor Strava-import is een **eenmalige** Supabase-installatie nodig: één tabel, twee secrets en één Edge Function. Zie `STRAVA-EENMALIGE-SETUP.md`.

## Technisch

- Statische GitHub Pages-app.
- Supabase Auth + persoonlijke JSON-state.
- Lokale trainingsmotor in `core/planner.js`.
- Strava OAuth-tokens blijven server-side en staan nooit in `config.js` of GitHub.


## Meldingen & badges
- In-app aandachtsteller voor openstaande acties.
- Categorie **Aankomende sportactiviteit** met instelbare voorlooptijd van 1 t/m 48 uur.
- Categorie **Training voorbij, nog niet ingevuld** met instelbare wachttijd van direct t/m 3 uur.
- Per categorie aan/uit, plus aparte schakelaars voor systeemmeldingen en app-icoonbadge.
- Op iPhone/iPad werkt de app-icoonbadge voor een Home Screen-webapp wanneer meldingen zijn toegestaan.
- Deze versie gebruikt geen extra Supabase-tabellen of Edge Functions voor meldingen. De melding/badge wordt bijgewerkt wanneer MijnLoop opent, actief is of synchroniseert.


## Lange-duurloopopbouw

- Bij `Gebruik doeldatum` is het aantal weken tot de doeldatum leidend voor het model.
- De langste duurloop wordt terug gepland vanaf de doeldag: opbouw -> piek -> taper.
- Marathon: de piek ligt voor een 3-weekse taper en blijft maximaal 32 km.
- Bij vaste sportmomenten voer je alleen dag en begintijd in; er is geen duur- of eindtijdveld meer.
- Voor hardlopen berekent MijnLoop de trainingsduur automatisch uit afstand, rustig tempo en trainingssoort.
- Als de resterende tijd vanaf je huidige langste loop te kort is om de normale piekafstand verantwoord te bereiken, toont MijnLoop een waarschuwing en gebruikt het de maximaal haalbare lokale curve.
