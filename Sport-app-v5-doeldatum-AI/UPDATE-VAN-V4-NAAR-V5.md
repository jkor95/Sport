# Sport-app v5 bijwerken vanaf v4

1. Vervang de bestanden in je GitHub repository door de inhoud van deze map.
2. Er is geen nieuwe database-SQL nodig.
3. Open in Supabase: Edge Functions -> ai-plan.
4. Vervang de volledige code van ai-plan door het bestand `ai-plan-standalone-index.ts` uit deze map en klik Deploy.
5. Laat de bestaande secrets staan: `OPENAI_API_KEY`, `OPENAI_MODEL` en `APP_ORIGIN`.
6. Herlaad Sport-app volledig. Door de nieuwe service-worker-cache hoort v5 na herladen zichtbaar te worden.
7. Open Instellingen, controleer je huidige weekomvang, recente langste loop en doeldatum en sla opnieuw op. Het schema wordt dan opnieuw opgebouwd.

Met een doeldatum bepaalt die datum voortaan automatisch de volledige planlengte. De handmatige horizon is alleen nog van toepassing wanneer je geen doeldatum gebruikt.
