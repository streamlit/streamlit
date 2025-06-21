#!/bin/bash

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

# Function to search for the string recursively in .ts and .js files
search_files() {
    local folder="$1"
    local search_string="$2"

    echo "Searching for $search_string within the $folder folder..."
    # Use find to recursively search for .ts and .js files in the folder
    while IFS= read -r -d '' file; do
        # Check if the file has a .ts or .js extension
        if [[ "$file" == *.ts || "$file" == *.js ]]; then
            # Check if the search string does not exist in the file
            if grep -q "$search_string" "$file"; then
                echo "The string '$search_string' found in: $file"
                exit 1
            fi
        fi
    done < <(find "$folder" -type f -print0)
    echo "Done!"
}

# Set the folder path and the search string
folder_path="frontend/lib/dist"
search_string="~lib"

# Call the function to search for the string in .ts and .js files
search_files "$folder_path" "$search_string"
