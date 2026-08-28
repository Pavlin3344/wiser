#!/bin/sh
# nginx.conf hardcodes the Compose service name "wiser-backend" as its upstream.
# Rewrite it here when a real hostname is supplied (Azure Container Apps) - unset,
# this is a no-op and Hetzner's Compose DNS still resolves "wiser-backend" itself.
set -eu

: "${BACKEND_HOST:=wiser-backend}"

sed -i "s/wiser-backend:8080/${BACKEND_HOST}:8080/g" /etc/nginx/conf.d/default.conf
