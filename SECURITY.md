# Beveiliging en privacy

## Bedoeld toegangsmodel

Iedere sporter heeft een eigen Supabase Auth-account. Een actieve rij in `sport_members` is aanvullend vereist. De frontend filtert op gebruiker, maar dat is niet de veiligheidsgrens: RLS en databaseprivileges bepalen server-side welke rijen bereikbaar zijn.

De client kan alleen zijn eigen ledenrij en eigen sportstaat lezen. Schrijven kan uitsluitend via `sport_save_state`; deze functie gebruikt `auth.uid()` in plaats van een aangeleverde eigenaar. Een verwachte revisie voorkomt stilzwijgend overschrijven van wijzigingen op een ander apparaat. Er zijn geen directe clientrechten om leden, tokens of quota te wijzigen.

Alle `SECURITY DEFINER`-functies gebruiken een lege search_path. De AI-quotafunctie is alleen voor `service_role` uitvoerbaar. De migratie geeft geen anonieme tabeltoegang. Zie de [Supabase RLS-documentatie](https://supabase.com/docs/guides/database/postgres/row-level-security) voor de combinatie van policies en grants.

## Geheimen en sessies

`config.js` bevat uitsluitend de publieke project-URL en publishable/anon key. Service-role- en AI-sleutels blijven uitsluitend in de hosted serveromgeving. De website blokkeert herkenbare service-role/secret keys als frontendconfiguratie, maar zo'n controle maakt een gelekte sleutel niet ongedaan.

De browser bewaart de Auth-sessie in sessionStorage, niet in een gedeelde permanente trainingscache. Trainingsgegevens zijn tijdens gebruik in het geheugen aanwezig. Ze worden niet in localStorage, IndexedDB of de service-worker-cache opgeslagen. Dit is geen bescherming tegen iemand die al toegang heeft tot een ontgrendelde browser of een schadelijke browserextensie. Log op gedeelde computers uit.

De service worker cachet alleen expliciet toegestane statische appbestanden. Verzoeken naar Supabase, AI, agenda-tokens en URL's met queryparameters worden niet gecachet. De productiepagina heeft een beperkte Content Security Policy en escaped variabele UI-tekst. De standalone demo heeft een afwijkend ingebed scriptmodel en mag niet als geconfigureerde productieversie worden gebruikt.

## Agendalinks

Een link bevat 256 willekeurige bits; alleen een SHA-256-hash wordt in de database opgeslagen. De feed bepaalt de eigenaar via die hash, niet via een clientgegeven user_id. Actief lidmaatschap wordt bij elke aanvraag gecontroleerd. Draaien en intrekken zijn alleen beschikbaar na gebruikersverificatie.

Standaard toont de feed slechts 'Sporttraining' met tijd en datum. Uitgebreidere titels zijn een bewuste optie. Vrije notities, klachtredenen, e-mail en ervaren zwaarte worden nooit in de kalendertekst opgenomen. De functie logt geen tokens. Hosting-/netwerklogboeken kunnen op infrastructuurniveau toch URL's vastleggen; beschouw de link als een geheim.

Intrekken verwijdert geen al ontvangen data bij agenda-aanbieders. De gebruiker moet daar eventueel het abonnement en bestaande kopieen verwijderen.

## AI

De AI-functie valideert de gebruikers-JWT bij Supabase Auth, controleert lidmaatschap en vraagt expliciete toestemming. CORS is aanvullend, geen vervanging van authenticatie. Er is een beperkte bodygrootte en een server-side daglimiet. De functie minimaliseert context en gebruikt geen tools die het schema veranderen.

Taalmodeluitvoer is gewone tekst en wordt niet als HTML uitgevoerd. Een gebruikersvraag kan wel persoonlijke informatie bevatten; de interface waarschuwt hiervoor. Een API-aanroep kan kosten veroorzaken. De quotacontrole beperkt het aantal verzoeken, maar vervangt geen providerbudget en is geen volledige DDoS-bescherming.

## Grenzen

Dit ontwerp is niet end-to-end versleuteld: de projectbeheerder en de hostingdienst hebben hun gebruikelijke technische toegang. De twee gewone appgebruikers krijgen geen inzage in elkaars data. Er is geen ingebouwde tweefactoraanmelding, apparaatbeheer of formele onafhankelijke security-audit. Beheerderaccounts van GitHub, Supabase en een eventuele AI-provider verdienen extra beveiliging en minimale toegangsrechten.

Gezondheids-/sportdata blijft privacygevoelig. Gebruik geen openbare exports, laat een collega een eigen wachtwoord kiezen en maak geen onnodige beheerderaccounts aan. Een afzonderlijk Supabase-project beperkt verwarring en onbedoelde koppeling met JK Works.

## Verplichte live acceptatietests

Deze controles zijn nog niet in een echte Supabase-omgeving uitgevoerd. Gebruik bij voorkeur eerst twee aparte testaccounts A en B en testdata. Geef een tester geen service-role key: die sleutel omzeilt juist de reguliere RLS-controle.

1. A en B zijn actieve leden, hebben verschillende doelen en eigen ingevulde schema's. Met het access token van A moet `GET /rest/v1/sport_states?select=*` alleen A opleveren. Expliciet filteren op B's user_id moet geen B-rij opleveren. Herhaal andersom. De eigen profielgegevens blijven na herladen intact.
2. Directe POST/PATCH/DELETE op `sport_states` als A moet geweigerd worden. `sport_save_state` accepteert geen eigenaarparameter en mag uitsluitend A's staat wijzigen. Een tweede opslag met dezelfde oude revisie moet `SPORT_CONFLICT` geven; B moet ongewijzigd blijven.
3. Zonder gebruikers-JWT mogen `sport_states`, `sport_members` en de schrijf-RPC niet bruikbaar zijn. Een ingelogd maar niet toegelaten account C mag geen eigen staat opslaan of lezen en geen agendalink maken.
4. A mag geen leden activeren, tokens uit de tabel lezen of de AI-quotafunctie rechtstreeks uitvoeren. Controleer niet alleen verborgen knoppen, maar ook HTTP-verzoeken naar de database-API.
5. `calendar-link` en `ai-coach` moeten een ontbrekende/vervalste JWT afwijzen. Een browseraanroep vanaf een andere Origin moet eveneens geweigerd worden. Een correct aangemelde A kan alleen A's link maken/intrekken.
6. Een ongeldige feedtoken geeft 404. Een geldige feed bevat uitsluitend de gekozen agenda-informatie. Na intrekken, vervangen of deactiveren van het lid geeft de oude link 404; de andere gebruiker blijft werken.
7. Test de SMTP-uitnodiging en wachtwoordreset, de exact toegelaten redirect en expliciet uitloggen. Controleer dat de gedeelde computer na uitloggen geen echte sportgegevens meer toont. Herhaal aanmelding op een tweede apparaat.
8. Controleer in browseropslag/cache en repository dat geen trainingskopie, persoonlijk exportbestand, service key of AI-sleutel is opgenomen. Gebruik voor AI bewust toestemming; verzoeken zonder toestemming en boven de quota moeten worden geweigerd.

Gebruik `supabase/tests/controle.sql` als aanvullende inspectie, niet als vervanging van deze accounttests. Publiceer pas na beoordeling van gevonden afwijkingen.
