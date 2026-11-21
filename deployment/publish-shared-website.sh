#!/usr/bin/env bash
set -euo pipefail

container=tariq-frontend
if ! docker container inspect "$container" >/dev/null 2>&1; then
  container=tariq-websites
fi
proxy=fahrschulpilot-caddy-1
volume=tariq-websites-public
root=/srv/public-sites
site=tariq-fahrdienst.de
tag=$(date -u +%Y%m%d%H%M%S%N)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

cp index.html styles.css app.js logo.svg fahrdienst-hero.jpg "$stage/"
cp -R assets "$stage/"
chmod -R a+rX "$stage"

smoke() {
  for domain in app.tariq-living.de fahrschul-pilot.de tariq-fahrdienst.de tariq-taxizentrale.de; do
    docker exec "$proxy" wget -qO /dev/null --header "Host: $domain" "http://$container/"
  done
}

ready() {
  for attempt in 1 2 3 4 5; do
    if smoke; then return 0; fi
    sleep 1
  done
  return 1
}

mounted=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/srv/public-sites"}}{{.Name}}{{end}}{{end}}' "$container")
mount_count=$(docker inspect --format '{{len .Mounts}}' "$container")
if [[ "$mounted" != "$volume" ]]; then
  [[ "$mount_count" == 0 ]] || { echo 'Unerwartete Mounts am Webseiten-Container.' >&2; exit 1; }
  image=$(docker inspect --format '{{.Image}}' "$container")
  docker image inspect "$image" >/dev/null
  docker exec "$container" test -f "$root/$site/index.html"
  previous="$container-before-volume-$tag"
  docker volume create "$volume" >/dev/null
  docker stop "$container" >/dev/null
  docker rename "$container" "$previous" || { docker start "$container" >/dev/null; exit 1; }
  if ! docker run -d --name "$container" --restart unless-stopped \
      --network fahrschulpilot_web --mount "type=volume,src=$volume,dst=$root" "$image" >/dev/null ||
     ! ready; then
    docker rm -f "$container" >/dev/null 2>&1 || true
    docker rename "$previous" "$container"
    docker start "$container" >/dev/null
    exit 1
  fi
  echo "Webseiten-Volume eingerichtet. Rückfall-Container: $previous"
fi

release=".fahrdienst-$tag"
docker exec "$container" mkdir "$root/$release"
docker cp "$stage/." "$container:$root/$release/"
docker exec "$container" sh -eu -c '
  cd "$1"
  site=$2
  release=$3
  previous=".previous-$release"
  if [ -L "$site" ]; then
    ln -s "$(readlink "$site")" "$previous"
  else
    test -d "$site"
    mv "$site" "$previous"
  fi
  ln -s "$release" "$release-link"
  if ! mv -Tf "$release-link" "$site"; then
    mv -Tf "$previous" "$site"
    exit 1
  fi
' sh "$root" "$site" "$release"

if ! docker exec "$proxy" wget -qO- --header "Host: $site" "http://$container/" > "$stage/served.html" ||
   ! cmp -s "$stage/index.html" "$stage/served.html"; then
  docker exec "$container" sh -eu -c '
    cd "$1"
    if [ -L "$3" ]; then
      mv -Tf "$3" "$2"
    else
      rm "$2"
      mv "$3" "$2"
    fi
  ' sh "$root" "$site" ".previous-$release"
  exit 1
fi
echo "Fahrdienst-Webseite im gemeinsamen Container geprüft: $release"
