# Update van v5 naar v6

1. Vervang de GitHub-bestanden door v6.
2. Geen nieuwe SQL nodig.
3. Vervang in Supabase Edge Functions > ai-plan de code door `ai-plan-standalone-index.ts` uit v6 en deploy opnieuw.
4. Bestaande secrets blijven ongewijzigd.

Wijzigingen:
- Een oude toekomstige doeldag wordt automatisch geannuleerd zodra doel of doeldatum verandert of wordt verwijderd. Daardoor blijft een oude voorbeeld-marathon niet meer in de agenda staan.
- Geplande trainingslopen worden door de planner nooit langer dan 32 km. Een marathon-doeldag zelf blijft 42,2 km.
- De AI-instructie en servergrenzen hanteren dezelfde 32 km bovengrens.
