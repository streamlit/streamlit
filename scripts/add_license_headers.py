#!/usr/bin/env python
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

"""Updates the license on all our source files."""
import sys
import os.path
import glob
from datetime import datetime


if sys.version_info < (3, 6):
    print("This script must be run with Python >= 3.6")
    sys.exit(-1)


FOLDERS = [os.path.abspath(os.path.normpath(x)) for x in sys.argv[1:]]

# TODO: Take these are input arguments.
EXCLUDE_PATTERNS = [
    "/autogen/",
    "/bin/",
    "/build/",
    "/gen/",
    "/static/",
    "/vendor/",
    "/node_modules/",
    "/cypress/",
    "/react-app-env.d.ts",
    "/css/variables.scss",  # scss-to-json doesn't like our normal header.
]

THIS_YEAR = datetime.now().year

# Linting: we don't wrap these line on purpose.
# No newline after the ''', so the header will not start with a linebreak.
HEADER_TEMPLATE = f"""%(open_header)s%(comment)s Copyright 2018-{THIS_YEAR} Streamlit Inc.
%(comment)s
%(comment)s Licensed under the Apache License, Version 2.0 (the "License");
%(comment)s you may not use this file except in compliance with the License.
%(comment)s You may obtain a copy of the License at
%(comment)s
%(comment)s    http://www.apache.org/licenses/LICENSE-2.0
%(comment)s
%(comment)s Unless required by applicable law or agreed to in writing, software
%(comment)s distributed under the License is distributed on an "AS IS" BASIS,
%(comment)s WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
%(comment)s See the License for the specific language governing permissions and
%(comment)s limitations under the License.%(close_header)s

"""
# The last line was left blank on purpose.


COMMENT_STYLES = {
    # extension : (open_header, comment, close_header)
    "html": ("<!--\n", "", "\n-->"),
    "css": ("/**\n", " *", "\n */"),
    "scss": ("/**\n", " *", "\n */"),
    "js": ("/**\n * @license\n", " *", "\n */"),
    "jsx": ("/**\n * @license\n", " *", "\n */"),
    "ts": ("/**\n * @license\n", " *", "\n */"),
    "tsx": ("/**\n * @license\n", " *", "\n */"),
    "proto": ("/**\n", " *", "\n*/"),
    "py": ("", "#", ""),
    "sh": ("", "#", ""),
}


def get_glob_string(folder, extension):
    return "%s/**/*.%s" % (folder, extension)


def get_header_bounds(lines, comment_style):
    start_line = 0
    end_line = 0

    if not lines:
        return start_line, end_line

    # Detect shebang.
    if lines[0].startswith("#!"):
        start_line = 1
        end_line = start_line

    # Detect old header.

    def has_more_lines(end_line):
        return end_line < len(lines)

    opener_lines = comment_style[0].split() or [""]
    comment_prefix = comment_style[1]
    closer_lines = comment_style[2].split() or [""]

    # Try to match header opener lines.
    for curr_opener_line in opener_lines:
        if not has_more_lines(end_line):
            break
        if lines[end_line][:-1] != curr_opener_line:
            break
        end_line += 1

    # Try to match header body.
    while (
        has_more_lines(end_line)
        and lines[end_line].startswith(comment_prefix)
        and lines[end_line][:-1] != closer_lines[0]
    ):
        end_line += 1

    # Try to match header closer lines.
    for curr_closer_line in closer_lines:
        if not has_more_lines(end_line):
            break
        if lines[end_line][:-1] != curr_closer_line:
            break
        end_line += 1

    # Remove unecessary newlines.
    while has_more_lines(end_line) and len(lines[end_line].strip()) == 0:
        end_line += 1

    return start_line, end_line


glob_to_comment_style = {
    get_glob_string(folder, extension): COMMENT_STYLES[extension]
    for folder in FOLDERS
    for extension in COMMENT_STYLES
}


print("Starting...")
files_seen = 0
files_modified = 0

for glob_pattern, comment_style in glob_to_comment_style.items():
    print("Pattern %s:" % glob_pattern)

    filenames = glob.glob(glob_pattern, recursive=True)

    if not filenames:
        continue

    for filename in filenames:
        files_seen += 1

        if any(pattern in filename for pattern in EXCLUDE_PATTERNS):
            continue

        print(filename)

        with open(filename, "r") as the_file:
            lines = the_file.readlines()

        file_body = "\n".join(lines)

        old_header_start, old_header_end = get_header_bounds(lines, comment_style)

        header = HEADER_TEMPLATE % {
            "open_header": comment_style[0],
            "comment": comment_style[1],
            "close_header": comment_style[2],
        }

        with open(filename, "w") as the_file:
            for l in lines[:old_header_start]:
                the_file.write(l)

            the_file.write(header)

            for l in lines[old_header_end:]:
                the_file.write(l)

            files_modified += 1

    print("")

print(
    f"""
Done!
Saw {files_seen} files.
Modified {files_modified} files.
"""
)
