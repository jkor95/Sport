# Sport-app v6 installeren / bijwerken

## Als v3 al werkt

Je bestaande Supabase-project, accounts en sportgegevens kunnen blijven staan. Voor v5 is geen nieuwe SQL nodig.

1. Maak voor de zekerheid een kopie van je huidige GitHub-repository of download de huidige bestanden.
2. Vervang daarna de appbestanden in GitHub door alle bestanden uit deze v5-map. Laat de mappenstructuur intact.
3. Controleer dat `index.html` direct in de hoofdmap van de repository staat.
4. GitHub Pages blijft dezelfde `main` / `root` publicatie gebruiken.
5. Herlaad de site. De nieuwe Service Worker gebruikt cacheversie v5.
6. Open Instellingen en sla je doel opnieuw op. Daarmee wordt het nieuwe doelgerichte schema opgebouwd.

De eerder uitgevoerde migraties blijven geldig:

```text
supabase/migrations/202610060001_sportkompas.sql
supabase/migrations/202610060002_auth_only.sql
```

Voer ze niet opnieuw uit als je bestaande v3-app al goed werkt; ze zijn alleen aanwezig voor een nieuwe installatie.

## Marathonvoorbeeld

Als je op 6 oktober 2026 een marathon op 31 december 2026 instelt, kijkt de planner naar je echte huidige weekomvang, recente langste loop en beschikbare hardloopmomenten. De duurloop groeit richting december, bevat periodiek een lichtere week en wordt vlak voor de doeldatum teruggebracht voor taper. De exacte marathonafstand staat als doeldag-event op 31 december.

De app probeert niet koste wat kost een 30+ km-duurloop te bereiken. Bij een lage basis en weinig resterende weken wordt de piek begrensd en verschijnt een waarschuwing dat het doel mogelijk te ambitieus is voor de ingevoerde uitgangssituatie.

## PDF voor fysiotherapeut

Ga naar **Voortgang > PDF voor fysio**. Kies:

- kalenderweek
- maand
- kwartaal
- jaar

Trainingsnotities staan standaard uit. Na `Rapport maken` opent het afdrukvenster; kies daar `Opslaan als PDF`. De rapportopmaak wordt in de browser gemaakt en bevat alleen de gekozen trainingsgegevens.

## Echte AI-modus activeren

De gewone planner werkt direct na het uploaden van v5. Voor de AI-modus moet `supabase/functions/ai-plan/index.ts` als Supabase Edge Function worden gepubliceerd.

De functie gebruikt twee Supabase secrets:

```text
OPENAI_API_KEY=<jouw OpenAI API key>
OPENAI_MODEL=<een model dat Structured Outputs in de Responses API ondersteunt>
```

Daarnaast gebruikt de gedeelde HTTP-laag:

```text
APP_ORIGIN=https://JOUW-GITHUBNAAM.github.io
```

Gebruik bij GitHub Pages alleen de origin in `APP_ORIGIN`, dus zonder `/Sport-app/` erachter.

Publiceer daarna minimaal:

```sh
supabase functions deploy ai-plan
```

Wil je ook de vrije AI-vragen onder Coach gebruiken, publiceer dan:

```sh
supabase functions deploy ai-coach
```

Voor de bestaande doorlopende agenda-abonnementslink blijven `calendar-link` en `calendar-feed` nodig.

De OpenAI API-sleutel mag nooit in GitHub staan. `config.js` bevat alleen de publieke Supabase URL en publishable key.

## AI-modus gebruiken

Ga in Sport-app naar **Instellingen** en vink `AI-modus voor de opbouw naar mijn doel` aan. Bij opslaan vraagt de app via Supabase een AI-weekstrategie aan. De AI geeft weekvolume, lange-duurloopdoel en fase terug. Sport-app past daarna eigen grenzen toe voordat trainingen worden aangemaakt.

Onder **Coach** verschijnt bij AI-modus ook `AI-schema opnieuw maken`. Gebruik dat bijvoorbeeld nadat doel, startniveau of omstandigheden betekenisvol zijn veranderd. De gewone registratie-aanpassing (bijvoorbeeld 10 km gepland maar 5 km gelopen) blijft daarnaast direct werken zonder te wachten op AI.

## Nieuwe installatie

Bij een volledig nieuw Supabase-project voer je eerst `202610060001_sportkompas.sql` uit en daarna `202610060002_auth_only.sql`. Maak vervolgens je accounts onder Supabase Authentication. Er is geen `sport_members`-lijst.
