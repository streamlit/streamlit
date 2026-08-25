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

"""Type tests for st.rerun.

``st.rerun()`` returns ``NoReturn``, so mypy marks all code after the first
call unreachable.  Import the unwrapped function directly so the signature
isn't erased by ``@gather_metrics``, and keep a single positive assertion.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, NoReturn

from typing_extensions import assert_type

if TYPE_CHECKING:
    from streamlit.commands.execution_control import rerun

    # st.rerun() returns NoReturn for all scope variants.
    assert_type(rerun(), NoReturn)
