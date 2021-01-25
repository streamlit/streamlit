#!/bin/bash
# Copyright 2018-2021 Streamlit Inc.
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

# https://medium.com/factualopinions/consider-starting-all-your-bash-scripts-with-these-options-74fbec0cbb83
set -o errexit
set -o nounset
set -o pipefail


if [ $# -eq 0 ]
then
  echo ""
  echo "Usage"
  echo "  $0 <diff files to convert>"
  echo ""
  echo "Example"
  echo "  $0 ~/downloads/*.diff.png"
  echo ""
  exit -1
fi


has_convert=$(command -v convert) || {
  echo ""
  echo "Missing dependency."
  echo "Please install ImageMagick first."
  echo ""
  exit -1
}


tmp_dir="$(mktemp -d -t streamlit_cropped_diffs-XXXXX)"

diff_files=("$@")
len=${#diff_files[@]}


# Crop diff files and put the resulting snapshot files in $tmp_dir.
# NOTE: We're using this style of "if" statement to account for filenames that have spaces in them!
for (( i=0; i<${len}; i++ ))
do
  diff_file="${diff_files[$i]}"
  filename=$(basename -- "$diff_file" .diff.png)  # foo.diff.png -> foo

  output_pattern=${filename}-%02d.png

  convert "$diff_file" -crop 3x1@ "${tmp_dir}/$output_pattern"

  rm "${tmp_dir}/${filename}-00.png"
  rm "${tmp_dir}/${filename}-01.png"
  mv "${tmp_dir}/${filename}-02.png" "${tmp_dir}/${filename}.snap.png"

  echo "Created ${tmp_dir}/${filename}.snap.png"
done


# Put cropped images in the right place in the Git tree.
for snapshot_file in $tmp_dir/*
do
  filename=$(basename -- "$snapshot_file")

  # Get location of file in Git tree.
  file_in_git=$(git ls-files '**/'"$filename")

  # Put new snapshot file in old Git location.
  cp "$snapshot_file" "$file_in_git"

  echo "Updated $file_in_git"
done


rm -rf ${tmp_dir}
echo "Removed ${tmp_dir}"


echo ""
echo "🐣 DONE-ZO!"
