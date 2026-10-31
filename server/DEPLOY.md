# Sport-app op Dell – stagingbackend (niet productie)

Deze branch is onafhankelijk van Supabase Cloud voor **login, accounts en trainingsstatus**. De overige Supabase Edge Functions (push, kalenders, Strava, enz.) zijn **nog niet gemigreerd**. Activeer deze stagingversie niet als vervanging voor de live app.

## Deployment in Coolify
- Maak een **nieuwe** resource uit de GitHub-branch `selfhost-dell-preparation`.
- Build pack: **Dockerfile** (poort `3000`).
- Zet als geheime omgevingvariabelen: `DATABASE_URL` (de interne PostgreSQL connectiestring in Coolify), `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD` (eigen uniek sterk wachtwoord), `PORT=3000`.
- Zorg dat de app en database op hetzelfde beveiligde Docker-netwerk bereikbaar zijn. Zet PostgreSQL niet publiek open.
- Stel HTTPS in voordat je gebruikers laat inloggen of data invoeren; `http://` is alleen geschikt voor een lege ontwikkeltest op eigen LAN.
- `GET /health` geeft een controleantwoord, `POST /functions/v1/mijnloop-sync` biedt de legacy API.
- Geen bestaande Supabase-data worden automatisch geïmporteerd. Lege database = geen bestaande accounts of trainingen. De bootstrapadmin wordt bij het opstarten alleen gemaakt als de database helemaal leeg is én de genoemde twee variabelen zijn gezet.
- Verwijder de admin-variabelen na veilige initiële inrichting en controleer dat er een beheerder kan inloggen.

## Beveiliging en compatibiliteit
- Gebruikerswachtwoorden zijn scrypt-gehasht; oude leesbare wachtwoorden worden niet ondersteund en vergen een gecontroleerde migratie of reset.
- Bestaande Supabase-sessies zijn ongeldig in deze stagingomgeving.
- Beheerder kan geen wachtwoorden terugzien, alleen opnieuw instellen.
- 'migrate-local' en 'bootstrap' API-acties zijn bewust niet publiek bereikbaar; ongeauthenticeerde import/bootstrap zou een accountovername mogelijk maken.
- Er is nog geen brute-force rate limiting. **Niet voor publieke gebruikers openstellen** tot rate limiting en overige productiebeveiligingen geregeld zijn.
- Authenticatie gebruikt huidige x-mijnloop-session compatibiliteit, maar er moet nog een productie-security-review volgen.
- De losse `supabase/functions/*` taken werken niet met deze backend.
- Nieuwe PostgreSQL-back-ups en een volledige hersteltest zijn nodig alvorens productiegebruik.
- De live `main` blijft ongewijzigd.

## Testplan
1. Server opstarten en `/health` controleren.
2. Initiele beheerder inloggen, testgebruikers creëren.
3. Trainingsstatus opslaan, ophalen en conflict (HTTP 409) verifiëren.
4. Accounts blokkeren, rollen, wachtwoordwijzigingen en login na herstart testen.
5. Integratie- en securitytests uitvoeren.
6. Echte gegevens pas na gecontroleerde database-export importeren.
