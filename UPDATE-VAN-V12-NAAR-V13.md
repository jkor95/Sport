# Update MijnLoop v12 -> v13

## Wat verandert
- Het door jou gekozen hardlooplogo met sprintende loper en atletiekbaan wordt nu overal gebruikt: zijbalk, mobiele header, favicon en PWA/app-icoon.
- PR-overzicht en Strava-import uit v12 blijven behouden.
- Strava-import wordt in de app duidelijk als automatisch omschreven: bij openen/inloggen en bij de gewone synchronisatieknop, met een interval van ongeveer 15 minuten om onnodige API-calls te voorkomen.
- Garmin blijft lopen via Garmin Connect -> Strava -> MijnLoop. Garmin Connect kan activiteiten automatisch naar Strava sturen; MijnLoop leest ze daarna via dezelfde koppeling in.

## Wat moet je doen
1. Vervang de GitHub-bestanden door v13.
2. Publiceer GitHub Pages opnieuw.
3. Omdat je v11/v12 Strava nog niet hebt geinstalleerd: volg daarna eenmalig `STRAVA-EENMALIGE-SETUP.md` als je automatische Strava/Garmin-import wilt gebruiken.

Zonder die optionele Strava-setup blijft MijnLoop volledig werken, inclusief schema's en PR's uit handmatige registraties.
