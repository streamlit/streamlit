# -*- coding: utf-8 -*-
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

MAX_DOCSTRING = 1000


def remove_declaration_and_docstring(lines):
    """Return a function's source code with the docstring removed.

    This function parses the source code of a function and removes the function
    declaration and the docstring if found. If no docstring is found and the
    function has no code, it returns an empty list. This function can be used
    in conjunction of inspect.getsourcelines(...) to get the source code
    lines of a function. If the docstring is longer than MAX_DOCSTRING lines
    it will not remove the docstring and raise an exception. The function also
    assumes that the input source code is syntactically correct.

    Parameters
    ----------
    lines : list of str
        Function source code lines.

    Returns
    -------
    list of str
        A copy of the input parameter `lines` where the function declaration
        and the docstring is removed.

    """
    if len(lines) == 0:
        raise Exception("You should pass code with a function declaration included")
    # lines contains only the function declaration
    if len(lines) <= 1:
        return []
    # The docstring is on one line - assuming it is syntactically correct
    stripped = lines[1].strip()
    if len(stripped) >= 6 and stripped[:3] == '"""' and stripped[-3:] == '"""':
        return lines[2:]
    # The docstring is on multiple lines or there is no docstring
    if stripped[:3] != '"""':
        return lines[1:]
    # lines[2] is the first line of the docstring, past the initial """
    # if the code is correct, lines[2] must exist
    index = 2
    while '"""' not in lines[index]:
        index += 1
        # Limit to MAX_DOCSTRING lines, if the docstring is longer, just bail
        if index > MAX_DOCSTRING:
            raise Exception(
                "Docstring is too long for remove_declaration_and_docstring"
            )
    # lines[index] is the closing """
    return lines[index + 1 :]
