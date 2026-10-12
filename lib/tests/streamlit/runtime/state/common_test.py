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

import pytest

from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.runtime.state.common import validate_on_change_mode


def test_validate_on_change_mode_returns_callback() -> None:
    """A callback is returned unchanged."""

    def callback() -> None:
        pass

    assert (
        validate_on_change_mode(callback, supported_modes=(), param_name="on_click")
        is callback
    )


@pytest.mark.parametrize("mode", ["ignore", "rerun"])
def test_validate_on_change_mode_normalizes_supported_mode(mode: str) -> None:
    """Supported modes normalize to no callback."""
    assert validate_on_change_mode(mode, supported_modes=("rerun", "ignore")) is None


@pytest.mark.parametrize("mode", ["ignore", "rerun"])
def test_validate_on_change_mode_rejects_unsupported_mode(mode: str) -> None:
    """A recognized mode gets a widget-specific unsupported-mode error."""
    with pytest.raises(
        StreamlitAPIException,
        match=f'`on_click="{mode}"` is not supported on this widget',
    ):
        validate_on_change_mode(
            mode,
            supported_modes=(),
            param_name="on_click",
        )


def test_validate_on_change_mode_rejects_mode_not_supported_by_widget() -> None:
    """Widgets can support one mode without implicitly supporting every mode."""
    with pytest.raises(
        StreamlitAPIException,
        match='`on_change="ignore"` is not supported on this widget',
    ):
        validate_on_change_mode(
            "ignore",
            supported_modes=("rerun",),
        )


def test_validate_on_change_mode_lists_supported_modes_for_invalid_value() -> None:
    """The invalid-value error lists modes only when the widget supports them."""
    with pytest.raises(StreamlitValueError, match="Invalid `on_submit` value") as exc:
        validate_on_change_mode(
            "not-a-mode",
            supported_modes=("rerun", "ignore"),
            param_name="on_submit",
        )

    message = str(exc.value)
    assert "'ignore'" in message
    assert "'rerun'" in message
    assert "a callback function" in message


def test_validate_on_change_mode_lists_only_widget_supported_modes() -> None:
    """Invalid-value errors advertise only modes supported by that widget."""
    with pytest.raises(StreamlitValueError) as exc:
        validate_on_change_mode(
            "not-a-mode",
            supported_modes=("rerun",),
        )

    message = str(exc.value)
    assert "'rerun'" in message
    assert "'ignore'" not in message


def test_validate_on_change_mode_excludes_modes_for_callback_only_widget() -> None:
    """Callback-only widgets do not advertise callback modes as valid values."""
    with pytest.raises(StreamlitValueError, match="Invalid `on_change` value") as exc:
        validate_on_change_mode("not-a-mode", supported_modes=())

    message = str(exc.value)
    assert "'ignore'" not in message
    assert "'rerun'" not in message
    assert "a callback function" in message


def test_validate_on_change_mode_rejects_none_when_unsupported() -> None:
    """Elements without a None alias reject None through the same validator."""
    with pytest.raises(StreamlitValueError, match="Invalid `on_select` value"):
        validate_on_change_mode(
            None,
            supported_modes=("rerun", "ignore"),
            none_supported=False,
            param_name="on_select",
        )
