#!/bin/sh
# nginx.conf hardcodes "http://wiser-backend:8080" as its upstream - the Compose service
# name and its container port. That direct host:port works on Compose's DNS, but Azure
# Container Apps' internal FQDN is a platform ingress endpoint, not the container itself:
# other apps reach it over HTTPS on 443, not on the app's own target_port. Rewrite the
# whole scheme+host+port here rather than just the host, so Azure can drop the port and
# switch scheme; unset (Hetzner) it's a no-op.
set -eu

: "${BACKEND_UPSTREAM:=http://wiser-backend:8080}"

sed -i "s#http://wiser-backend:8080#${BACKEND_UPSTREAM}#g" /etc/nginx/conf.d/default.conf
