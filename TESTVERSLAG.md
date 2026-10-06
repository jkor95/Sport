# Testverslag - SportKompas v4

Uitgevoerd op 6 oktober 2026 in een lokale testomgeving.

## Planner en kalender: 37 tests geslaagd

`npm test`: 37 geslaagd, 0 mislukt.

Naast de bestaande adaptieve-plannertests bevat v4 expliciete controles dat:

- een marathondoel op 31 december vanaf begin oktober langere duurlopen richting december opbouwt;
- de laatste weken voor de wedstrijd afbouwen;
- de exacte doeldatum alsnog in de planning valt wanneer een nominale 12-wekenhorizon enkele dagen eerder zou eindigen;
- een AI-weekstrategie invloed kan hebben op het schema, maar niet door de ingestelde groeibegrenzing heen kan breken.

## Edge Functions: 12 gesimuleerde toegangscontroles geslaagd

`node --experimental-transform-types tools/test_edge_smoke.mjs`

Gecontroleerd voor `calendar-link`, `ai-coach` en `ai-plan`: ontbrekende authenticatie wordt geweigerd, onverwachte browser-origin wordt geweigerd en geldige preflight wordt geaccepteerd. `calendar-feed` weigert ontbrekende/ongeldige tokens en een ongeldige HTTP-methode.

Dit is geen live end-to-endtest met jouw Supabase-project of OpenAI-account. De echte AI-aanroep kan pas worden getest nadat de Edge Function en secrets in Supabase zijn ingesteld.

## PDF-functie

De app maakt het fysiotherapierapport client-side als printvriendelijke A4-HTML en opent daarna het browser-afdrukvenster. De gebruiker kiest daar `Opslaan als PDF`. Er wordt voor deze export geen extra externe PDF-dienst aangeroepen.

De inhoud is een trainingsregistratie en geen medisch verslag.
