#!/usr/bin/env bash

# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: scripts/check_yarn_dedupe.sh [workspace_dir ...]

Runs `yarn dedupe --check` inside each workspace (relative to repo root) and
fails if the lockfile would change. When no workspace is provided, defaults to
checking `frontend`.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -eq 0 ]]; then
  WORKSPACES=("frontend")
else
  WORKSPACES=("$@")
fi

failures=()

for workspace in "${WORKSPACES[@]}"; do
  workspace_path="${REPO_ROOT}/${workspace}"
  lockfile="${workspace_path}/yarn.lock"

  if [[ ! -f "${lockfile}" ]]; then
    echo "⚠️  Skipping '${workspace}' (missing yarn.lock)."
    continue
  fi

  echo "🔍 Checking yarn dedupe in '${workspace}'..."

  pushd "${workspace_path}" > /dev/null
  if ! yarn dedupe --check; then
    failures+=("${workspace}")
    echo ""
    echo "❌ '${workspace}/yarn.lock' is not deduped."
    echo "   Fix it by running \`cd ${workspace} && yarn dedupe\`, then commit the updated lockfile."
    echo ""
  fi
  popd > /dev/null
done

if [[ ${#failures[@]} -gt 0 ]]; then
  echo "Detected non-deduped lockfiles in: ${failures[*]}"
  exit 1
fi

echo "✅ All checked lockfiles are already deduped."
