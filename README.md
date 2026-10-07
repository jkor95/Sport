# MijnLoop v19

MijnLoop is een hardloopgerichte webapp voor persoonlijke trainingsplanning, voortgang en optionele Strava/Garmin-import. De planner werkt lokaal met adaptieve modellen van **4 t/m 52 weken** en gebruikt geen actieve AI.

## Wat zit er in

- Doelen: fit blijven, 5 km, 10 km, halve marathon en marathon.
- Plannen op doeldatum of een vaste periode van 4 t/m 52 weken.
- Tempo als `mm:ss/km`, bijvoorbeeld `6:30`.
- Per hardloopdag: korte/rustige loop, lange afstand of interval.
- Concrete intervalopdrachten in de agenda.
- Adaptieve lokale bijsturing na goede, zware of ingekorte trainingen.
- Geen automatische inhaalschuld voor gemiste kilometers.
- Pijn/ziekte pauzeert de planning.
- Marathontrainingsloop maximaal 32 km; 42,2 km alleen op de doeldag.
- Doeldatumgestuurde lange-duurloopopbouw met piek voor de taper.
- Verplaatste doeldatums geven oude dagen weer vrij voor normale trainingen.
- Vaste sportmomenten gebruiken alleen **dag + begintijd**; MijnLoop berekent de trainingsduur zelf.
- PR-overzicht voor 1 km, 5 km, 10 km, halve marathon en marathon.
- Langste loop en snelste gemiddelde tempo.
- Optionele Strava-import voor afstand, tijd, tempo, hoogte, apparaat en waar beschikbaar hartslag/cadans en best efforts.
- Garmin praktisch via **Garmin Connect -> Strava -> MijnLoop**.
- Meldingen/badges voor aankomende trainingen en trainingen die nog moeten worden ingevuld.
- Agenda-abonnement, JSON-export en fysio-PDF.

## Update naar v19

V19 bouwt voort op de opgeschoonde v18-release. De wedstrijddag-taper is nu dag-nauwkeurig: in de laatste 7 dagen blijft maximaal één korte rustige loop over, de laatste 2 dagen vóór het doel zijn loopvrij en ook de eerste 2 dagen na het doel blijven vrij van hardlopen. De Agenda heeft daarnaast een knop **Opnieuw beoordelen**. Gele informatiebalken met plannerwaarschuwingen zijn uit Coach verwijderd.

1. Vervang de bestanden in je GitHub Pages-repository door de inhoud van deze map.
2. **Behoud je bestaande `config.js`** als daar al jouw Supabase URL en publishable key in staan. Je kunt ook de meegeleverde versie vergelijken en alleen jouw waarden terugzetten.
3. Publiceer GitHub Pages.
4. Sluit een geïnstalleerde MijnLoop-webapp volledig af en open hem opnieuw, of doe een harde refresh in de browser.
5. Sla je instellingen één keer opnieuw op als je wilt dat alle toekomstige trainingen opnieuw met de actuele planner worden opgebouwd.

Voor deze update is **geen nieuwe Supabase-wijziging nodig**.

## Bestandsstructuur

De release is bewust compact gehouden:

```text
MijnLoop-v19/
├─ index.html
├─ app.js
├─ config.js
├─ db.js
├─ demo.js
├─ styles.css
├─ sw.js
├─ manifest.webmanifest
├─ assets/
│  ├─ icon-192.png
│  └─ icon-512.png
├─ core/
│  ├─ dates.js
│  ├─ planner.js
│  └─ calendar.js
├─ supabase/
│  ├─ config.toml
│  ├─ functions/
│  └─ migrations/
├─ standby-ai/
│  └─ ai-plan-standalone-index.ts
├─ .nojekyll
├─ .gitignore
└─ README.md
```

`demo.js` hoort bij de live app en blijft daarom staan. De oude losse demo-pagina, versie-updatebestanden en aparte installatie/security/test-documenten zijn verwijderd.

## Belangrijk: Supabase

De gewone MijnLoop-app blijft je bestaande Supabase-project gebruiken voor inloggen en persoonlijke opslag. Voor v19 hoef je niets nieuws aan de database te veranderen.

Veiligheidsregels:

- Alleen je **Supabase publishable key** mag in `config.js` staan.
- Zet nooit een `service_role`, Strava Client Secret, OpenAI-key of wachtwoord in GitHub.
- Persoonlijke data blijft per Supabase-account gescheiden via RLS.
- De trainingsplanner draait lokaal in `core/planner.js` en doet geen actieve AI-aanroep.

## Strava / Garmin automatisch importeren (optioneel)

Zonder Strava werkt MijnLoop volledig. Wil je automatische trainingsdata importeren, dan is eenmalig onderstaande setup nodig.

### 1. SQL uitvoeren

Open **Supabase > SQL Editor** en voer uit:

```text
supabase/migrations/202610060003_strava.sql
```

Dit maakt de server-side tabel voor Strava OAuth-tokens.

### 2. Strava API-app maken

Maak in Strava een API application via de Strava API-instellingen.

Gebruik als **Authorization Callback Domain** je Supabase-domein, bijvoorbeeld:

```text
gcxnxfwmgcrhfgjlqbnn.supabase.co
```

De callback van MijnLoop is:

```text
https://gcxnxfwmgcrhfgjlqbnn.supabase.co/functions/v1/strava/callback
```

Bewaar je Client ID en Client Secret. De Client Secret mag nooit in GitHub of `config.js`.

### 3. Supabase secrets toevoegen

Onder **Edge Functions > Secrets**:

```text
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
```

De bestaande `APP_ORIGIN` blijft gebruikt worden.

### 4. Edge Function deployen

Deploy de functie met exacte naam:

```text
strava
```

Bronbestand:

```text
supabase/functions/strava/index.ts
```

Voor deze functie moet **Verify JWT uit** staan, omdat Strava de OAuth-callback zonder Supabase-gebruikers-JWT aanroept. De functie valideert browseracties zelf en gebruikt een tijdelijke OAuth-state voor de callback.

### 5. Koppelen in MijnLoop

Ga naar **Instellingen > Strava / Garmin import** en kies **Strava koppelen**.

Daarna controleert MijnLoop bij openen/inloggen en synchroniseren op nieuwe hardloopactiviteiten, maximaal ongeveer eens per 15 minuten. Geïmporteerde trainingen kunnen afstand, tijd, tempo, hoogte, apparaat, best efforts en waar beschikbaar hartslag/cadans bevatten.

Garmin-gebruiker: koppel **Garmin Connect aan Strava**. Nieuwe Garmin-activiteiten kunnen dan in Strava verschijnen en worden vervolgens door MijnLoop geïmporteerd. MijnLoop onderhoudt bewust geen tweede directe Garmin API-koppeling.

## Meldingen en badges

Onder **Instellingen > Meldingen & badges** kun je afzonderlijk instellen:

- aankomende sportactiviteit;
- training voorbij maar nog niet ingevuld;
- systeemmeldingen;
- badge op het app-icoon.

Deze versie gebruikt hiervoor geen extra Supabase-tabellen of pushprovider. De teller/badge wordt bijgewerkt wanneer MijnLoop geopend, actief of gesynchroniseerd wordt. Voor meldingen op iPhone/iPad moet MijnLoop als webapp op het beginscherm staan en moet je meldingen toestaan.

## AI standby

MijnLoop v19 gebruikt **geen AI** in de app. Voor eventueel later gebruik blijft alleen dit bronbestand bewaard:

```text
standby-ai/ai-plan-standalone-index.ts
```

De huidige frontend roept deze functie nergens aan. Bestaande `ai-plan`-secrets of Edge Function in Supabase mogen blijven staan, maar zijn niet nodig voor MijnLoop v19.

## Belangrijke plannerregels

- Bij `Gebruik doeldatum` bepaalt de resterende tijd tot de doeldatum het model.
- De lange duurloop wordt opgebouwd richting een piek **voor** de taper.
- Marathon: maximaal 32 km als trainingsloop.
- Als de tijd te kort is om een normale piek verantwoord te halen, forceert MijnLoop geen extreme sprong.
- Een door de doeldag tijdelijk weggehaalde normale training mag terugkomen zodra het doel wordt verplaatst.
- Een training die je zelf bewust verwijdert blijft verwijderd.
- De duur van hardlooptrainingen wordt berekend uit afstand, tempo en trainingstype; er is geen verborgen eindtijdlimiet.
- In de laatste 7 dagen vóór een doeldatum blijft maximaal één korte rustige loop over.
- De laatste 2 dagen vóór de doeldatum en de eerste 2 dagen erna worden geen hardlooptrainingen ingepland.
- Agenda bevat een directe knop **Opnieuw beoordelen** om het schema opnieuw lokaal op te bouwen.

## Controle / onderhoud

V19 is opnieuw regressiegetest op de bestaande plannerregels plus de nieuwe laatste-week- en rustdagregels rond de doeldatum: **71/71 tests geslaagd**.
