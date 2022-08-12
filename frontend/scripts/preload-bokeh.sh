#!/bin/bash


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

mkdir -p public/vendor/bokeh
cd public/vendor/bokeh

for filename in "${bokeh_files[@]}"
do
  if [ ! -f $filename ]
  then
    curl "${bokeh_release_url}/${filename}" -O
  fi
done
