# Update van v9 naar MijnLoop v10

Deze versie verandert de app van een AI-ondersteunde planner naar een volledig lokale hardloopplanner.

## Wat jij moet doen

1. Vervang alle GitHub-bestanden door v10.
2. Geen SQL uitvoeren.
3. Geen nieuwe Edge Function aanmaken.
4. `ai-plan` mag gewoon in Supabase blijven staan; v10 gebruikt hem niet.
5. Open MijnLoop opnieuw en ga naar **Instellingen**.
6. Vul je tempo opnieuw in als `mm:ss`, bijvoorbeeld `6:30`.
7. Kies bij **Planning vooruit**:
   - `Gebruik doeldatum`, of
   - een vaste periode van 4 t/m 52 weken.
8. Kies voor elke hardloopdag de rol **Kort/rustig**, **Lang** of **Interval**.
9. Sla de instellingen op. MijnLoop bouwt dan lokaal het nieuwe schema.

## Bestaande gegevens

Afgeronde trainingen, doelen, accountgegevens en historie blijven behouden. Oude hardloopdagen met type `easy` worden automatisch als korte/rustige loop behandeld.
