#!/bin/sh
# Publica a versão que está em /opt/pagamoz e limpa o que sobra das construções.
# Nunca apaga volumes (bases de dados, ficheiros) nem imagens em uso: só imagens órfãs e cache de construção antiga.
set -e
cd "$(dirname "$0")"
docker compose -p pagamoz build
docker compose -p pagamoz up -d --remove-orphans
docker image prune -f >/dev/null                      # imagens sem nome que ficaram da versão anterior
docker builder prune -f --filter until=72h >/dev/null # cache de construção com mais de 3 dias
docker compose -p pagamoz ps --format "{{.Name}} {{.Status}}"
df -h / | tail -1
