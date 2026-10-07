# MijnLoop v26 — centrale synchronisatie met eigen login

MijnLoop gebruikt nog steeds zijn eigen eenvoudige gebruikersnaam/wachtwoord-login en de losse `admin.html` beheerpagina. Supabase Auth wordt **niet** gebruikt.

## Wat is veranderd

- Accounts worden centraal in Supabase opgeslagen.
- Sportprofiel, planning, resultaten, Coach-historie en instellingen synchroniseren per account.
- Desktop en mobiel zien na inloggen dezelfde gegevens.
- `admin.html` beheert dezelfde centrale accountlijst op ieder apparaat.
- De beheerder kan wachtwoorden blijven inzien en wijzigen, zoals gevraagd.
- Strava/Garmin blijft uitgeschakeld.

## Eerste update vanaf v25

Open na het plaatsen van v26 eerst MijnLoop op het apparaat waarop je huidige lokale accounts staan. Wanneer de centrale database nog leeg is, zet v26 die lokale accounts en hun sportdata automatisch één keer over naar Supabase. Daarna kun je op je telefoon dezelfde gebruikersnaam en hetzelfde wachtwoord gebruiken.

Als er nog helemaal geen lokale accounts waren, open dan `admin.html` om de eerste centrale beheerder aan te maken.

## Beheerpagina

Voor jouw GitHub Pages-site:

- App: `https://jkor95.github.io/Sport/`
- Beheer: `https://jkor95.github.io/Sport/admin.html`

## Techniek

De frontend gebruikt alleen de publieke Supabase publishable key. Alle account- en sportdata loopt via de Edge Function `mijnloop-sync`. De tabellen hebben RLS ingeschakeld en zijn niet rechtstreeks toegankelijk voor `anon` of `authenticated`. De service-role sleutel staat uitsluitend server-side in Supabase.

De eigen MijnLoop-sessies worden als willekeurige tokens uitgegeven en server-side alleen gehasht opgeslagen.

## Belangrijk over wachtwoorden

Omdat je als beheerder wachtwoorden wilt kunnen inzien, bewaart de centrale MijnLoop-accounttabel het gekozen wachtwoord leesbaar. Dat is bewust minder veilig dan standaard wachtwoordopslag. Gebruik voor MijnLoop daarom geen wachtwoord dat je ook voor e-mail, bankzaken of andere belangrijke accounts gebruikt.
