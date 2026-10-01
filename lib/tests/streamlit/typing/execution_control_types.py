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

"""Type tests for st.stop and st.switch_page.

``st.stop()`` and ``st.switch_page()`` are annotated as ``NoReturn``, so type
checkers treat later statements in the same block as unreachable (including
after an invalid call whose error is suppressed). Each case lives in its own
function so every check stays reachable. Import the commands from
``execution_control``, matching other command typing tests.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, NoReturn

from typing_extensions import assert_type

if TYPE_CHECKING:
    from pathlib import Path

    from streamlit.commands.execution_control import stop, switch_page
    from streamlit.navigation.page import Page

    # =====================================================================
    # st.stop return type tests
    # =====================================================================

    def _stop_returns_noreturn() -> None:
        # Basic usage - returns NoReturn (halts script execution)
        assert_type(stop(), NoReturn)

    # =====================================================================
    # Invalid st.stop usages - should NOT type check
    # =====================================================================

    def _stop_rejects_positional_arg() -> None:
        stop("reason")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    def _stop_rejects_key_arg() -> None:
        stop(key="stop")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]

    def _stop_rejects_help_arg() -> None:
        stop(help="Stop the script")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]

    # =====================================================================
    # st.switch_page return type tests
    # =====================================================================

    def _switch_page_str_path() -> None:
        # page accepts a path string
        assert_type(switch_page("pages/page_1.py"), NoReturn)

    def _switch_page_keyword_page() -> None:
        assert_type(switch_page(page="your_app.py"), NoReturn)

    def _switch_page_pathlib_path() -> None:
        assert_type(switch_page(Path("pages/page_2.py")), NoReturn)

    def _switch_page_page_object() -> None:
        # Callables must be wrapped in Page; Page itself is accepted
        assert_type(switch_page(Page("page_2.py")), NoReturn)

    def _switch_page_query_params_mapping() -> None:
        assert_type(
            switch_page("page_2.py", query_params={"utm_source": "page_1"}),
            NoReturn,
        )

    def _switch_page_query_params_mapping_list_value() -> None:
        # Repeated query values are accepted as a list of strings.
        assert_type(
            switch_page("page_2.py", query_params={"stream": ["lit", "rocks"]}),
            NoReturn,
        )

    def _switch_page_query_params_items() -> None:
        assert_type(
            switch_page(
                "page_2.py",
                query_params=[("foo", "bar"), ("stream", ["lit", "rocks"])],
            ),
            NoReturn,
        )

    def _switch_page_query_params_none() -> None:
        # None clears non-embed query params (the default)
        assert_type(switch_page("page_2.py", query_params=None), NoReturn)

    def _switch_page_all_parameters() -> None:
        assert_type(
            switch_page(
                Page("page_2.py"),
                query_params={"utm_source": "page_1"},
            ),
            NoReturn,
        )

    # =====================================================================
    # Invalid st.switch_page usages - should NOT type check
    # =====================================================================

    def _switch_page_missing_page() -> None:
        switch_page()  # type: ignore[call-arg]  # ty: ignore[missing-argument]

    def _switch_page_rejects_int_page() -> None:
        switch_page(1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _switch_page_rejects_none_page() -> None:
        switch_page(None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _switch_page_rejects_callable_page() -> None:
        def page_fn() -> None:
            pass

        switch_page(page_fn)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _switch_page_rejects_positional_query_params() -> None:
        switch_page("page_2.py", {"utm_source": "page_1"})  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    def _switch_page_rejects_str_query_params() -> None:
        switch_page("page_2.py", query_params="not valid")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _switch_page_rejects_int_query_params() -> None:
        switch_page("page_2.py", query_params=1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _switch_page_rejects_int_query_param_value() -> None:
        switch_page("page_2.py", query_params={"n": 1})  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _switch_page_rejects_unknown_arg() -> None:
        switch_page("page_2.py", help="Go")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
