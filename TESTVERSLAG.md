# Testverslag - SportKompas 1.0

Uitgevoerd op 6 oktober 2026, uitsluitend in een lokale testomgeving. Er is geen productieomgeving aangemaakt of gebruikt. Er zijn geen echte inloggegevens, agenda's of medische gegevens gebruikt.

## Planner en kalender: 34 tests geslaagd

Opdracht: `npm test` (Node.js v22.16.0). Resultaat: 34 geslaagd, 0 mislukt, 0 overgeslagen.

De tests omvatten onder meer:

- 10 km gepland naar 5 km werkelijk, onderscheid tijdgebrek/vermoeidheid, geen inhaalschuld, herhaald inkorten, vaste tijden en vastgezette trainingen.
- Idempotent herberekenen, behoud van het oorspronkelijk geplande aantal kilometers bij het corrigeren van een registratie, en geen steeds verder compenserende reductie door dubbel klikken.
- Pijn/ziekte, pauzeren ongeacht auto-aanpassing, bewust hervatten, geen toekomstige registraties en controle op ongeldige invoer.
- Herplannen met behoud van afgeronde activiteiten, verplaatste momenten niet opnieuw genereren, overlap met handmatige activiteiten, tijdsruimte en twee onafhankelijk ingerichte doelen.
- Wintertijd/zomertijd, onbestaande lokale tijden, jaarovergang, stabiele ICS-identificaties, annuleringen, minimale titels, escaping en regelafbreking.
- Gelijkheid van de kalender-/datumbronbestanden in browser en serverfunctie.

Dit zijn softwaregedragstests, geen bewijs van sportkundige veiligheid of haalbaarheid van een marathon.

## Interface: gecontroleerd in Chromium

De zelfstandige demo is zonder netwerk in Chromium geladen. Getest op een desktopviewport van 1440 x 1100 en mobiel van 390 x 844. De schermen Overzicht, Agenda, Coach, Voortgang en Instellingen zijn geopend. Geen horizontale overflow en geen JavaScript-pageerrors gevonden tijdens deze controles.

De registratie van de fictieve 10-km-training als 5 km is via het echte formulier uitgevoerd; de coachweergave meldde '5 van 10 km geregistreerd'. De maandweergave, het instellingenformulier en de mobiele registratiedialoog zijn gecontroleerd. Screenshots zijn visueel beoordeeld. Dit is geen volledige test van alle browser-/besturingssysteemcombinaties; Safari/iOS en echte PWA-installatie zijn niet live getest.

## Servermodules: 9 gesimuleerde toegangscontroles geslaagd

Opdracht: `node --experimental-transform-types tools/test_edge_smoke.mjs` onder Node.js v22.16.0. Alle drie Edge Function-modules zijn geladen met een nagebootste Deno-omgeving, zonder netwerk.

Voor kalenderlinkbeheer en AI: ontbrekende JWT afgewezen, onverwachte Origin afgewezen en toegestane preflight geaccepteerd. Voor de feed: ontbrekende token, ongeldige token en ongeldige HTTP-methode afgewezen. Samen 9 controles geslaagd.

Dit test de lokale afwijspaden en parsing; het vervangt geen uitvoering in de echte Supabase Edge Runtime, geen echte JWT-validatie en geen RLS-integratietest.

## Nog te controleren na installatie

De SQL-migratie is opgesteld en statisch beoordeeld maar niet tegen een echte PostgreSQL/Supabase-database uitgevoerd. De livecontrole van RLS met twee verschillende gebruikers, SQL-rechten, Auth-invites, wachtwoordherstel, SMTP, Edge Functions met echte tokens, agenda-abonnementen en optionele AI-provider blijft open. Er is ook geen belastingtest of onafhankelijke beveiligingsaudit uitgevoerd.

Gebruik de acceptatietests in `SECURITY.md` voordat jullie echte sportgegevens opslaan. Controleer aan de hand van `INSTALLATIE.md` ook de projectkeuze, redirects en publieke/geheime sleutels.
