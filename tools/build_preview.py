"""Build an offline demo containing no Supabase credentials. Python stdlib only."""
from pathlib import Path
import re
p=Path(__file__).resolve().parent.parent
html=(p/'index.html').read_text()
html=re.sub(r'\s*<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
html=re.sub(r'\s*<link[^>]*(?:manifest|apple-touch-icon|icon)[^>]*>','',html)
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+(p/'styles.css').read_text()+'</style>')
html=re.sub(r'\s*<script defer src="[^"]+"></script>','',html)
# This demo must never silently connect to a real account or inherited configuration.
config="globalThis.SPORT_PREVIEW=true; globalThis.SPORT_CONFIG={supabaseUrl:'',supabasePublishableKey:'',enableAI:false,appName:'MijnLoop'};"
js=config+'\n'+'\n'.join((p/f).read_text() for f in ['core/dates.js','core/planner.js','core/calendar.js','demo.js','db.js','app.js'])
html=html.replace('</body>','<script>'+js.replace('</script','<\\/script')+'</script></body>')
(p/'DEMO.html').write_text(html)
print('Created DEMO.html:',len(html.encode()),'bytes')
