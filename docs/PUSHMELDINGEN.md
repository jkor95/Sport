# MijnLoop echte pushmeldingen

MijnLoop v36 gebruikt Web Push via de Supabase Edge Function `mijnloop-push`.
De achtergrondcontrole draait ongeveer iedere vijf minuten.

De gebruiker kan per categorie kiezen:
- echte push voor een aankomende sportactiviteit;
- echte push als een training voorbij is maar nog niet is ingevuld.

De bestaande instellingen voor tijd vooraf en herinneringsvertraging worden hergebruikt.

Op iPhone werkt Web Push alleen wanneer MijnLoop via Safari op het beginscherm is gezet en via dat icoon wordt geopend. Daarna kan in Instellingen -> Meldingen & badges op **Echte push inschakelen** worden gedrukt.

Pushabonnementen zijn aan het bestaande MijnLoop-account gekoppeld via de eigen sessie. RLS staat aan en anon/authenticated hebben geen directe tabeltoegang. VAPID-private sleutel en cron-geheim staan niet in Git.
