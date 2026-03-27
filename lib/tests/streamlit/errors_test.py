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

"""Tests for streamlit.errors - focused on classes with non-trivial logic."""

from __future__ import annotations

import pytest

from streamlit import errors

# LocalizableStreamlitException tests


def test_localizable_exception_message_formatting() -> None:
    """Test that message is properly formatted with kwargs."""
    exc = errors.LocalizableStreamlitException(
        "Value {value} is invalid for {param}",
        value=42,
        param="test_param",
    )
    assert str(exc) == "Value 42 is invalid for test_param"


def test_localizable_exception_exec_kwargs_property() -> None:
    """Test that exec_kwargs stores the kwargs for localization."""
    exc = errors.LocalizableStreamlitException(
        "Error with {key}",
        key="test_value",
        extra="data",
    )
    assert exc.exec_kwargs == {"key": "test_value", "extra": "data"}


def test_localizable_exception_exec_kwargs_empty() -> None:
    """Test exec_kwargs is empty when no kwargs provided."""
    exc = errors.LocalizableStreamlitException("Simple message")
    assert exc.exec_kwargs == {}


# StreamlitAPIWarning tests


def test_api_warning_captures_stack_trace() -> None:
    """Test that tacked_on_stack is captured on creation."""
    warning = errors.StreamlitAPIWarning("Test warning")
    assert warning.tacked_on_stack is not None
    assert len(warning.tacked_on_stack) > 0
    # Stack should include this test file
    filenames = [frame.filename for frame in warning.tacked_on_stack]
    assert any("errors_test.py" in f for f in filenames)


def test_api_warning_repr() -> None:
    """Test __repr__ returns expected format."""
    warning = errors.StreamlitAPIWarning("Test message")
    assert "StreamlitAPIWarning" in repr(warning)


# StreamlitMixedNumericTypesError tests


def test_mixed_numeric_types_error_all_types() -> None:
    """Test message when all numeric args have different types."""
    exc = errors.StreamlitMixedNumericTypesError(
        value=1.0,
        min_value=1,
        max_value=10.0,
        step=2,
    )
    msg = str(exc)
    assert "float" in msg
    assert "int" in msg
    assert "`value`" in msg
    assert "`min_value`" in msg


def test_mixed_numeric_types_error_zero_values() -> None:
    """Test that zero values are included in the message (not treated as falsy)."""
    exc = errors.StreamlitMixedNumericTypesError(
        value=0,
        min_value=0,
        max_value=0.0,
        step=0,
    )
    msg = str(exc)
    # All parameters should be included even though they are zero
    assert "`value`" in msg
    assert "`min_value`" in msg
    assert "`max_value`" in msg
    assert "`step`" in msg


def test_mixed_numeric_types_error_partial() -> None:
    """Test message when only some args are provided."""
    exc = errors.StreamlitMixedNumericTypesError(
        value=1.0,
        min_value=None,
        max_value=10,
        step=None,
    )
    msg = str(exc)
    assert "`value`" in msg
    assert "`max_value`" in msg
    assert "`min_value`" not in msg
    assert "`step`" not in msg


# StreamlitPageNotFoundError tests


def test_page_not_found_with_pages_directory() -> None:
    """Test message when using pages/ directory pattern."""
    exc = errors.StreamlitPageNotFoundError(
        page="missing_page.py",
        main_script_directory="/app/my_app",
        uses_pages_directory=True,
    )
    msg = str(exc)
    assert "pages/" in msg
    assert "my_app" in msg


def test_page_not_found_without_pages_directory() -> None:
    """Test message when using st.navigation pattern."""
    exc = errors.StreamlitPageNotFoundError(
        page="missing_page.py",
        main_script_directory="/app/my_app",
        uses_pages_directory=False,
    )
    msg = str(exc)
    assert "st.Page" in msg
    assert "st.navigation" in msg


# StreamlitSelectionCountExceedsMaxError tests


@pytest.mark.parametrize(
    ("current", "max_sel", "expected_current_noun", "expected_options_noun"),
    [
        (1, 1, "option", "option"),
        (2, 1, "options", "option"),
        (1, 3, "option", "options"),
        (5, 3, "options", "options"),
    ],
)
def test_selection_count_exceeds_max_pluralization(
    current: int, max_sel: int, expected_current_noun: str, expected_options_noun: str
):
    """Test that singular/plural nouns are used correctly."""
    exc = errors.StreamlitSelectionCountExceedsMaxError(
        current_selections_count=current,
        max_selections_count=max_sel,
    )
    msg = str(exc)
    assert f"{current} {expected_current_noun}" in msg
    assert f"{max_sel} {expected_options_noun}" in msg


# StreamlitInvalidMaxError tests


def test_invalid_max_error_without_corrective_action() -> None:
    """Test message without corrective action."""
    exc = errors.StreamlitInvalidMaxError(
        widget_name="st.multiselect",
        parameter_name="max_selections",
        value=-1,
    )
    msg = str(exc)
    assert "st.multiselect" in msg
    assert "max_selections" in msg
    assert "-1" in msg


def test_invalid_max_error_with_corrective_action() -> None:
    """Test message includes corrective action when provided."""
    exc = errors.StreamlitInvalidMaxError(
        widget_name="st.text_input",
        parameter_name="max_chars",
        value=0,
        corrective_action="Set it to None to allow unlimited characters.",
    )
    msg = str(exc)
    assert "Set it to None" in msg


# StreamlitModuleNotFoundError tests


def test_module_not_found_error_message() -> None:
    """Test that message includes the missing module name."""
    exc = errors.StreamlitModuleNotFoundError("pandas")
    assert "pandas" in str(exc)
    assert "requires module" in str(exc)
