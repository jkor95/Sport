# SportKompas

**Een persoonlijke sportagenda die meebeweegt met wat je werkelijk doet.**

Versie 1.0 - 6 oktober 2026. Een aparte app voor GitHub Pages en Supabase, zonder wijzigingen aan JK Works.

## Deze versie is al gekoppeld aan jouw Supabase-project

`config.js` bevat al de publieke project-URL `https://gcxnxfwmgcrhfgjlqbnn.supabase.co` en jouw publishable key. Je hoeft deze twee waarden dus niet meer handmatig in GitHub in te vullen. De service-role key, databasewachtwoorden en andere geheime sleutels zijn niet opgenomen.

## Eerst bekijken

Open `DEMO.html` in een gewone browser en kies **Bekijk de interactieve demo**. Deze versie werkt zonder account, internet of configuratie. Alle gegevens zijn fictief. De demonstratie bevat bewust een training van 10 km die je als 5 km kunt registreren. Aanpassingen verdwijnen wanneer je de demo opnieuw opent.

Voor livegebruik: lees **INSTALLATIE.md**. De broncode is geleverd; een GitHub-repository, Supabase-project en echte accounts zijn niet namens jou aangemaakt of gepubliceerd.

## Wat zit erin?

- **Eigen account, eigen doel.** Fit blijven, 5 km, 10 km, halve marathon of marathon. Geen gedeeld trainingsdossier. De toegang is beperkt tot door de beheerder toegelaten gebruikers.
- **Vaste sportmomenten.** Weekdag, begintijd, tijdsruimte en sport instellen. De automatische aanpassing verplaatst deze momenten niet. Een afzonderlijke training kun je zelf verplaatsen of vastzetten.
- **Registreren wat echt lukte.** Afstand, tijd, ervaren zwaarte van 1-10 en een reden zoals tijdgebrek, vermoeidheid of klachten. De planner past komende trainingen aan; gemiste kilometers worden niet alsnog ergens toegevoegd.
- **Week- en maandagenda, voortgang en uitleg.** Je ziet geplande en werkelijke kilometers en een log van aanpassingen. Andere sporten kunnen als tijdsblokken in de agenda, maar worden niet omgerekend naar hardloopkilometers.
- **Prive-agenda-abonnement.** Een intrekbare geheime URL voor agenda-apps die internetagenda's ondersteunen, plus een losse ICS-export. Een abonnement wordt door de agenda-aanbieder ververst; een bestand is een momentopname.
- **Mobiel en desktop.** Responsive website met PWA-bestanden, geschikt om na publicatie op het beginscherm te plaatsen.

## Wat betekent 'adaptief' hier?

De planner is in deze versie **regelgestuurd**, niet een groot taalmodel dat zelf trainingen voorschrijft. De regels zijn zichtbaar in `core/planner.js` en lokaal getest. Een voorbeeld: 5 van 10 km vanwege tijdgebrek kan de eerstvolgende vergelijkbare loop binnen twee weken tot 6 km beperken. Bij vermoeidheid of herhaaldelijk inkorten wordt de komende belasting breder verminderd. Dit zijn programmeerkeuzes, geen wetenschappelijk gevalideerde grenzen of persoonlijk trainingsadvies.

Bij een registratie van pijn of ziekte wordt de toekomstige sportplanning gepauzeerd, ook als automatisch aanpassen uitstaat. Hervatten gebeurt bewust via de app, niet via een automatisch medisch oordeel.

Een **optionele echte AI-coach** is als Supabase Edge Function meegeleverd. Deze gebruikt na expliciete toestemming een beperkte samenvatting om uitleg te geven. Daarvoor zijn apart een API-sleutel, geschikt model en budget nodig. De AI kan geen trainingen opslaan of wijzigen. Zonder AI blijft de gewone adaptieve planner werken.

## Grenzen van versie 1

Deze versie is geen compleet, gevalideerd marathontrainingsprogramma en beoordeelt niet of een wedstrijd haalbaar is. Het is een indicatieve basisplanning vanuit een zelf opgegeven huidig niveau, met 1-4 hardloopmomenten per week, maximaal 14 vaste sportblokken en een planhorizon van 12 of 24 weken. Voor helemaal beginnende lopers zonder loopbasis is nog geen wandel/loop-startprogramma ingebouwd. Tempotraining, zones, specifieke wedstrijdblokken en tapercoaching op maat ontbreken.

Je voert resultaten zelf in. Garmin, Strava, GPS-tracking en het uitlezen van afspraken uit je prive-agenda zijn niet gekoppeld. Agendasynchronisatie is eenrichtingsverkeer: SportKompas naar je agenda. Verplaatsen in Apple/Google/Outlook past SportKompas niet aan.

Er is een JSON-export voor eigen archivering, maar geen herstel/importknop. Cloudgegevens worden niet offline opgeslagen; offline bewerken is uitgeschakeld om verborgen conflicten en onversleutelde trainingskopieen te voorkomen. De Supabase-projectbeheerder heeft technisch beheerderstoegang; dit is geen end-to-end-versleuteld systeem.

## Bestanden

| Bestand / map | Functie |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | De website en gebruikersinterface |
| `config.js` | Alleen publieke Supabase-projectgegevens |
| `db.js` | Persoonlijke authenticatie, laden en versiegecontroleerd opslaan |
| `core/` | Datumlogica, adaptieve planner en ICS-opbouw |
| `supabase/migrations/` | Tabellen, toegangsregels en beveiligde opslagfunctie |
| `supabase/functions/` | Prive-agendafeed, linkbeheer en optionele AI-uitleg |
| `supabase/tests/controle.sql` | Inspectie van grants en RLS; geen volledige penetratietest |
| `DEMO.html` | Zelfstandig, offline demonstratiebestand |
| `INSTALLATIE.md` | Publicatie, accounts, agenda en optionele AI |
| `SECURITY.md` | Beveiligingsmodel en resterende controles |
| `TESTVERSLAG.md` | Wat lokaal getest is en wat nog live moet |

## Lokaal testen

De website heeft geen bundelstap of npm-afhankelijkheden. Een actuele Node.js-versie vanaf 20 is nodig om de tests te draaien, niet om de website te publiceren.

```sh
npm test
python3 tools/build_preview.py
python3 -m http.server 8000
```

De laatste opdracht start uitsluitend een lokale statische webserver. Zonder eigen Supabase-configuratie werkt alleen de demo. Supabase JS wordt voor echte accounts pas geladen wanneer de app geconfigureerd is. De meegeleverde versie is vastgezet in `config.js`; wijzig die alleen na controle en hertesten.

**Status:** lokale planner- en browsercontroles uitgevoerd. Productie-authenticatie, database-RLS, e-mailbezorging, Edge Functions en refreshgedrag bij agenda-aanbieders moeten na installatie nog end-to-end worden getest.
