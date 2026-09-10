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

from __future__ import annotations

import pytest

import streamlit as st
from streamlit.command_suggestions import (
    _PUBLIC_STREAMLIT_NAMESPACES,
    _REMOVED_STREAMLIT_ATTRIBUTES,
    _format_st_names,
    missing_streamlit_attribute_message,
    public_streamlit_names,
    suggest_streamlit_commands,
)
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.metrics_util import format_uncaught_exception


def _missing_attr(name: str) -> AttributeError:
    """Access a missing ``st.*`` name and return the raised AttributeError."""
    with pytest.raises(AttributeError) as exc_info:
        getattr(st, name)
    return exc_info.value


@pytest.mark.parametrize(
    ("old_name", "expected_replacement"),
    [
        ("experimental_rerun", "st.rerun"),
        ("experimental_memo", "st.cache_data"),
        ("experimental_singleton", "st.cache_resource"),
        ("experimental_data_editor", "st.data_editor"),
        ("experimental_connection", "st.connection"),
        ("experimental_user", "st.user"),
        ("experimental_dialog", "st.dialog"),
        ("experimental_fragment", "st.fragment"),
        ("experimental_audio_input", "st.audio_input"),
        ("experimental_get_query_params", "st.query_params"),
        ("experimental_set_query_params", "st.query_params"),
        ("experimental_show", "st.write"),
        ("beta_columns", "st.columns"),
        ("beta_expander", "st.expander"),
        ("beta_container", "st.container"),
        ("beta_secrets", "st.secrets"),
        ("beta_color_picker", "st.color_picker"),
        ("beta_set_page_config", "st.set_page_config"),
    ],
)
def test_removed_attributes_name_the_replacement(
    old_name: str, expected_replacement: str
) -> None:
    """Removed public names raise AttributeError pointing at the successor API."""
    error = _missing_attr(old_name)
    message = str(error)
    assert "has been removed" in message
    assert expected_replacement in message
    assert f"module 'streamlit' has no attribute '{old_name}'" in message
    assert error.name == old_name
    assert error.obj is st
    assert not isinstance(error, StreamlitAPIException)
    assert format_uncaught_exception(error) == f"AttributeError:{old_name}"


def test_removed_cache_lists_both_successors() -> None:
    """``st.cache`` names both replacements instead of choosing one alias."""
    error = _missing_attr("cache")
    message = str(error)
    assert "has been removed" in message
    assert "st.cache_data" in message
    assert "st.cache_resource" in message
    assert format_uncaught_exception(error) == "AttributeError:cache"


def test_input_lists_input_widget_commands() -> None:
    """``st.input`` lists the input-widget family instead of failing with no advice."""
    error = _missing_attr("input")
    message = str(error)
    assert "Use a specific input command" in message
    assert "st.info" not in message
    for command in (
        "audio_input",
        "camera_input",
        "chat_input",
        "date_input",
        "datetime_input",
        "number_input",
        "text_input",
        "time_input",
    ):
        assert f"st.{command}" in message
    assert format_uncaught_exception(error) == "AttributeError:input"


@pytest.mark.parametrize(
    ("typo", "expected"),
    [
        ("text_inpt", "text_input"),
        ("numberinput", "number_input"),
        ("sessionstate", "session_state"),
        ("wrtie", "write"),
        ("colums", "columns"),
    ],
)
def test_typo_suggestions_use_the_public_command(typo: str, expected: str) -> None:
    """Close typos suggest the matching public command."""
    error = _missing_attr(typo)
    assert "Did you mean" in str(error)
    assert f"st.{expected}" in str(error)
    assert format_uncaught_exception(error) == f"AttributeError:{typo}"


def test_unrelated_names_keep_the_standard_attribute_error() -> None:
    """Unknown names with no close public match keep the standard message."""
    error = _missing_attr("zzzz_not_a_command")
    assert str(error) == "module 'streamlit' has no attribute 'zzzz_not_a_command'"
    assert error.name == "zzzz_not_a_command"
    assert error.obj is st
    assert format_uncaught_exception(error) == "AttributeError:zzzz_not_a_command"


def test_mapped_successors_and_namespaces_still_exist() -> None:
    """Advertised replacements and public namespaces remain on ``st``."""
    catalog = public_streamlit_names(st)
    for replacements in _REMOVED_STREAMLIT_ATTRIBUTES.values():
        for replacement in replacements:
            assert replacement in catalog
    for namespace in _PUBLIC_STREAMLIT_NAMESPACES:
        assert namespace in catalog


def test_format_does_not_suggest_form() -> None:
    """``st.format`` is not a one-character typo of ``st.form``."""
    error = _missing_attr("format")
    assert str(error) == "module 'streamlit' has no attribute 'format'"
    assert "st.form" not in str(error)


def test_suggestions_exclude_internal_modules() -> None:
    """Leaked internal modules are not part of the suggestion catalog."""
    catalog = public_streamlit_names(st)
    assert "error_util" not in catalog
    assert "config_util" not in catalog
    assert "logger" not in catalog
    assert "button" in catalog
    assert "session_state" in catalog
    assert "column_config" in catalog
    assert "components" in catalog
    assert "typing" in catalog
    assert suggest_streamlit_commands("error_util", catalog) == ()

    error = _missing_attr("erro_util")
    assert "Did you mean" not in str(error)


def test_existing_public_attributes_are_unchanged() -> None:
    """``__getattr__`` is not consulted for names that already exist on ``st``."""
    assert st.button is st.__dict__["button"]
    assert hasattr(st, "button")
    assert hasattr(st, "session_state")
    assert hasattr(st, "column_config")


def test_private_names_do_not_get_suggestions() -> None:
    """Underscore names keep a plain AttributeError."""
    error = _missing_attr("_not_a_public_command")
    assert str(error) == "module 'streamlit' has no attribute '_not_a_public_command'"


def test_from_import_missing_name_is_import_error() -> None:
    """``from streamlit import missing`` follows Python's ImportError conversion."""
    with pytest.raises(ImportError, match="experimental_rerun"):
        exec("from streamlit import experimental_rerun")


def test_suggest_streamlit_commands_is_conservative() -> None:
    """Close-match helper drops matches that differ by more than one character."""
    catalog = ("form", "text_input", "write")
    assert suggest_streamlit_commands("format", catalog) == ()
    assert suggest_streamlit_commands("wrtie", catalog) == ("write",)
    assert suggest_streamlit_commands("text_inpt", catalog) == ("text_input",)


def test_format_st_names_empty_is_safe() -> None:
    """Joining zero command names does not raise."""
    assert _format_st_names(()) == ""


def test_missing_streamlit_attribute_message_keeps_standard_prefix() -> None:
    """The enriched message still opens with Python's standard wording."""
    message = missing_streamlit_attribute_message("experimental_rerun", st)
    assert message.startswith(
        "module 'streamlit' has no attribute 'experimental_rerun'"
    )
    assert "st.rerun" in message
