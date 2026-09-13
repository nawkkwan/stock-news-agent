#!/command/with-contenv sh
set -eu

mkdir -p /opt/data/skills/finance

if [ ! -f /opt/data/config.yaml ]; then
  cp /opt/hermes-seed/config.yaml /opt/data/config.yaml
fi

# The pinned Hermes image requires a schema version before it will start the
# API server. Existing Azure Files volumes were seeded by an earlier template
# without this marker, so add the supported migration floor once, preserving
# every existing user setting and all persisted memories.
if ! grep -q '^_config_version:' /opt/data/config.yaml; then
  sed -i '1i_config_version: 12' /opt/data/config.yaml
fi

if [ ! -d /opt/data/skills/finance/portfolio-agent ]; then
  cp -R /opt/hermes-seed/skills/finance/portfolio-agent /opt/data/skills/finance/portfolio-agent
fi
