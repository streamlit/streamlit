# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""AppTest errors.

Kept in a dedicated module so ``AppTestError`` can inherit from the builtin
``Exception`` without colliding with the ``Exception`` element class in
``element_tree``.
"""

from __future__ import annotations


class AppTestError(Exception):
    """Raised when an AppTest query or interaction is invalid.

    AppTest can run apps that contain unimplemented or browser-only elements.
    This error is reserved for an explicit test action that a browser user
    could not perform, such as updating a disabled widget.
    """
