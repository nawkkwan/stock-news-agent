#!/command/with-contenv sh
set -eu

RUNTIME_DIR=/opt/data
PERSIST_DIR=/mnt/hermes-persist

mkdir -p "$RUNTIME_DIR/skills/finance" "$PERSIST_DIR"

# Azure Files holds only the deliberately portable state. Hermes itself keeps
# logs and SQLite session data on its local /opt/data filesystem, which needs
# POSIX locking and chmod support unavailable on Azure Files.
for profile_file in MEMORY.md USER.md SOUL.md; do
  if [ -f "$PERSIST_DIR/$profile_file" ]; then
    cp "$PERSIST_DIR/$profile_file" "$RUNTIME_DIR/$profile_file"
  fi
done
if [ -d "$PERSIST_DIR/memories" ]; then
  mkdir -p "$RUNTIME_DIR/memories"
  cp -R "$PERSIST_DIR/memories/." "$RUNTIME_DIR/memories/"
fi
if [ -d "$PERSIST_DIR/skills/finance/portfolio-agent" ]; then
  mkdir -p "$RUNTIME_DIR/skills/finance"
  cp -R "$PERSIST_DIR/skills/finance/portfolio-agent" "$RUNTIME_DIR/skills/finance/"
fi

# Azure Files is intentionally persistent but poor at copying the complete
# bundled skill catalog on every first start. Hermes honors this marker and
# seeds only its essential skills; portfolio-agent is copied below explicitly.
if [ ! -f "$RUNTIME_DIR/.no-bundled-skills" ]; then
  printf '%s\n' 'Portfolio deployment keeps only essential bundled skills.' > "$RUNTIME_DIR/.no-bundled-skills"
fi

if [ ! -f "$RUNTIME_DIR/config.yaml" ]; then
  cp /opt/hermes-seed/config.yaml "$RUNTIME_DIR/config.yaml"
fi

# Azure Files is deliberately used for durable memory, but it does not permit
# the non-root Hermes process to atomically rewrite config.yaml during schema
# migration. This lean config uses only current keys, so set the image's
# current schema version before Hermes starts and avoid that unsafe rewrite.
if grep -q '^_config_version:' "$RUNTIME_DIR/config.yaml"; then
  sed -i 's/^_config_version:.*/_config_version: 44/' "$RUNTIME_DIR/config.yaml"
else
  sed -i '1i_config_version: 44' "$RUNTIME_DIR/config.yaml"
fi

if [ ! -d "$RUNTIME_DIR/skills/finance/portfolio-agent" ]; then
  cp -R /opt/hermes-seed/skills/finance/portfolio-agent "$RUNTIME_DIR/skills/finance/portfolio-agent"
fi
