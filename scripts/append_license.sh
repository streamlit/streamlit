#!/bin/sh

# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

# Ensure the file exists.
if [ ! -f "$1" ]; then
    echo "$1 does not exist."
    exit 1
fi

# Infer the name of the software from our path param:
# - Get the filename at the path
# - Replace underscores and dashes with spaces
# - Remove `.LICENSE` and anything after it from the filename
SOFTWARE_NAME=$(basename "$1" | sed 's/[_-]/ /g' | sed 's/.LICENSE.*//')

echo '-----' >> NOTICES
echo '' >> NOTICES
echo "The following software may be included in this product: $SOFTWARE_NAME."\
  "This software contains the following license and notice below:" >> NOTICES
echo '' >> NOTICES
cat "$1" >> NOTICES
echo '' >> NOTICES
