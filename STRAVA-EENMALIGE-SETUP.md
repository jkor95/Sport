# Eenmalige Strava-koppeling voor MijnLoop v13

Dit is **optioneel**. Zonder Strava werkt MijnLoop volledig: planning, lokale bijsturing, agenda, PR-overzicht uit handmatige registraties en fysio-PDF blijven werken.

Met Strava kan MijnLoop bij openen/synchroniseren automatisch recente hardloopactiviteiten ophalen. Garmin-gebruiker? Laat Garmin Connect naar Strava synchroniseren; MijnLoop leest daarna dezelfde loop uit Strava. Zo is geen tweede Garmin-API-integratie nodig.

## Wat moet je eenmalig in Supabase doen?

### 1. SQL uitvoeren
Open **Supabase > SQL Editor** en voer uit:

`supabase/migrations/202610060003_strava.sql`

Dit maakt één server-only tabel voor de OAuth-tokens. Browseraccounts krijgen geen lees- of schrijfrechten op deze tabel.

### 2. Strava API-app maken
Ga naar `https://www.strava.com/settings/api` en maak een API application.

Gebruik als **Authorization Callback Domain** alleen jouw Supabase-domein, bijvoorbeeld:

`gcxnxfwmgcrhfgjlqbnn.supabase.co`

De volledige redirect die MijnLoop gebruikt is:

`https://gcxnxfwmgcrhfgjlqbnn.supabase.co/functions/v1/strava/callback`

Bewaar je **Client ID** en **Client Secret**. Zet de Client Secret nooit in GitHub of `config.js`.

### 3. Twee Supabase secrets toevoegen
Ga naar **Edge Functions > Secrets** en voeg toe:

- `STRAVA_CLIENT_ID` = jouw Strava Client ID
- `STRAVA_CLIENT_SECRET` = jouw Strava Client Secret

De al bestaande `APP_ORIGIN` blijft gebruikt worden. Er is dus geen extra app-URL-secret nodig.

### 4. Eén Edge Function deployen
Maak/deploy de functie met exacte naam:

`strava`

Gebruik de code uit:

`supabase/functions/strava/index.ts`

Voor deze functie moet **Verify JWT uit** staan, omdat Strava zelf de OAuth-callback zonder Supabase-login naar de functie stuurt. De functie controleert voor alle browseracties alsnog zelf de ingelogde Supabase-gebruiker en gebruikt voor de OAuth-callback een eenmalige random state-token.

## Daarna

Open MijnLoop > **Instellingen > Strava / Garmin import** en klik **Strava koppelen**.

Na toestemming:

- MijnLoop haalt recente hardloopactiviteiten op wanneer de app opent of je synchroniseert;
- maximaal ongeveer eenmaal per 15 minuten automatisch;
- afstand, tijd, gemiddeld tempo, hoogteverschil, apparaatnaam, beschikbare Strava best efforts en waar beschikbaar gemiddelde/maximale hartslag en cadans worden opgeslagen bij de activiteit;
- dubbele activiteiten worden niet opnieuw toegevoegd;
- een Strava-loop op dezelfde dag als een geplande loop wordt aan die geplande training gekoppeld;
- een losse extra loop wordt als extra afgeronde training toegevoegd.

Geïmporteerde trainingen sturen je schema **niet automatisch** op basis van een verzonnen inspanning. MijnLoop zet ze op 'Inspanning bevestigen'. Open de training en vul RPE/reden in als je wilt dat die training wordt gebruikt voor lokale bijsturing.

## Garmin

MijnLoop v13 heeft bewust geen directe Garmin API-koppeling. Garmin biedt daarvoor het Garmin Connect Developer Program. Voor een persoonlijke app is Garmin Connect -> Strava -> MijnLoop veel eenvoudiger en voorkomt het een tweede serverintegratie.


### Garmin automatisch laten doorgeven

Koppel in Garmin Connect je Strava-account. Activiteiten die daarna naar Garmin Connect worden geupload kunnen automatisch in Strava verschijnen. MijnLoop leest ze vervolgens via dezelfde Strava-koppeling in. Historische synchronisatie is afhankelijk van de Garmin/Strava-koppeling; controleer Strava als een oudere activiteit ontbreekt.
