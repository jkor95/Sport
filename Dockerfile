# Isolated self-hosted static frontend for Coolify.
# IMPORTANT: This branch's frontend still talks to Supabase Cloud.
# Do not replace the production app or point users here until a private API is implemented and tested.
FROM nginx:1.27-alpine
COPY index.html admin.html /usr/share/nginx/html/
COPY app.js admin.js admin.css styles.css db.js local-auth.js config.js push.js sw.js manifest.webmanifest /usr/share/nginx/html/
COPY core/ /usr/share/nginx/html/core/
COPY assets/ /usr/share/nginx/html/assets/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
