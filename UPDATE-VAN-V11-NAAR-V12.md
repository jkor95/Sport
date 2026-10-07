# Update MijnLoop v11 -> v12

Vervang de GitHub-bestanden door v12. Je bestaande accounts, planning, PR's en geimporteerde Strava-activiteiten blijven behouden.

## Nieuw

- Nieuw hardlooplogo met sprintende loper en atletiekbaan.
- Dezelfde afbeelding wordt gebruikt voor favicon, PWA-icoon en merklogo.
- Strava-import bewaart nu ook gemiddelde hartslag, maximale hartslag en cadans wanneer Strava deze velden levert.
- Garmin blijft via Garmin Connect -> Strava -> MijnLoop lopen. Als de Strava-apparaatnaam Garmin bevat, toont MijnLoop dit als Garmin-via-Strava import.
- PR-overzicht blijft 1 km, 5 km, 10 km, halve marathon en marathon tonen; Strava best efforts hebben voorrang.

## Supabase

Heb je de Strava-koppeling uit v11 al geinstalleerd? Dan hoef je alleen de Edge Function `strava` opnieuw te deployen met de v12-code. De tabel en secrets blijven hetzelfde.

Heb je Strava nog nooit geinstalleerd? Volg `STRAVA-EENMALIGE-SETUP.md`.

Zonder Strava hoef je in Supabase niets te wijzigen.
