# MijnLoop v25 — lokaal accountbeheer met zichtbare wachtwoorden

MijnLoop v25 gebruikt **geen Supabase Auth** meer. De login, accountlijst en sportgegevens worden lokaal in de browser opgeslagen.
### Gebruikersbeheer

Op `admin.html` heeft ieder account nu de acties **Inzien**, **Bewerken**, **Wachtwoord resetten**, **Blokkeren/Activeren** en **Verwijderen**. Inzien toont accountgegevens plus een samenvatting van doel, tempo, vaste sportmomenten en trainingsstatus. Bewerken wijzigt naam, gebruikersnaam, rol en accountstatus zonder trainingsgegevens te wissen.


## Eenvoudige lokale inlog

- Gebruikersnamen mogen kort zijn en hebben geen vaste tekenregel meer. Ook één teken is toegestaan.
- Wachtwoorden mogen eveneens kort zijn; alleen een leeg wachtwoord wordt geweigerd.
- Dit geldt zowel voor gewone accounts als voor het beheerdersaccount.
- Wachtwoorden worden nog steeds gehasht voor de logincontrole, maar v25 bewaart daarnaast bewust een leesbare lokale kopie zodat de beheerder ze kan inzien en wijzigen.


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

### Wachtwoorden inzien en wijzigen

In v25 kan een beheerder via **Inzien** het actuele wachtwoord van een account bekijken en kopiëren. Via **Bewerken** kan het wachtwoord direct worden aangepast. De losse knop **Wachtwoord resetten** blijft ook beschikbaar.

Om dit mogelijk te maken bewaart MijnLoop naast de PBKDF2-hash bewust ook een leesbare lokale kopie van het wachtwoord. Dat is minder veilig dan alleen een hash. Iedereen met volledige toegang tot hetzelfde browserprofiel/ontwikkelaarstools kan lokale gegevens mogelijk uitlezen. Gebruik dit daarom alleen op een vertrouwd apparaat.

Accounts die al vóór v25 bestonden hebben nog geen leesbare kopie. Hun oude hash kan niet worden teruggedraaid. Zodra de gebruiker één keer onder v25 inlogt, of de beheerder het wachtwoord wijzigt/reset, wordt het wachtwoord voortaan zichtbaar.

## Belangrijk: lokaal betekent per browser/apparaat

Accounts en sportgegevens staan in de browser waarin je ze hebt aangemaakt. Een account op je laptop bestaat dus niet automatisch op je telefoon.

Gebruik in `admin.html` **Backup downloaden** om alle lokale accounts + sportgegevens over te zetten naar een ander apparaat. De beheer-backup is zeer gevoelig: hij bevat vanaf v25 ook leesbare wachtwoorden, naast hashes en geheime integratiesleutels. Bewaar hem strikt privé.

## Overstappen vanaf v19 of ouder

Doe dit vóór je de oude GitHub-versie vervangt als je bestaande sportgegevens wilt behouden:

1. Log in op de oude MijnLoop-versie.
2. Ga naar **Voortgang → Mijn gegevens exporteren**.
3. Installeer v25 en maak je lokale account aan via `admin.html`.
4. Log in op MijnLoop v25.
5. Ga naar **Instellingen → Account en privacy → Backup importeren** en selecteer je oude persoonlijke JSON-export.

De oude gegevens blijven anders nog wel in je bestaande Supabase-project staan, maar v25 gebruikt die Supabase-login niet meer automatisch.


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
- `standby-ai/` — niet actief; alleen bewaard voor eventueel later gebruik

AI wordt nergens door de actieve app aangeroepen.


## Lokale login
Gebruikersnamen en wachtwoorden hebben geen minimale lengte. Alleen leeg is niet toegestaan. Speciale tekens zijn niet verplicht. Tijdelijke wachtwoorden bevatten alleen letters en cijfers.

## Standby-integraties

Garmin/Strava is in v25 volledig uit de actieve app gehaald. De oude integratiecode staat alleen in `standby-integrations/strava/` zodat deze later eventueel opnieuw kan worden ingebouwd. Deze bestanden worden niet door MijnLoop geladen of uitgevoerd.
