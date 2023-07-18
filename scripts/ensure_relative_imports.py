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

import os
import subprocess


def check_for_string_in_files(file_paths, search_string):
    for file_path in file_paths:
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            exit(1)

        with open(file_path, "r") as file:
            content = file.read()
            if search_string in content:
                print(f"Found '{search_string}' in {file_path}")
                exit(1)
            else:
                print(
                    "Success! Did not find relative pathing (../../..) in the lib/dist folder"
                )


def build_frontend_lib():
    try:
        subprocess.run(["yarn", "buildLib"], check=True, cwd="./frontend")
    except subprocess.CalledProcessError as e:
        print("Failed to build the necessary files.")
        exit(1)


if __name__ == "__main__":
    base_dir = "./frontend/lib/dist/components/core/Block/"
    block_js_path = os.path.join(base_dir, "Block.js")
    block_d_ts_path = os.path.join(base_dir, "Block.d.ts")

    search_string = "@streamlit/lib/src"

    if not os.path.exists("./frontend/lib/dist"):
        print(
            "Directory './frontend/lib/dist' not found. Building the necessary files..."
        )
        build_frontend_lib()

    check_for_string_in_files([block_js_path, block_d_ts_path], search_string)
