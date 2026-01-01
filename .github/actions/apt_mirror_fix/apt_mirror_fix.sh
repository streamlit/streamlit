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

MIRRORS_FILE="/etc/apt/apt-mirrors.txt"

echo "apt_mirror_fix: begin"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "apt_mirror_fix: non-Linux runner, skipping"
  exit 0
fi

if [[ ! -f "${MIRRORS_FILE}" ]]; then
  echo "apt_mirror_fix: ${MIRRORS_FILE} not found, skipping"
  exit 0
fi

# Adjust apt mirror priorities to avoid slow Azure mirror (see
# https://github.com/actions/runner-images/issues/7048). Inspired by
# https://github.com/CrowdStrike/glide-core/pull/1113 and
# https://github.com/servo/servo/pull/39190.
sudo sed -i '/archive.ubuntu.com\/ubuntu\/\tpriority/ s/priority:2/priority:0/' "${MIRRORS_FILE}"
sudo sed -i '/azure.archive.ubuntu.com\/ubuntu\/\tpriority/ s/priority:0/priority:1/' "${MIRRORS_FILE}"
sudo sed -i '/security.ubuntu.com\/ubuntu\/\tpriority/ s/priority:3/priority:2/' "${MIRRORS_FILE}"

echo "apt_mirror_fix: updated ${MIRRORS_FILE}:"
sudo cat "${MIRRORS_FILE}"

echo "apt_mirror_fix: done"
