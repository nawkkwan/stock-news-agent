#!/command/with-contenv sh
set -eu

RUNTIME_DIR=/opt/data
PERSIST_DIR=/mnt/hermes-persist

sync_directory() {
  source_dir="$1"
  destination_dir="$2"
  [ -d "$source_dir" ] || return 0
  mkdir -p "$destination_dir"
  cp -R "$source_dir/." "$destination_dir/" 2>/dev/null || true
}

while true; do
  mkdir -p "$PERSIST_DIR"
  for profile_file in MEMORY.md USER.md SOUL.md; do
    if [ -f "$RUNTIME_DIR/$profile_file" ]; then
      cp "$RUNTIME_DIR/$profile_file" "$PERSIST_DIR/$profile_file" 2>/dev/null || true
    fi
  done
  sync_directory "$RUNTIME_DIR/memories" "$PERSIST_DIR/memories"
  sync_directory "$RUNTIME_DIR/skills/finance/portfolio-agent" "$PERSIST_DIR/skills/finance/portfolio-agent"
  sleep 30
done
