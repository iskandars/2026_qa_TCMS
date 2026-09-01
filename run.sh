#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ "$1" = "down" ]; then
  docker compose down -v
  exit 0
fi

docker compose up --build
