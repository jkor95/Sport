# Update van v6 naar v7

1. Vervang de bestanden in GitHub door de bestanden uit v7.
2. Er is geen nieuwe SQL nodig.
3. De Supabase Edge Function `ai-plan` hoeft voor deze update niet opnieuw aangepast te worden.
4. Herlaad Sport-app volledig.

## Fix in v7
- Als de actuele doeldag handmatig is verwijderd, wordt deze bij `Schema nu opnieuw beoordelen` opnieuw aangemaakt op basis van het actuele doel en de actuele doeldatum uit Instellingen.
- `AI-schema opnieuw maken` herstelt dezelfde actuele doeldag eveneens.
- Een oude doeldag met een oude datum blijft geannuleerd zodra de doeldatum in Instellingen verandert.
- Afgeronde doeldagen uit het verleden worden niet opnieuw geactiveerd.
