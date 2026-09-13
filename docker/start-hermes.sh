#!/bin/sh
set -eu

mkdir -p /opt/data/skills/finance

if [ ! -f /opt/data/config.yaml ]; then
  cp /opt/hermes-seed/config.yaml /opt/data/config.yaml
fi

if [ ! -d /opt/data/skills/finance/portfolio-agent ]; then
  cp -R /opt/hermes-seed/skills/finance/portfolio-agent /opt/data/skills/finance/portfolio-agent
fi

exec hermes gateway run
