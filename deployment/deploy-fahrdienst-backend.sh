#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose -f compose.backend.yml)
container=tariq-fahrdienst-api
previous="$container-before-backend-$(date -u +%Y%m%d%H%M%S%N)"

"${compose[@]}" config --quiet
"${compose[@]}" build fahrdienst-api

project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container" 2>/dev/null || true)
if [[ -n "$project" && "$project" != tariq-backend ]]; then
  [[ "$project" == tariq-fahrdienst ]] || { echo 'Unerwartetes Compose-Projekt der Fahrdienst-API.' >&2; exit 1; }
  docker stop "$container" >/dev/null
  docker rename "$container" "$previous" || { docker start "$container" >/dev/null; exit 1; }
fi

ready() {
  local attempt
  for attempt in {1..12}; do
    if docker exec "$container" node -e '
      fetch("http://127.0.0.1:3000/health", {signal: AbortSignal.timeout(5000)})
        .then(async response => { if (!response.ok || !(await response.json()).ok) process.exitCode = 1; })
        .catch(() => { process.exitCode = 1; });
    ' &&
       docker exec tariq-websites wget -qO /dev/null http://tariq-fahrdienst-api:3000/health; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if ! "${compose[@]}" up -d --no-build fahrdienst-api || ! ready; then
  if docker container inspect "$previous" >/dev/null 2>&1; then
    "${compose[@]}" stop fahrdienst-api || true
    "${compose[@]}" rm -f fahrdienst-api || true
    docker rename "$previous" "$container"
    docker start "$container"
  fi
  exit 1
fi

test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container")" = tariq-backend
echo 'Fahrdienst-API läuft und antwortet im Compose-Projekt tariq-backend.'
