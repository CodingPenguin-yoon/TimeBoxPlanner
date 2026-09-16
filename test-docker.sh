#!/bin/sh
# Build verification. Runtime requires the real HTTPS domain and Google OAuth configuration.
set -eu
docker build -t tmplanner:test .
echo "Image built. See DEPLOY.md for Heimdall settings and post-deployment checks."
