# Installatie / update MijnLoop v16

## Basisupdate vanaf v10

1. Vervang de bestanden in je GitHub Pages-repository door v16.
2. Laat `config.js` met je bestaande Supabase URL en publishable key staan.
3. Publiceer GitHub Pages.
4. Doe daarna een harde refresh of sluit de geïnstalleerde webapp volledig af en open hem opnieuw.

Voor het gewone gebruik is **geen nieuwe SQL of Supabase-wijziging nodig**.

## Nieuw in v16

- nieuw sprint-hardlooplogo met atletiekbaan;
- PR-overzicht bij Voortgang;
- exactere PR's wanneer Strava best efforts beschikbaar zijn;
- optionele automatische Strava-import met afstand, tijd, tempo, hoogte, apparaat, best efforts en waar beschikbaar hartslag/cadans;
- Garmin praktisch via Garmin Connect -> Strava -> MijnLoop.

## Strava gebruiken?

Volg dan éénmalig `STRAVA-EENMALIGE-SETUP.md`.

Daarna koppel je in **Instellingen > Strava / Garmin import** je Strava-account. MijnLoop controleert vervolgens bij openen en synchroniseren op nieuwe hardloopactiviteiten.

## AI standby

`ai-plan` en eventuele OpenAI-secrets mogen blijven staan. MijnLoop v16 roept ze niet aan.


## Meldingen op iPhone
1. Open MijnLoop in Safari en kies **Deel > Zet op beginscherm**.
2. Open daarna de geinstalleerde MijnLoop-app.
3. Ga naar **Instellingen > Meldingen & badges**.
4. Kies **Meldingen toestaan** en bepaal per categorie wat je wilt ontvangen.

Voor v16 is hiervoor geen extra Supabase-installatie nodig.

## Belangrijk in v16

Je hoeft niets in Supabase te wijzigen. Sla na de GitHub-update je instellingen een keer opnieuw op om je toekomstige schema met de nieuwe doeldatum-gedreven lange-duurloopcurve opnieuw op te bouwen.


## Nieuw in v16

- Bij vaste sportmomenten stel je alleen dag en begintijd in.
- De optie voor basisduur/eindtijd is verwijderd uit Instellingen.
- Hardloopduur wordt automatisch berekend uit het geplande aantal kilometers en je ingestelde tempo.
- Voor deze update is geen Supabase-wijziging nodig.
