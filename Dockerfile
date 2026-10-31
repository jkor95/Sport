FROM node:22-alpine
WORKDIR /app
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev --no-audit --no-fund
COPY server/ ./server/
COPY index.html admin.html app.js admin.js admin.css styles.css db.js local-auth.js config.js push.js sw.js manifest.webmanifest ./
COPY core/ ./core/
COPY assets/ ./assets/
EXPOSE 3000
CMD ["node","server/index.cjs"]
