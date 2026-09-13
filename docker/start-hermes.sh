#!/command/with-contenv sh
set -eu

mkdir -p /opt/data/skills/finance

if [ ! -f /opt/data/config.yaml ]; then
  cp /opt/hermes-seed/config.yaml /opt/data/config.yaml
fi

# Azure Files is deliberately used for durable memory, but it does not permit
# the non-root Hermes process to atomically rewrite config.yaml during schema
# migration. This lean config uses only current keys, so set the image's
# current schema version before Hermes starts and avoid that unsafe rewrite.
if grep -q '^_config_version:' /opt/data/config.yaml; then
  sed -i 's/^_config_version:.*/_config_version: 44/' /opt/data/config.yaml
else
  sed -i '1i_config_version: 44' /opt/data/config.yaml
fi

if [ ! -d /opt/data/skills/finance/portfolio-agent ]; then
  cp -R /opt/hermes-seed/skills/finance/portfolio-agent /opt/data/skills/finance/portfolio-agent
fi
