FROM nginx:1.27-alpine

# Necessário para o envsubst usado no entrypoint
RUN apk add --no-cache gettext

COPY index.html /usr/share/nginx/html/index.html
COPY assets /usr/share/nginx/html/assets
COPY docker/env.template.js /usr/share/nginx/html/docker/env.template.js
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/docker-entrypoint.sh /docker-entrypoint.d/40-env.sh

RUN chmod +x /docker-entrypoint.d/40-env.sh

EXPOSE 80
