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


## v31 - uniforme afstand, duur en tempo
- Kilometers worden overal tot twee decimalen verwerkt en als twee decimalen weergegeven.
- Duur wordt overal als MM:SS weergegeven; kloktijden blijven HH:MM.
- Toekomstige hardlooptrainingen tonen afstand, aanbevolen duur en gemiddeld gepland tempo per kilometer.
- Jouw totaal toont sporttijd als MM:SS in plaats van decimale minuten.


## v31
- iPhone-vriendelijke MM:SS-invoer: 1422 wordt 14:22 en 515 wordt 5:15/km.
- 'Rustig tempo' verduidelijkt naar normaal/rustig looptempo.
- Geplande hardlooptijd gebruikt het ingestelde tempo zonder vaste +10 minuten, zodat gemiddeld gepland tempo niet kunstmatig te langzaam wordt.


## v32
- Als je een handmatige hardloopactiviteit 1-3 dagen na een nog open geplande loop toevoegt, vraagt MijnLoop of dit dezelfde verschoven training is.
- Bij koppelen wordt de oorspronkelijke planning naar de nieuwe dag verplaatst. De geplande afstand/tijd blijven als referentie bewaard; bij een reeds gelopen training opent daarna direct het invulscherm met de ingevoerde werkelijke afstand en tijd.
- Automatisch gegenereerde trainingsafstanden en Coach-aanpassingen gebruiken alleen hele kilometers. Een voorstel van 5,22 km wordt bijvoorbeeld 5 km.
- Werkelijke en handmatig ingevoerde afstanden blijven decimalen tot twee cijfers ondersteunen.


## v33
- Gemiste trainingen kunnen direct worden verwijderd; 0 km en 0:00 invoeren is niet meer nodig.
- De verwijderknop staat ook in het registratiescherm van een verlopen training.
- Handmatig toegevoegde activiteiten kunnen ook na registratie definitief worden verwijderd.
- Een verwijderde geregistreerde loop telt daarna niet meer mee in voortgang of de automatische Coach-beoordeling; toekomstige trainingen worden opnieuw beoordeeld.
- Een verwijderd vast schema-moment blijft voor die specifieke datum uitgesloten bij een volgende schema-opbouw.
- De doeldag zelf wijzig of verwijder je via Instellingen.


## v34
- Persoonlijke records kunnen nu ook uit het gemiddelde tempo van een langere hardloopactiviteit worden berekend.
- Een loop van 5,00 km kan bijvoorbeeld een 1 km-record opleveren op basis van het gemiddelde tempo.
- Bij ieder record staat expliciet of het een 'PR op specifieke afstand' is of een 'PR op gemiddeld tempo', inclusief de afstand waaruit dat gemiddelde kwam.
- De snelste geldige tijd wint, ongeacht of die uit een specifieke afstand of een gemiddeld tempo van een langere loop komt.


## v35
- Intervaltrainingen gebruiken nu een totale geplande afstand die de volledige sessie omvat: inlopen, snelle stukken, herstel en uitlopen.
- De intervalopdracht schaalt mee met de geplande hele-kilometerafstand. Een korte sessie van 3 km krijgt dus niet langer een opdracht die al ruim meer dan 3 km vraagt.
- Iedere intervalstap wordt afzonderlijk getoond met exacte duur en exact richttempo per kilometer.
- Inlopen/uitlopen, snelle stukken en rustige herstelstukken hebben verschillende kleuren.
- De geplande tijdsduur van een interval wordt voortaan uit de daadwerkelijke intervalstappen berekend in plaats van alleen afstand x normaal tempo.


## v36
- Echte Web Push toegevoegd voor MijnLoop, ook wanneer de PWA gesloten is.
- Push is per meldingscategorie aan/uit te zetten: aankomende sportactiviteit en nog niet ingevulde training.
- De bestaande tijd vooraf / vertraging wordt ook voor echte push gebruikt.
- Supabase controleert ongeveer iedere 5 minuten en dedupliceert meldingen per training en categorie.
- Op iPhone moet MijnLoop op het beginscherm staan en via dat icoon worden geopend.


## v37
- Bij het registreren van een hardlooptraining kun je nu aangeven welk type loop je werkelijk hebt gedaan: kort/rustig, interval of lange duurloop.
- Gepland type en werkelijk type worden apart bewaard en in het trainingsdetail getoond.
- De Coach gebruikt het werkelijke type voor vergelijkingen met toekomstige trainingen. Een rustige loop op een geplande intervaldag telt dus niet meer als uitgevoerde intervaltraining.
- Een gemiste interval/duurloop wordt niet als inhaaltraining zwaarder teruggezet. Een onverwacht zwaarder type training geeft tijdelijk extra herstelruimte.
