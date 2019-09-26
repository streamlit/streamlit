# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

until [ -d .git ]; do cd ..; done

# Run Prettier on the staged files
yarn --cwd "frontend" pretty-quick --staged

# Run Black on the staged files (only if it exists)
# It requires Python 3.6.0+ to run but you can reformat
# Python 2 code with it, too.
if command -v "black" > /dev/null; then
  git diff --name-only --cached | grep -E "\.pyi?$" | xargs black
fi
