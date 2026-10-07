# MijnLoop v28

MijnLoop gebruikt een eigen eenvoudige gebruikersnaam/wachtwoord-login en synchroniseert accounts en sportdata centraal via Supabase. Supabase Auth wordt niet gebruikt.

## Inloggen
- Iedereen gebruikt dezelfde normale MijnLoop-inlog op `index.html`.
- Een account met rol **Gebruiker** opent de hardloopapp.
- Een account met rol **Beheerder** wordt na dezelfde login automatisch doorgestuurd naar `admin.html`.
- De gewone app toont nergens een link naar de beheerpagina.
- Rechtstreeks openen van `admin.html` zonder geldige beheerderssessie stuurt terug naar de gewone inlog.

## Beheer
De bestaande beheerfuncties blijven behouden: accounts inzien/bewerken, wachtwoorden bekijken/wijzigen, blokkeren, verwijderen en activiteit controleren.

## Synchronisatie
Opslaan synchroniseert automatisch met de centrale Supabase-database. De planner zelf blijft lokaal berekend.

## v28
- beheerlogin samengevoegd met de normale login;
- zichtbare beheerlink verwijderd van login en account/privacy;
- adminrol wordt automatisch herkend;
- beheerderslogout wist ook de normale beheerderssessie;
- directe beheerpagina zonder beheerderssessie gaat terug naar de normale login;
- service-worker cache verhoogd naar v28.


## v30 - uniforme afstand, duur en tempo
- Kilometers worden overal tot twee decimalen verwerkt en als twee decimalen weergegeven.
- Duur wordt overal als MM:SS weergegeven; kloktijden blijven HH:MM.
- Toekomstige hardlooptrainingen tonen afstand, aanbevolen duur en gemiddeld gepland tempo per kilometer.
- Jouw totaal toont sporttijd als MM:SS in plaats van decimale minuten.
