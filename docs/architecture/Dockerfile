# アーキテクチャ図（diagrams）を描くためのイメージ。Graphviz と日本語フォントを入れる
FROM python:3.13-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends graphviz fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir diagrams==0.25.1
WORKDIR /work
