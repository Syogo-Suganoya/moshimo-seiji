# 開発用のイメージ。ソースは compose.yaml でマウントし、ここでは依存パッケージだけ入れる
FROM node:24-slim AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# スキル版の zip を作るのに使う
RUN apt-get update && apt-get install -y --no-install-recommends zip && rm -rf /var/lib/apt/lists/*

# ワークスペース（engine / web / skill）の package.json だけ先にコピーして、依存のキャッシュを効かせる
COPY package.json package-lock.json ./
COPY engine/package.json engine/
COPY web/package.json web/
COPY skill/package.json skill/
RUN npm ci --no-audit --no-fund

EXPOSE 3000
CMD ["npm", "run", "dev"]
