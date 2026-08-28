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

import ast
import re
from collections import Counter
from pathlib import Path

import pytest

from streamlit import errors

_KEBAB_CASE_ERROR_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Bare ``StreamlitAPIException`` constructions without ``error_id`` are pending
# migration to a specialized type in ``errors.py``. Do not tag them with
# ``error_id``; migrate them in a follow-up instead.
_UNTAGGED_STREAMLIT_API_EXCEPTION_SITES: dict[str, int] = {
    "components/v2/__init__.py": 1,
    "connections/sql_connection.py": 2,
    "dataframe/lazy_df_source.py": 3,
    "elements/arrow.py": 3,
    "elements/deck_gl_json_chart.py": 2,
    "elements/lib/built_in_chart_utils.py": 2,
    "elements/markdown.py": 1,
    "elements/pdf.py": 1,
    "elements/pyplot.py": 1,
    "elements/vega_charts.py": 3,
    "elements/widgets/button_group.py": 1,
    "elements/widgets/color_picker.py": 2,
    "elements/widgets/pagination.py": 2,
    "elements/widgets/slider.py": 1,
    "elements/write.py": 1,
    "runtime/connection_factory.py": 1,
    "runtime/fragment.py": 1,
    "runtime/theme_util.py": 2,
    "web/server/starlette/starlette_app.py": 1,
}


def _is_streamlit_api_exception_call(func: ast.expr) -> bool:
    if isinstance(func, ast.Name):
        return func.id == "StreamlitAPIException"
    return isinstance(func, ast.Attribute) and func.attr == "StreamlitAPIException"


def _iter_streamlit_api_exception_calls() -> list[tuple[str, ast.Call]]:
    """Return production ``StreamlitAPIException(...)`` calls as (relative path, node)."""
    lib_root = Path(errors.__file__).parent
    calls: list[tuple[str, ast.Call]] = []
    for path in lib_root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and _is_streamlit_api_exception_call(
                node.func
            ):
                calls.append((str(path.relative_to(lib_root)), node))
    return calls


# StreamlitAPIException tests


def test_api_exception_error_id_defaults_to_none() -> None:
    """Bare constructions keep ``error_id`` unset so existing callers stay valid."""
    exc = errors.StreamlitAPIException("oh no")
    assert str(exc) == "oh no"
    assert exc.error_id is None


def test_api_exception_stores_error_id() -> None:
    """``error_id`` is stored on the exception and does not change the message."""
    exc = errors.StreamlitAPIException(
        "Failed to load secrets",
        error_id="failed-loading-secrets-file",
    )
    assert str(exc) == "Failed to load secrets"
    assert exc.error_id == "failed-loading-secrets-file"


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


def test_localizable_exception_error_id_is_reserved() -> None:
    """``error_id`` is stored on the exception and omitted from ``exec_kwargs``."""
    exc = errors.LocalizableStreamlitException(
        "Error parsing secrets file at {path}",
        path="secrets.toml",
        error_id="failed-parsing-secrets-file",
    )
    assert str(exc) == "Error parsing secrets file at secrets.toml"
    assert exc.error_id == "failed-parsing-secrets-file"
    assert exc.exec_kwargs == {"path": "secrets.toml"}


def test_streamlit_api_exception_error_ids_are_kebab_case() -> None:
    """Literal ``error_id`` values must be kebab-case slugs.

    ``ast.Name`` is allowed for computed category slugs (for example
    ``delta_generator``). Interpolated or call-built values are not.
    """
    invalid: list[str] = []
    for rel, node in _iter_streamlit_api_exception_calls():
        error_id_kw = next((kw for kw in node.keywords if kw.arg == "error_id"), None)
        if error_id_kw is None:
            continue
        value = error_id_kw.value
        if isinstance(value, ast.Name):
            continue
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            if not _KEBAB_CASE_ERROR_ID.fullmatch(value.value):
                invalid.append(f"{rel}:{node.lineno}:{value.value}")
            continue
        invalid.append(f"{rel}:{node.lineno}:{type(value).__name__}")
    assert invalid == [], "error_id values must be kebab-case:\n" + "\n".join(invalid)


def test_untagged_api_exceptions_are_pending_specialized_types() -> None:
    """Untagged ``StreamlitAPIException`` sites must stay on the specialized-type follow-up list.

    New one-off raises should pass ``error_id``. Sites in the allowlist should be
    migrated to a specialized type in ``errors.py`` rather than tagged.
    """
    untagged: Counter[str] = Counter()
    for rel, node in _iter_streamlit_api_exception_calls():
        if not any(kw.arg == "error_id" for kw in node.keywords):
            untagged[rel] += 1
    assert dict(untagged) == _UNTAGGED_STREAMLIT_API_EXCEPTION_SITES


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


def test_page_not_found_during_construction() -> None:
    """st.Page file-not-found uses a construction-specific message."""
    exc = errors.StreamlitPageNotFoundError("nonexistent.py")
    assert (
        str(exc)
        == "Unable to create Page. The file `nonexistent.py` could not be found."
    )


def test_invalid_parameter_type_error_message() -> None:
    """The parameter, expected types, and provided type form one stable message."""
    exc = errors.StreamlitInvalidParameterTypeError("index", "str", ["int", "None"])
    assert (
        str(exc)
        == "Invalid `index` type. Expected one of: int, None. Provided type: str."
    )
    assert exc.exec_kwargs == {
        "parameter": "index",
        "expected_types": "int, None",
        "provided_type": "str",
        "detail": None,
    }


def test_invalid_parameter_type_error_with_detail() -> None:
    """Optional detail is appended and is not used as the telemetry parameter."""
    exc = errors.StreamlitInvalidParameterTypeError(
        "tabs",
        "bool",
        ["str"],
        detail="Each tab label must be a string.",
    )
    assert str(exc) == (
        "Invalid `tabs` type. Expected one of: str. Provided type: bool. "
        "Each tab label must be a string."
    )
    assert exc.exec_kwargs["parameter"] == "tabs"
    assert exc.exec_kwargs["detail"] == "Each tab label must be a string."


def test_value_error_with_detail() -> None:
    """Optional detail is appended and is not used as the telemetry parameter."""
    exc = errors.StreamlitValueError(
        "scope",
        ["'global'", "'session'"],
        detail="Connection class Foo has an invalid scope.",
    )
    assert str(exc) == (
        "Invalid `scope` value. Supported values: 'global', 'session'. "
        "Connection class Foo has an invalid scope."
    )
    assert exc.exec_kwargs["parameter"] == "scope"
    assert exc.exec_kwargs["detail"] == "Connection class Foo has an invalid scope."


def test_widget_already_instantiated_error_message() -> None:
    """Session-state assignment after widget creation names the key."""
    exc = errors.StreamlitWidgetAlreadyInstantiatedError("my_key")
    assert "`st.session_state.my_key`" in str(exc)
    assert "instantiated" in str(exc)


def test_default_not_in_options_error_message() -> None:
    """Default-not-in-options names the missing value."""
    exc = errors.StreamlitDefaultNotInOptionsError("c")
    assert "The default value 'c' is not part of the options." in str(exc)
    assert "every default value also exists in the options." in str(exc)


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


# StreamlitInvalidMinMaxError tests


def test_invalid_min_max_error_message() -> None:
    """Min/max errors name both bounds."""
    exc = errors.StreamlitInvalidMinMaxError(10, 5)
    assert str(exc) == (
        "The `min_value`, set to 10, cannot be greater than the `max_value`, set to 5."
    )


def test_invalid_min_max_error_equal_bounds_message() -> None:
    """Equal bounds use a dedicated sentence instead of 'cannot be greater than'."""
    exc = errors.StreamlitInvalidMinMaxError(10, 10)
    assert str(exc) == (
        "The `min_value` and `max_value` parameters are both set to 10. "
        "They must not be equal."
    )


# StreamlitValueOutOfRangeError tests


def test_value_out_of_range_error_message() -> None:
    """Out-of-range errors name the parameter, value, and closed interval."""
    exc = errors.StreamlitValueOutOfRangeError("index", 5, 0, 2)
    assert str(exc) == (
        "The `index` parameter, set to 5, is outside the required range [0, 2]."
    )


def test_value_out_of_range_error_with_detail() -> None:
    """Optional detail is appended and is not used as the telemetry parameter."""
    exc = errors.StreamlitValueOutOfRangeError(
        "index",
        5,
        0,
        2,
        detail="Choose an index that exists in options.",
    )
    assert str(exc) == (
        "The `index` parameter, set to 5, is outside the required range [0, 2]. "
        "Choose an index that exists in options."
    )
    assert exc.exec_kwargs["parameter"] == "index"
    assert exc.exec_kwargs["detail"] == "Choose an index that exists in options."


# StreamlitInvalidURLError tests


def test_invalid_url_error_default_protocols() -> None:
    """One-argument constructor still mentions http, https, and mailto."""
    exc = errors.StreamlitInvalidURLError("www.example.com")
    assert '"http://", "https://", or "mailto:"' in str(exc)


# BidiComponentError tests


def test_bidi_component_error_hierarchy() -> None:
    """Specialized bidi errors share a ``BidiComponentError`` base."""
    exc = errors.BidiComponentInvalidIdError("base", "__")
    assert isinstance(exc, errors.BidiComponentError)


# StreamlitMissingRequiredParameterError tests


def test_missing_required_parameter_error_message() -> None:
    """Default message includes the parameter."""
    exc = errors.StreamlitMissingRequiredParameterError("label")
    assert str(exc) == "The `label` parameter is required."
    assert exc.exec_kwargs["parameter"] == "label"


def test_missing_required_parameter_error_with_detail() -> None:
    """Optional detail is appended to the default message."""
    exc = errors.StreamlitMissingRequiredParameterError(
        "body",
        detail="It cannot be blank.",
    )
    assert str(exc) == ("The `body` parameter is required. It cannot be blank.")


def test_missing_required_parameter_error_detail_with_braces() -> None:
    """Detail text with braces does not break message formatting."""
    exc = errors.StreamlitMissingRequiredParameterError(
        "title",
        detail="Example: use {value}.",
    )
    assert str(exc) == ("The `title` parameter is required. Example: use {value}.")


def test_incompatible_parameters_error_formats_uses() -> None:
    """Uses are joined into the user-facing message."""
    exc = errors.StreamlitIncompatibleParametersError(
        "wrap=False", "unsafe_allow_html=True"
    )
    assert str(exc) == (
        "`wrap=False` and `unsafe_allow_html=True` cannot be used together."
    )
    assert exc.exec_kwargs["uses"] == ["wrap=False", "unsafe_allow_html=True"]
    assert "parameter" not in exc.exec_kwargs


def test_incompatible_parameters_error_formats_three_uses() -> None:
    """Three uses are joined with an Oxford comma."""
    exc = errors.StreamlitIncompatibleParametersError(
        "refresh_mode='background'", "ttl", "persist='disk'"
    )
    assert str(exc) == (
        "`refresh_mode='background'`, `ttl`, and `persist='disk'` "
        "cannot be used together."
    )


def test_incompatible_parameters_error_requires_two_uses() -> None:
    """Fewer than two uses is a constructor contract violation."""
    with pytest.raises(TypeError, match="first_use"):
        errors.StreamlitIncompatibleParametersError()  # type: ignore[call-arg]
    with pytest.raises(TypeError, match="second_use"):
        errors.StreamlitIncompatibleParametersError("ttl")  # type: ignore[call-arg]


def test_incompatible_parameters_error_with_explanation() -> None:
    """Optional explanation is appended to the generic message."""
    exc = errors.StreamlitIncompatibleParametersError(
        "bind='query-params'",
        "type='password'",
        explanation="Password values must not appear in URLs.",
    )
    assert str(exc) == (
        "`bind='query-params'` and `type='password'` cannot be used together. "
        "Password values must not appear in URLs."
    )


def test_incompatible_parameters_error_explanation_with_braces() -> None:
    """Explanation text with braces does not break message formatting."""
    exc = errors.StreamlitIncompatibleParametersError(
        "refresh_mode='background'",
        "ttl=None",
        explanation="Example: use {value}.",
    )
    assert str(exc) == (
        "`refresh_mode='background'` and `ttl=None` cannot be used together. "
        "Example: use {value}."
    )
