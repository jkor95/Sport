# JK Works Dell - test van automatische bronsynchronisatie

Deze documentatie hoort uitsluitend bij de niet-productiebranch `selfhost-dell-preparation`.

Doel: aantonen dat de bestaande Dell-bronbewaker een **nieuwe gewone childcommit**
vanaf GitHub zelfstandig naar de gelijknamige Forgejo-testbranch overneemt,
vervolgens de vaste offline `verify_only`-test aanvraagt en veilig rapporteert.

Er worden geen applicatiebestanden, productiebranches, databases, accounts,
pushmeldingen of configuratiegegevens gewijzigd. Deze tekst activeert geen
GitHub Actions en geeft nergens publicatierechten.

Bewijs is pas geslaagd wanneer de Dell-rapporten een nieuwe exacte SHA tonen:
- `reports/source-watch.json` met `stage: fast_forward_staged`;
- `reports/releases/auto-sport-<commitprefix>.json` met `verified_no_publish`;
- 68/68 Sport-tests geslaagd (of een gemotiveerd nieuw testtotaal).

Een gemaakte GitHub-commit is **geen** bewijs dat de Dell de synchronisatie
al heeft uitgevoerd.
