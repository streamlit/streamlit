#!/bin/bash


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

set -o errexit
set -o nounset
set -o pipefail

bokeh_version="2.4.3"
bokeh_release_url="https://cdn.bokeh.org/bokeh/release"
bokeh_files=(
  "bokeh-${bokeh_version}.min.js"
  "bokeh-widgets-${bokeh_version}.min.js"
  "bokeh-tables-${bokeh_version}.min.js"
  "bokeh-api-${bokeh_version}.min.js"
  "bokeh-gl-${bokeh_version}.min.js"
  "bokeh-mathjax-${bokeh_version}.min.js"
)

cd src/vendor/bokeh

for filename in "${bokeh_files[@]}"
do
  if [ ! -f $filename ]
  then
    curl "${bokeh_release_url}/${filename}" -O
  fi
done
