#!/bin/sh
set -euo pipefail

VERSION=$1
VERSION_BRANCH="release/${VERSION}"

git switch --create "$VERSION_BRANCH"
python scripts/update_version.py "$VERSION"
git commit --all --message="Up version to ${VERSION}"
git push origin "$VERSION_BRANCH"
