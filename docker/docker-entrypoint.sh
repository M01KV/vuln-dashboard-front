#!/bin/sh
# Hook executado automaticamente pela imagem oficial do nginx (arquivos em
# /docker-entrypoint.d/ rodam antes do nginx subir). Regera assets/js/env.js
# a partir da variável de ambiente API_BASE_URL no momento em que o
# container sobe, permitindo apontar o front-end para qualquer endereço da
# API sem precisar rebuildar a imagem.
set -e

: "${API_BASE_URL:=http://localhost:8000}"

envsubst '${API_BASE_URL}' < /usr/share/nginx/html/docker/env.template.js \
  > /usr/share/nginx/html/assets/js/env.js

echo "[env] API_BASE_URL configurado como: ${API_BASE_URL}"
