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

"""Type tests for st.dialog."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

if TYPE_CHECKING:
    from streamlit.elements.dialog_decorator import dialog_decorator as dialog

    # =====================================================================
    # st.dialog return type tests
    #
    # ``@st.dialog("title")`` returns a decorator that preserves the wrapped
    # function's call signature, so calling the decorated function returns the
    # wrapped function's original return type.
    # =====================================================================

    # Basic usage - decorated function keeps its signature and return type.
    @dialog("My dialog")
    def basic_dialog(item: str) -> None: ...

    assert_type(basic_dialog("A"), None)

    # A non-``None`` return type is preserved. This guards against a regression
    # that hard-codes the decorated function's return type to ``None`` instead
    # of preserving the wrapped function's original return type.
    @dialog("Returns int")
    def int_return_dialog(item: str) -> int: ...

    assert_type(int_return_dialog("A"), int)

    # width - each literal option.
    @dialog("Small", width="small")
    def small_dialog() -> None: ...

    @dialog("Medium", width="medium")
    def medium_dialog() -> None: ...

    @dialog("Large", width="large")
    def large_dialog() -> None: ...

    assert_type(small_dialog(), None)
    assert_type(medium_dialog(), None)
    assert_type(large_dialog(), None)

    # dismissible - both boolean values.
    @dialog("Dismissible", dismissible=True)
    def dismissible_dialog() -> None: ...

    @dialog("Not dismissible", dismissible=False)
    def non_dismissible_dialog() -> None: ...

    assert_type(dismissible_dialog(), None)
    assert_type(non_dismissible_dialog(), None)

    # icon - emoji, material icon, and None.
    @dialog("Emoji icon", icon="🚨")
    def emoji_icon_dialog() -> None: ...

    @dialog("Material icon", icon=":material/warning:")
    def material_icon_dialog() -> None: ...

    @dialog("No icon", icon=None)
    def no_icon_dialog() -> None: ...

    assert_type(emoji_icon_dialog(), None)
    assert_type(material_icon_dialog(), None)
    assert_type(no_icon_dialog(), None)

    # on_dismiss - "ignore", "rerun", and a callback.
    @dialog("Ignore", on_dismiss="ignore")
    def ignore_dialog() -> None: ...

    @dialog("Rerun", on_dismiss="rerun")
    def rerun_dialog() -> None: ...

    def on_dismiss_callback() -> None: ...

    @dialog("Callback", on_dismiss=on_dismiss_callback)
    def callback_dialog() -> None: ...

    assert_type(ignore_dialog(), None)
    assert_type(rerun_dialog(), None)
    assert_type(callback_dialog(), None)

    # A dialog function with multiple arguments keeps its full signature.
    @dialog("With args")
    def dialog_with_args(item: str, count: int) -> None: ...

    assert_type(dialog_with_args("A", 1), None)

    # All parameters combined.
    @dialog(
        "Everything",
        width="large",
        dismissible=False,
        icon=":material/thumb_up:",
        on_dismiss="rerun",
    )
    def full_dialog(value: int) -> None: ...

    assert_type(full_dialog(1), None)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # width only accepts "small", "medium", or "large".
    dialog("Bad width", width="invalid")  # type: ignore[call-overload]

    # dismissible must be a bool.
    dialog("Bad dismissible", dismissible="yes")  # type: ignore[call-overload]

    # icon must be a str or None.
    dialog("Bad icon", icon=123)  # type: ignore[call-overload]

    # on_dismiss only accepts "ignore", "rerun", or a callable.
    dialog("Bad on_dismiss", on_dismiss="invalid")  # type: ignore[call-overload]

    # Decorator options are keyword-only and can't be passed positionally.
    dialog("Positional option", "small")  # type: ignore[call-overload]
