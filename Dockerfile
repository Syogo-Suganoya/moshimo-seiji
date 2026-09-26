# 開発用のイメージ。ソースは compose.yaml でマウントし、ここでは依存パッケージだけ入れる
FROM node:24-slim AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ワークスペース（engine / web）の package.json だけ先にコピーして、依存のキャッシュを効かせる
COPY package.json package-lock.json ./
COPY engine/package.json engine/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund

EXPOSE 3000
CMD ["npm", "run", "dev"]
