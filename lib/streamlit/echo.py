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

import contextlib
import re
import textwrap
import traceback
from typing import List

_SPACES_RE = re.compile("\\s*")


@contextlib.contextmanager
def echo(code_location="above"):
    """Use in a `with` block to draw some code on the app, then execute it.

    Parameters
    ----------
    code_location : "above" or "below"
        Whether to show the echoed code before or after the results of the
        executed code block.

    Example
    -------

    >>> with st.echo():
    >>>     st.write('This code will be printed')

    """

    from streamlit import code, warning, empty, source_util

    if code_location == "below":
        show_code = code
        show_warning = warning
    else:
        placeholder = empty()
        show_code = placeholder.code
        show_warning = placeholder.warning

    try:
        # Get stack frame *before* running the echoed code. The frame's
        # line number will point to the `st.echo` statement we're running.
        frame = traceback.extract_stack()[-3]
        filename, start_line = frame.filename, frame.lineno

        # Run the echoed code.
        yield

        # Get stack frame *after* running code. This frame's line number will
        # point to the last line in the echoed code.
        frame = traceback.extract_stack()[-3]
        end_line = frame.lineno

        # Open the file containing the source code of the echoed statement,
        # and extract the lines inside the `with st.echo` block.
        lines_to_display: List[str] = []
        with source_util.open_python_file(filename) as source_file:
            source_lines = source_file.readlines()
            lines_to_display.extend(source_lines[start_line:end_line])

            # Our "end_line" is not necessarily the last line in the echo
            # block. Iterate over the remaining lines in the source file
            # until we find one that's indented less than the rest of the
            # block. Note that this is *not* a perfect strategy, because
            # de-denting is not guaranteed to signal "end of block". (A
            # triple-quoted string might be dedented but still in the
            # echo block, for example.)
            if len(lines_to_display) > 0:
                match = _SPACES_RE.match(lines_to_display[0])
                initial_spaces = match.end() if match else 0
                for line in source_lines[end_line:]:
                    match = _SPACES_RE.match(line)
                    indentation = match.end() if match else 0
                    # The != 1 is because we want to allow '\n' between sections.
                    if indentation != 1 and indentation < initial_spaces:
                        break
                    lines_to_display.append(line)

        line_to_display = textwrap.dedent("".join(lines_to_display))
        show_code(line_to_display, "python")

    except FileNotFoundError as err:
        show_warning("Unable to display code. %s" % err)
