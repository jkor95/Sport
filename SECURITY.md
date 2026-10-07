# Beveiliging MijnLoop v13

- Alleen de Supabase publishable key staat in de frontend.
- Een `service_role`, Strava Client Secret, OpenAI key of wachtwoord hoort nooit in GitHub of `config.js`.
- Persoonlijke sportstate blijft door RLS per Supabase-account gescheiden.
- Trainingsschema's en lokale aanpassingen worden in de browser berekend; er is geen actieve AI-aanroep.
- De optionele Strava-tabel geeft geen rechten aan `anon` of `authenticated`.
- Strava access/refresh tokens worden alleen server-side door de `strava` Edge Function gebruikt.
- De Strava OAuth-callback gebruikt een korte, willekeurige state-token om de koppeling aan het juiste account te binden.
- Geïmporteerde trainingen sturen het lokale schema pas mee nadat de gebruiker inspanning en reden heeft bevestigd.
- `ai-plan` mag standby blijven maar wordt niet door MijnLoop v13 aangeroepen.


## Meldingen
Meldingsvoorkeuren staan in dezelfde persoonlijke state als de rest van het schema. De browser-/iOS-meldingsmachtiging blijft apparaatgebonden. v14 slaat geen push-token op en gebruikt geen externe pushprovider.
