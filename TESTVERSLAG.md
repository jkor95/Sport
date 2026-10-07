# Testverslag MijnLoop v16

- Volledige regressietest van planner, kalender, Strava/PR en meldingen.
- Exact 4-52 weken en doeldatumvensters getest.
- Vaste sportmomenten zonder zichtbaar duur- of eindtijdveld getest.
- Hardloopslots zonder `minutes` worden geaccepteerd; trainingsduur wordt automatisch uit afstand en tempo berekend.
- Meerdere momenten op dezelfde dag zijn mogelijk zolang de begintijd niet exact gelijk is.
- Marathonpiek maximaal 32 km en taper voor doeldag blijven intact.

**Resultaat:** 66/66 tests geslaagd.
