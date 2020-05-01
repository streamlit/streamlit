# Copyright 2018-2020 Streamlit Inc.
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

import streamlit as st
import sys

# # Uncomment this as a block.
# # This tests that errors before the first st call get caught.
# def foo():
     # EXPECTED: inline exception
     # a = not_a_real_variable  # noqa: F821 pylint:disable=undefined-variable,unused-variable

# foo()

# # Uncomment this as a block.
# # This tests that errors before the first st call get caught.
# if True  # EXPECTED: modal dialog

st.title("Syntax error test")

st.info("Uncomment the comment blocks in the source code one at a time.")

st.write(
    """
    Here's the source file for you to edit:
    ```
    examples/syntax_error.py
    ```
    """
)

st.write("(Some top text)")

# # Uncomment this as a block.
# a = not_a_real_variable  # EXPECTED: inline exception.

# # Uncomment this as a block.
# if True  # EXPECTED: modal dialog

# # Uncomment this as a block.
# sys.stderr.write('Hello!\n')  # You should not see this.
# # The line below is a compile-time error. Bad indentation.
#        this_indentation_is_wrong = True  # EXPECTED: modal dialog

# # Uncomment this as a block.
# # This tests that errors after the first st call get caught.
# a = not_a_real_variable  # EXPECTED: inline exception.

st.write("(Some bottom text)")
