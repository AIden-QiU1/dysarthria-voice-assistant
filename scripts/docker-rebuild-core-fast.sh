#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-core}"

if [[ -n "${VOXFLAME_DOCKER_PREFIX:-}" ]]; then
  # shellcheck disable=SC2206
  DOCKER_PREFIX=( ${VOXFLAME_DOCKER_PREFIX} )
else
  DOCKER_PREFIX=( sudo )
fi

docker_cmd() {
  "${DOCKER_PREFIX[@]}" docker "$@"
}

compose_cmd() {
  docker_cmd compose "$@"
}

compose_cmd_with_env() {
  local -a env_args=()
  while [[ $# -gt 0 && "$1" == *=* ]]; do
    env_args+=( "$1" )
    shift
  done

  if [[ ${#DOCKER_PREFIX[@]} -gt 0 && "${DOCKER_PREFIX[0]}" == "sudo" ]]; then
    "${DOCKER_PREFIX[@]}" env "${env_args[@]}" docker compose "$@"
  else
    env "${env_args[@]}" docker compose "$@"
  fi
}

wait_for_health() {
  local service="$1"
  local container_id
  container_id="$(compose_cmd ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    echo "[voxflame] No container found for service: $service" >&2
    return 1
  fi

  for _ in {1..12}; do
    local health
    health="$(docker_cmd inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
    if [[ "$health" == "healthy" || "$health" == "running" ]]; then
      echo "[voxflame] $service is $health"
      return 0
    fi
    sleep 5
  done

  echo "[voxflame] $service did not become healthy in time" >&2
  compose_cmd logs --tail=100 "$service" >&2
  return 1
}

case "$MODE" in
  env-backend)
    echo "[voxflame] Recreating backend only; image and other core services are preserved."
    compose_cmd up -d --no-deps --force-recreate backend
    wait_for_health backend
    exit 0
    ;;
  backend|frontend)
    echo "[voxflame] Building and recreating $MODE only."
    compose_cmd build "$MODE"
    compose_cmd up -d --no-deps "$MODE"
    wait_for_health "$MODE"
    exit 0
    ;;
  collection)
    echo "[voxflame] Building and recreating the white-label frontend and Caddy only."
    compose_cmd --profile collection build frontend-collection
    compose_cmd --profile collection --profile https up -d --no-deps frontend-collection caddy
    wait_for_health frontend-collection
    exit 0
    ;;
  core)
    ;;
  *)
    echo "Usage: $0 [core|backend|frontend|collection|env-backend]" >&2
    exit 1
    ;;
esac

LIVEKIT_AGENT_IMAGE="${LIVEKIT_AGENT_IMAGE:-voxflame-agent-livekit-agent:latest}"
LIVEKIT_AGENT_BASE_IMAGE="${LIVEKIT_AGENT_BASE_IMAGE:-docker.m.daocloud.io/library/python:3.10-slim}"
REQUIRED_LIVEKIT_AGENTS_VERSION="$(sed -n 's/.*livekit-agents==\([0-9][0-9.]*\).*/\1/p' "$ROOT_DIR/livekit_agent/Dockerfile" | head -n 1)"
FAST_BOOTSTRAP_DEPS=1
FAST_BASE_IMAGE="$LIVEKIT_AGENT_BASE_IMAGE"
FAST_DOCKERFILE="${LIVEKIT_AGENT_DOCKERFILE:-Dockerfile}"

if [[ -n "$REQUIRED_LIVEKIT_AGENTS_VERSION" ]] && \
   [[ -x "$ROOT_DIR/livekit_agent/.venv/bin/python" ]] && \
   "$ROOT_DIR/livekit_agent/.venv/bin/python" -c "from importlib.metadata import version; import websockets, dotenv; assert version('livekit-agents') == '$REQUIRED_LIVEKIT_AGENTS_VERSION'" >/dev/null 2>&1; then
  FAST_DOCKERFILE="Dockerfile.localvenv"
  FAST_BOOTSTRAP_DEPS=0
  echo "[voxflame] Reusing local livekit_agent/.venv as dependency layer via $FAST_DOCKERFILE"
elif [[ -n "$REQUIRED_LIVEKIT_AGENTS_VERSION" ]] && \
     docker_cmd image inspect "$LIVEKIT_AGENT_IMAGE" >/dev/null 2>&1 && \
     docker_cmd run --rm --entrypoint python "$LIVEKIT_AGENT_IMAGE" -c "from importlib.metadata import version; assert version('livekit-agents') == '$REQUIRED_LIVEKIT_AGENTS_VERSION'" >/dev/null 2>&1; then
  FAST_BOOTSTRAP_DEPS=0
  FAST_BASE_IMAGE="$LIVEKIT_AGENT_IMAGE"
  echo "[voxflame] Reusing local livekit-agent image as dependency base: $FAST_BASE_IMAGE"
else
  echo "[voxflame] No local livekit-agent image or reusable .venv found; falling back to full dependency bootstrap."
fi

echo "[voxflame] Building frontend/backend..."
compose_cmd build frontend backend

echo "[voxflame] Building livekit-agent with dockerfile=$FAST_DOCKERFILE LIVEKIT_AGENT_BOOTSTRAP_DEPS=$FAST_BOOTSTRAP_DEPS"
compose_cmd_with_env \
  "LIVEKIT_AGENT_DOCKERFILE=$FAST_DOCKERFILE" \
  "LIVEKIT_AGENT_BOOTSTRAP_DEPS=$FAST_BOOTSTRAP_DEPS" \
  "LIVEKIT_AGENT_BASE_IMAGE=$FAST_BASE_IMAGE" \
  build livekit-agent

echo "[voxflame] Recreating core services..."
compose_cmd up -d --force-recreate livekit-server backend frontend livekit-agent

wait_for_health backend
wait_for_health frontend

echo "[voxflame] Done."
