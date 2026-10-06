# SportKompas installeren

Versie 1.0 - 6 oktober 2026

## 0. Eerst de demo bekijken

Open `DEMO.html` en klik op **Bekijk de interactieve demo**. De demo is volledig los van Supabase en gebruikt fictieve gegevens. Vul geen echte wachtwoorden in het demoformulier in. Voor echt gebruik open je na publicatie de website via HTTPS, niet het gedownloade HTML-bestand.

Gebruik een **nieuwe GitHub-repository en bij voorkeur een apart Supabase-project**. Vervang geen bestanden, sleutels of tabellen van JK Works. Controleer zelf beschikbare projectruimte en eventuele kosten in je accounts. Er is geen betaald AI-abonnement nodig voor de regelgestuurde planner; de optionele AI-functie heeft wel een eigen API-configuratie en verbruik.

## 1. Nieuwe GitHub-repository

Maak in je eigen GitHub-account een repository, bijvoorbeeld `sportkompas`. Upload de inhoud van deze map naar de hoofdmap, dus `index.html` staat direct op het hoogste niveau. Plaats niet de hele map als extra geneste map in de repository. Vergeet de map `supabase`, de map `assets` en het bestand `.nojekyll` niet.

Ga in de repository naar **Settings > Pages**. Kies **Deploy from a branch**, vervolgens **main** en **/(root)**. Gebruik de uiteindelijke HTTPS-URL die GitHub toont. Een projectsite ziet er doorgaans zo uit:

```text
https://JOUW-GITHUBNAAM.github.io/sportkompas/
```

De broncode, vormgeving en publieke Supabase-sleutel mogen zichtbaar zijn. Geheime sleutels, wachtwoorden, exports met echte gegevens en agenda-abonnementslinks mogen nooit in de repository komen. Een publieke website is niet hetzelfde als een publieke database: persoonlijke data wordt achter Supabase Auth en RLS opgeslagen.

Bron: [GitHub Pages-publicatie instellen](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## 2. Nieuw Supabase-project en tabellen

Maak een nieuw Supabase-project aan. Bewaar het databasewachtwoord in je eigen wachtwoordmanager. Open in het juiste project de **SQL Editor**. Kopieer de volledige inhoud van:

```text
supabase/migrations/202610060001_sportkompas.sql
```

Voer dit eenmalig uit. Controleer de melding op fouten. De migratie maakt vier `sport_`-tabellen, RLS-regels en twee databasefuncties. Het bestand verwijdert geen bestaande tabellen.

Je kunt ter inspectie ook `supabase/tests/controle.sql` uitvoeren. Dat laat de ingestelde privileges en beleidsregels zien, maar bewijst niet dat alle echte accountstromen werken. De acceptatietests staan verderop.

## 3. Publieke configuratie - al ingevuld

Deze versie is al gekoppeld aan jouw Supabase-project. De volgende twee publieke waarden staan al in `config.js`, dus je hoeft ze niet opnieuw in GitHub in te vullen:

```js
globalThis.SPORT_CONFIG = {
  supabaseUrl: 'https://gcxnxfwmgcrhfgjlqbnn.supabase.co',
  supabasePublishableKey: 'sb_publishable_ANR7qJwKme0Nx14831sVFQ_DTBj9FdJ',
  appName: 'SportKompas',
  enableAI: false,
  sdkUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js'
};
```

**Gebruik hier nooit `service_role`, `sb_secret_...`, een databasewachtwoord of een OpenAI API-sleutel.** Een verkeerde geheime sleutel die al gepubliceerd is, moet direct bij de provider worden ingetrokken en vernieuwd; alleen het bestand verwijderen is onvoldoende.

Upload `config.js` gewoon samen met de rest van de bestanden naar GitHub. Supabase-sleutels voor JK Works zijn niet nodig. Laat `enableAI` voorlopig op `false` staan.

## 4. Twee persoonlijke accounts

### Authenticatie en URL's

Open **Authentication** in Supabase. Laat aanmelden met e-mailadres en wachtwoord aanstaan en laat anoniem aanmelden uit. SportKompas gebruikt vanaf versie 3 alleen Supabase Authentication: er is geen aparte leden- of toelatingslijst meer.

Stel bij **URL Configuration** zowel de **Site URL** als een toegestane **Redirect URL** in op exact je nieuwe websiteadres, inclusief de repositorynaam en de afsluitende slash. Bijvoorbeeld:

```text
https://JOUW-GITHUBNAAM.github.io/SportKompas/
```

Maak daarna onder **Authentication > Users** voor jezelf en je collega ieder een eigen account, of laat registratie aan als je dat bewust wilt. Ieder geldig Supabase Auth-account kan SportKompas gebruiken, maar RLS zorgt ervoor dat ieder alleen de eigen sportgegevens kan lezen.

De collega kan **Marathon** kiezen. Jij kunt bijvoorbeeld **Fit blijven** of **10 km** kiezen; er wordt geen marathondoel aan jouw account gekoppeld.

Als je eerder versie 2 hebt geinstalleerd, voer eerst eenmalig `supabase/migrations/202610060002_auth_only.sql` uit in de Supabase SQL Editor.

## 5. Doorlopende agendakoppeling activeren

Een losse ICS-download werkt zonder Edge Functions. Voor een **abonnement dat latere schemawijzigingen volgt** zijn twee serverfuncties nodig. De broncode staat al in deze map.

### Publiceren via de Supabase CLI

Installeer de Supabase CLI via de officiele handleiding en open een terminal in de map met `supabase/config.toml`. Meld je aan en koppel **het nieuwe SportKompas-project**, niet JK Works:

```sh
supabase login
supabase link --project-ref JOUW-NIEUWE-PROJECTREF
supabase functions deploy calendar-feed
supabase functions deploy calendar-link
```

De SQL-migratie is in stap 2 al uitgevoerd; voer niet blind nogmaals andere migraties of projectresets uit. `supabase db reset` is niet nodig.

Voeg via **Edge Functions > Secrets** deze niet-geheime maar vereiste serverinstelling toe:

```text
APP_ORIGIN=https://JOUW-GITHUBNAAM.github.io
```

Let op: dit is alleen de **origin**, dus zonder `/sportkompas/` en zonder afsluitende slash. De Auth-redirect uit stap 4 bevat die repositorymap juist wel. Bij een eigen domein gebruik je in `APP_ORIGIN` precies de origin van dat domein.

De platformvariabelen `SUPABASE_URL`, `SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` worden in de hosted Edge Functions door Supabase aangeboden. Kopieer die niet naar de browser of naar GitHub.

In `supabase/config.toml` staat `verify_jwt = false`. Dat is hier bewust: de openbare feed gebruikt een geheime toegangstoken; de andere functies valideren de gebruikers-JWT zelf via Supabase Auth. De authenticatiecode in `_shared/http.ts` mag niet worden verwijderd. Een verzoek zonder geldige gebruikerssessie mag geen link kunnen aanmaken.

Bronnen: [Edge Functions publiceren](https://supabase.com/docs/guides/functions/deploy), [servervariabelen en secrets](https://supabase.com/docs/guides/functions/secrets), [Edge Functions beveiligen](https://supabase.com/docs/guides/functions/auth).

### Abonneren vanuit de app

Log in, maak je eigen schema en open **Agenda delen**. Laat de privacyoptie aanstaan voor alleen de titel **Sporttraining** en de tijden. Maak een prive-abonnementslink aan en kopieer deze. Behandel hem als een wachtwoord: iedereen met de link kan de beperkte agenda lezen. De database bewaart alleen een hash van de toegangstoken.

Gebruik in je agenda-app **abonnement via URL**, niet **bestand importeren**. Bij Apple Agenda heet dit een agenda-abonnement; bij Google Agenda is dit op de website doorgaans **Andere agenda's > + > Via URL**; bij Outlook **Agenda toevoegen > Abonneren via internet**. Benamingen kunnen per versie verschillen. Koppel bij voorkeur aan een afzonderlijke sportagenda, zodat je die gemakkelijk kunt verbergen of verwijderen.

Het abonnement loopt **van SportKompas naar je agenda**. Wijzigingen in de externe agenda komen niet terug. Je bestaande afspraken worden niet uitgelezen en blokkeren dus niet automatisch nieuwe sportmomenten. Geef zulke beperkingen zelf aan in de app.

Verversing wordt door je agenda-aanbieder bepaald en is niet onmiddellijk gegarandeerd. Microsoft vermeldt dat updates bij internetagenda's langer dan 24 uur kunnen duren. Voor een wijziging die vandaag telt, is SportKompas zelf de actuele bron.

De knop voor een nieuwe link **vervangt** de bestaande link. Bestaande abonnementen moeten dan opnieuw gekoppeld worden. **Intrekken** blokkeert verdere aanvragen, maar verwijdert geen kopieen of al opgeslagen afspraken uit de externe agenda. Verwijder daar zo nodig ook het oude abonnement.

Bronnen: [Apple agenda-abonnementen](https://support.apple.com/en-afri/102301), [Outlook importeren versus abonneren](https://support.microsoft.com/en-US/Outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web).

## 6. Optionele AI-uitleg

De gewone planner werkt al zonder deze stap. De AI-functie voegt een vraag-en-antwoordcoach toe, niet een zelfstandig medisch of sportkundig beslissysteem.

Maak in je eigen OpenAI API-omgeving een sleutel aan, kies een model dat de Responses API en de gebruikte parameters ondersteunt, en stel budgetwaarschuwingen/verbruiksbeheer in. Plaats via **Supabase Edge Functions > Secrets**:

```text
OPENAI_API_KEY=JE-GEHEIME-API-SLEUTEL
OPENAI_MODEL=JE-GEKOZEN-MODEL-ID
```

Deze waarden mogen nooit in `config.js`, GitHub of een gedeeld bericht staan. Publiceer vervolgens:

```sh
supabase functions deploy ai-coach
```

Zet pas daarna in `config.js` **enableAI: true**. Test met een onschuldige voorbeeldvraag. De server controleert de ingelogde Supabase-gebruiker, toestemming per verzoek en maximaal 10 vragen per UTC-dag met minimaal 10 seconden ertussen.

Een vraag verstuurt een beperkte samenvatting: doel, ingevulde loopbasis, gepauzeerd ja/nee, maximaal 10 recente trainingen en 6 komende trainingen. Namen, e-mailadressen, vrije notities en klachtredenen worden niet automatisch meegestuurd. Wat iemand zelf in de vraag zet, wordt wel verstuurd. Schrijf daarom geen onnodige persoonlijke of medische details in de vraag.

De API-aanroep gebruikt `store: false`. Dat betekent niet dat bij de provider onder alle omstandigheden geen bewaartermijn bestaat. Raadpleeg de gegevensvoorwaarden van je API-project. Het antwoord wordt niet als chatgeschiedenis in de sportdatabase opgeslagen. De AI kan geen schemawijzigingen uitvoeren en kan fouten maken.

Bronnen: [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses), [OpenAI gegevensbeheer](https://platform.openai.com/docs/guides/your-data).

## 7. Controle voordat jullie echte gegevens gebruiken

Voer de controles in `SECURITY.md` en `TESTVERSLAG.md` uit. Minimaal: inloggen met twee verschillende accounts in twee browsers, andere doelen instellen, apart opslaan, herladen op een tweede apparaat, uitloggen, wachtwoordherstel, een ongeldige agendalink testen en een bestaande link intrekken. Controleer RLS ook via de database-API, niet alleen door naar de schermen te kijken.

Installeer de PWA pas daarna via de functie **Zet op beginscherm / App installeren** van je browser. Echte accountgegevens vereisen internet. Na een software-update: heropen of vernieuw de app. Bij een probleem met oude statische bestanden kan de sitecache verwijderd worden; de cloudgegevens worden daardoor niet gewist.

## Problemen oplossen

| Melding / situatie | Controle |
| --- | --- |
| Alleen de demo werkt | Controleer beide publieke waarden in `config.js` en open de HTTPS-site. |
| Tabellen niet beschikbaar | Is de volledige SQL-migratie in het juiste project uitgevoerd? |
| Uitnodiging/reset komt niet | Controleer SMTP, afzenderinstellingen, spam, rate limits en Auth-redirect. |
| Serverfunctie niet ingesteld | Zijn beide agenda-Edge Functions gepubliceerd en staat `APP_ORIGIN` exact goed? |
| Agenda werkt niet direct bij | Controleer of het een abonnement is; de externe aanbieder beheert de verversing. |
| Conflict met ander apparaat | De nieuwste versie wordt geladen. Controleer de invoer en sla die opnieuw op; niets blind overschrijven. |
| AI geeft configuratiefout | Controleer serversecrets, modelondersteuning en API-budget. De gewone planner is hiervan onafhankelijk. |
| Browser blijft oud ontwerp tonen | Vernieuw de site of wis uitsluitend de statische sitecache en log opnieuw in. |

## Eigen gegevens en beheer

Exporteer desgewenst je eigen JSON-bestand via de instellingen en bewaar dat prive. Er is nog geen import/herstelknop. Deel geen exports met je collega tenzij dat bewust de bedoeling is. Bij het verwijderen van een Auth-gebruiker worden de gekoppelde sportrecords en tokens via foreign keys verwijderd; reeds gedownloade exports en externe agenda-kopieen verdwijnen daarmee niet.

## Versie 3: alleen Supabase Authentication

Er is geen aparte `sport_members`-toelatingslijst meer. Ieder geldig persoonlijk account in **Supabase Authentication → Users** kan SportKompas gebruiken. RLS houdt de gegevens per `auth.uid()` gescheiden.

Als versie 2 al in jouw Supabase-project is geinstalleerd, voer dan eenmalig `supabase/migrations/202610060002_auth_only.sql` uit in de SQL Editor. Daarna is de oude `sport_members`-tabel verwijderd en niet meer nodig.
