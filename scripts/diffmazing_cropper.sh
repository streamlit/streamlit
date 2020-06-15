#!/bin/bash
#
# Converts diff images from Cypress into snapshots we can commit to Git.


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


has_convert=$(command -v convert)
if ! [ "$has_convert" ]
then
  echo ""
  echo "Missing dependency."
  echo "Please install ImageMagick first."
  echo ""
  exit -1
fi



tmp_dir="$(mktemp -d -t streamlit_cropped_diffs)"
### snapshots_folder=frontend/cypress/snapshots/linux/2x/

diff_files=("$@")
len=${#diff_files[@]}

mkdir -p "$tmp_dir"
rm -f "$tmp_dir"/*


# Crop diff files so we get non-diff files.
# This puts all non-diff files in $tmp_dir
for (( i=0; i<${len}; i++ ))
do
  diff_file="${diff_files[$i]}"
  filename=$(basename -- "$diff_file")  # filename=foo.diff.png
  filename="${filename%.*}"  # Remove .png
  filename="${filename%.*}"  # Remove .diff

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
  filename=$(basename -- "$snapshot_file")  # filename=foo.snap.png

  # Get location of file in Git tree.
  file_in_git=$(git ls-files '**/'"$filename")

  # Put new snapshot file in old Git location.
  cp "$snapshot_file" "$file_in_git"

  echo "Updated $file_in_git"
done


echo ""
echo "🐣 DONE-ZO!"
