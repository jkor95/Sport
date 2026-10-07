# MijnLoop v23 — lokale accounts + aparte beheerderspagina

MijnLoop v23 gebruikt **geen Supabase Auth** meer. De login, accountlijst en sportgegevens worden lokaal in de browser opgeslagen.
### Gebruikersbeheer

Op `admin.html` heeft ieder account nu de acties **Inzien**, **Bewerken**, **Wachtwoord resetten**, **Blokkeren/Activeren** en **Verwijderen**. Inzien toont accountgegevens plus een samenvatting van doel, tempo, vaste sportmomenten en trainingsstatus. Bewerken wijzigt naam, gebruikersnaam, rol en accountstatus zonder trainingsgegevens te wissen.


## Eenvoudige lokale inlog

- Gebruikersnamen mogen kort zijn en hebben geen vaste tekenregel meer. Ook één teken is toegestaan.
- Wachtwoorden mogen eveneens kort zijn; alleen een leeg wachtwoord wordt geweigerd.
- Dit geldt zowel voor gewone accounts als voor het beheerdersaccount.
- Wachtwoorden blijven lokaal gehashd opgeslagen; ze worden niet als leesbare tekst bewaard.


## Eerste installatie

1. Plaats alle bestanden uit deze map in je GitHub Pages repository.
2. Open je site met `/admin.html` erachter, bijvoorbeeld:
   `https://jouwnaam.github.io/jouw-repo/admin.html`
3. Omdat er nog geen accounts zijn, vraagt MijnLoop je om de **eerste beheerder** aan te maken.
4. Log daarna in op dezelfde beheerderspagina.
5. Maak één of meer gebruikersaccounts aan.
6. Ga terug naar de gewone MijnLoop-pagina en log in met een lokale gebruikersnaam + wachtwoord.

Er staat **geen standaard beheerwachtwoord** in GitHub.

## Wat de beheerder kan

Op `admin.html` kun je:
- gebruikers aanmaken;
- een gebruiker blokkeren of activeren;
- een gebruiker verwijderen inclusief diens lokale sportdata;
- een wachtwoord resetten naar een nieuw tijdelijk wachtwoord;
- beheerdersaccounts toevoegen;
- een volledige lokale beheer-backup downloaden/importeren.

### Waarom het bestaande wachtwoord niet zichtbaar is

Wachtwoorden worden niet als leesbare tekst opgeslagen. MijnLoop gebruikt PBKDF2-SHA256 met een unieke salt. Daardoor kan ook de beheerder het bestaande wachtwoord niet teruglezen.

Bij **Wachtwoord resetten** toont MijnLoop één keer een nieuw tijdelijk wachtwoord. Dat kun je aan de gebruiker doorgeven. Dit voorkomt dat wachtwoorden als platte tekst in `localStorage` of GitHub terechtkomen.

## Belangrijk: lokaal betekent per browser/apparaat

Accounts en sportgegevens staan in de browser waarin je ze hebt aangemaakt. Een account op je laptop bestaat dus niet automatisch op je telefoon.

Gebruik in `admin.html` **Backup downloaden** om alle lokale accounts + sportgegevens over te zetten naar een ander apparaat. De beheer-backup is gevoelig: hij bevat wachtwoordhashes en de geheime integratiesleutels voor optionele koppelingen. Bewaar hem privé.

## Overstappen vanaf v19 of ouder

Doe dit vóór je de oude GitHub-versie vervangt als je bestaande sportgegevens wilt behouden:

1. Log in op de oude MijnLoop-versie.
2. Ga naar **Voortgang → Mijn gegevens exporteren**.
3. Installeer v23 en maak je lokale account aan via `admin.html`.
4. Log in op MijnLoop v23.
5. Ga naar **Instellingen → Account en privacy → Backup importeren** en selecteer je oude persoonlijke JSON-export.

De oude gegevens blijven anders nog wel in je bestaande Supabase-project staan, maar v23 gebruikt die Supabase-login niet meer automatisch.

## Strava / Garmin

Strava is optioneel. De normale MijnLoop-login blijft volledig lokaal.

Voor automatische Garmin/Strava-import gebruikt v23 een aparte Supabase Edge Function als OAuth-bridge. Die gebruikt **geen Supabase Auth** en kent je MijnLoop-wachtwoord niet.

Eenmalig nodig:
1. Voer `supabase/migrations/202610070001_local_strava.sql` uit in Supabase SQL Editor.
2. Zet in Supabase Secrets:
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `APP_ORIGIN` (exact je GitHub Pages origin)
3. Deploy `supabase/functions/strava/index.ts` als functie met naam `strava`.
4. Voor deze functie staat `verify_jwt = false` in `supabase/config.toml`; de functie gebruikt zijn eigen lokale-accountsecret.
5. Koppel daarna Strava vanuit MijnLoop Instellingen.

Garmin werkt via **Garmin Connect → Strava → MijnLoop**.

## Agenda

Omdat je sportdata volledig lokaal zijn, kan een live online agenda-abonnement niet zelfstandig verversen terwijl MijnLoop gesloten is. Je kunt nog wel een `.ics`-bestand exporteren via **Agenda exporteren**.

## Beveiligingsgrenzen van lokale login

De lokale login is bedoeld als praktische toegangsscheiding op een eigen of vertrouwd apparaat. Iemand die volledige toegang heeft tot jouw browserprofiel of ontwikkelaarstools kan lokale appdata uitlezen. Daarom:
- gebruik geen gedeeld openbaar browserprofiel;
- log uit op gedeelde apparaten;
- zet geen wachtwoorden of secrets in GitHub;
- bewaar beheer-backups privé.

## Bestanden

- `index.html` — gewone MijnLoop-app
- `admin.html` — losse beheerderspagina
- `local-auth.js` — lokale account- en wachtwoordlogica
- `admin.js` — gebruikersbeheer
- `db.js` — lokale opslag van sportgegevens
- `core/` — planner, datumlogica en kalenderexport
- `supabase/` — alleen optionele Strava-bridge
- `standby-ai/` — niet actief; alleen bewaard voor eventueel later gebruik

AI wordt nergens door de actieve app aangeroepen.


## Lokale login
Gebruikersnamen en wachtwoorden hebben geen minimale lengte. Alleen leeg is niet toegestaan. Speciale tekens zijn niet verplicht. Tijdelijke wachtwoorden bevatten alleen letters en cijfers.
