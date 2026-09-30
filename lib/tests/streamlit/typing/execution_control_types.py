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

"""Type tests for st.stop.

``st.stop()`` returns ``NoReturn``, so a successful (or ignored) call makes
later statements in the same block unreachable. Each case lives in its own
function so invalid-argument checks stay reachable. Import the function from
``execution_control`` so the signature isn't erased by ``@gather_metrics``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, NoReturn

from typing_extensions import assert_type

if TYPE_CHECKING:
    from streamlit.commands.execution_control import stop

    # =====================================================================
    # st.stop return type tests
    # =====================================================================

    def _stop_returns_noreturn() -> None:
        # Basic usage - returns NoReturn (halts script execution)
        assert_type(stop(), NoReturn)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    def _stop_rejects_positional_arg() -> None:
        stop("reason")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    def _stop_rejects_keyword_arg() -> None:
        stop(key="stop")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]

    def _stop_rejects_help_arg() -> None:
        stop(help="Stop the script")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
