# Isolated Coolify test deployment. Does not change GitHub Pages.
FROM nginx:1.27-alpine
COPY index.html admin.html START-HIER.html DEMO.html /usr/share/nginx/html/
COPY *.js *.css *.webmanifest /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY core/ /usr/share/nginx/html/core/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
