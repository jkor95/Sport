# Sport-app v6

Persoonlijke adaptieve sportagenda voor GitHub Pages + Supabase.

## Wat is nieuw in v5

- **Doeldatumgerichte opbouw.** Het schema rekent terug vanaf een 5 km-, 10 km-, halve-marathon- of marathondoel. Lange duurlopen kunnen nu gedurende meerdere weken doorgroeien; de oude 35%-begrenzing is verwijderd. Er zijn basis-, opbouw-, lichtere, piek- en taperweken.
- **Realistische begrenzing.** Een ambitieuze datum forceert geen enorme sprong vanuit een lage basis. Als de resterende tijd kort is, blijft de berekende piek lager en toont de app een waarschuwing.
- **Doeldag in de agenda.** Als de doeldatum binnen maximaal 26 weken valt, wordt de horizon automatisch lang genoeg gemaakt om die datum mee te nemen. Op de exacte datum verschijnt een doeldag-event.
- **Echte AI-modus.** OpenAI kan via de Supabase Edge Function `ai-plan` een weekstrategie voorstellen. Die strategie wordt daarna in Sport-app begrensd op startniveau, beschikbare tijd, grote sprongen en taper. De AI schrijft niet rechtstreeks naar de database.
- **PDF voor fysio.** In Voortgang staat een knop `PDF voor fysio`. Kies week, maand, kwartaal of jaar. Het rapport bevat geregistreerde activiteiten, duur, hardloopafstand, RPE en gepland versus werkelijk. Trainingsnotities zijn optioneel. Het rapport wordt lokaal opgebouwd en via het browser-afdrukvenster als PDF opgeslagen.
- **Bestaande accounts en gegevens blijven werken.** De databasevorm is niet gewijzigd; v5 gebruikt dezelfde `sport_states`-opslag en Supabase Authentication als v3.

## Jouw Supabase-koppeling

`config.js` bevat al:

- Project URL: `https://gcxnxfwmgcrhfgjlqbnn.supabase.co`
- Publishable key: de eerder opgegeven publieke key

Er staat geen `service_role`, databasewachtwoord of OpenAI API-sleutel in GitHub.

## Upgraden vanaf v3

Vervang in GitHub de v3-bestanden door de inhoud van deze map. Er is **geen extra SQL-migratie nodig** voor v5 als `202610060001_sportkompas.sql` en `202610060002_auth_only.sql` al zijn uitgevoerd.

De Service Worker-cache heet nu `sport-app-shell-v5`, zodat oude appbestanden na herladen worden vervangen.

## AI activeren

De gewone doelgerichte planner en PDF-export werken zonder OpenAI. Alleen de schakelaar **AI-modus** heeft een server-side OpenAI-configuratie nodig.

Benodigd in Supabase Edge Functions:

- deploy `ai-plan`
- voor de vraagfunctie ook deploy `ai-coach`
- secret `OPENAI_API_KEY`
- secret `OPENAI_MODEL`
- secret `APP_ORIGIN` met exact de HTTPS-oorsprong van je GitHub Pages-site, bijvoorbeeld `https://gebruikersnaam.github.io`

De OpenAI-sleutel hoort uitsluitend in Supabase Secrets en nooit in `config.js` of GitHub.

## Veiligheidsmodel

Ieder account gebruikt Supabase Authentication. `sport_states.user_id` is gekoppeld aan `auth.uid()` via RLS. De app gebruikt geen aparte `sport_members`-toelatingslijst. AI ontvangt geen naam, e-mail of vrije trainingsnotities voor het maken van een schema; alleen doel, startniveau, vaste hardloopruimte en een beperkte numerieke trainingssamenvatting.

Sport-app is trainingssoftware, geen medische beoordeling. Bij pijn of ziekte pauzeert de bestaande planner toekomstige trainingen. Een marathonplan of AI-strategie garandeert niet dat een wedstrijd haalbaar of veilig is.

## Tests

Run lokaal:

```sh
npm test
node --experimental-transform-types tools/test_edge_smoke.mjs
```

Bij oplevering van v5: 37 planner-/kalendertests geslaagd en 12 gesimuleerde Edge Function toegangscontroles geslaagd.

## Nieuw in v5: exacte opbouw tot doeldatum

Met een ingevulde doeldatum is die datum leidend. De keuzelijst voor vooruit plannen wordt dan genegeerd.

- 8 weken resterend = 8 weekblokken tot de doeldag.
- 11 weken resterend = 11 weekblokken tot de doeldag.
- De planner verdeelt deze periode over opbouw, eventuele herstelweek, piek en taper.
- De AI krijgt exact hetzelfde aantal resterende weken door als de browserplanner.
- Voor een marathon probeert de planner bij voldoende basis richting een piekduurloop van ongeveer 28-32 km (hard maximum 32 km voor een geplande trainingsloop) te bouwen.
- Als de huidige basis en resterende tijd dat niet realistisch toelaten, blijft de piek lager en verschijnt een waarschuwing. De app maakt dan geen kunstmatige sprong naar 42,2 km in de trainingen; 42,2 km blijft alleen de ingestelde doeldag.
