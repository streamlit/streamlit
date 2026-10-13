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

"""Type tests for st.secrets."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type

# Perform type checking tests for st.secrets. These are checked by mypy and
# ty, never executed at runtime.
if TYPE_CHECKING:
    from collections.abc import ItemsView, Iterator, KeysView, Mapping, ValuesView
    from typing import Any

    # NOTE: st.secrets is a module-level attribute, not a Mixin method, so we
    # must import streamlit as st here rather than importing from a Mixin class.
    import streamlit as st
    from streamlit.runtime.secrets import AttrDict, Secrets, SecretsValue

    assert_type(st.secrets, Secrets)

    # =====================================================================
    # Reads: attribute and bracket notation
    #
    # Reads stay Any. Secret types come from secrets.toml and are not known
    # statically, so a list secret still supports membership tests.
    # =====================================================================

    assert_type(st.secrets["api_key"], Any)
    assert_type(st.secrets.api_key, Any)
    assert_type(st.secrets["database"]["user"], Any)
    assert_type(st.secrets.database.user, Any)
    assert_type(st.secrets["database"].password, Any)
    assert_type(st.secrets.database["password"], Any)

    def _dynamic_secret_name() -> str:
        return "api_key"

    assert_type(st.secrets[_dynamic_secret_name()], Any)
    assert_type("sally" in st.secrets.whitelist, bool)
    assert_type("sally" in st.secrets["whitelist"], bool)
    assert_type("database" in st.secrets, bool)

    # =====================================================================
    # Mapping methods, to_dict, has_key, and load_if_toml_exists
    # =====================================================================

    assert_type(st.secrets.get("api_key"), Any | None)
    # An explicit None default selects the overload that returns Any.
    assert_type(st.secrets.get("api_key", None), Any)
    assert_type(st.secrets.get("api_key", "default"), Any)
    assert_type(st.secrets.has_key("api_key"), bool)
    assert_type(st.secrets.has_key(k="api_key"), bool)
    assert_type(st.secrets.to_dict(), dict[str, Any])
    assert_type(st.secrets.load_if_toml_exists(), bool)
    assert_type(len(st.secrets), int)
    assert_type(str(st.secrets), str)
    assert_type(repr(st.secrets), str)
    assert_type(iter(st.secrets), Iterator[str])
    assert_type(st.secrets.keys(), KeysView[str])
    assert_type(st.secrets.values(), ValuesView[Any])
    assert_type(st.secrets.items(), ItemsView[str, Any])

    for _secret_key in st.secrets:
        assert_type(_secret_key, str)

    # =====================================================================
    # merge_programmatic_secrets
    #
    # One mapping covers every supported value: scalars, lists, and nested
    # dicts. The keyword argument also checks the parameter name.
    # =====================================================================

    assert_type(st.secrets.merge_programmatic_secrets({}), None)
    assert_type(
        st.secrets.merge_programmatic_secrets(
            programmatic_secrets={
                "api_key": "secret",
                "port": 5432,
                "ratio": 1.5,
                "enabled": True,
                "tags": ["a", "b"],
                "db": {"host": "localhost", "port": 5432},
                "sections": [{"name": "primary"}, {"name": "secondary"}],
            }
        ),
        None,
    )

    programmatic: dict[str, str] = {"api_key": "secret"}
    assert_type(st.secrets.merge_programmatic_secrets(programmatic), None)

    loaded: Mapping[str, SecretsValue] = {"api_key": "secret", "port": 5432}
    assert_type(st.secrets.merge_programmatic_secrets(loaded), None)

    # =====================================================================
    # Direct construction pins AttrDict. Reads through st.secrets stay Any
    # because the key's type is not known statically.
    # =====================================================================

    section = AttrDict({"user": "jane", "db": {"host": "localhost"}})
    assert_type(section, AttrDict)
    assert_type(section["user"], Any)
    assert_type(section.user, Any)
    assert_type(section["db"]["host"], Any)
    assert_type(section.db.host, Any)
    assert_type(section["db"].host, Any)
    assert_type(section.db["host"], Any)
    assert_type(section.get("user"), Any | None)
    assert_type(section.get("user", "default"), Any)
    assert_type(section.to_dict(), dict[str, Any])
    assert_type(len(section), int)
    assert_type(iter(section), Iterator[str])
    assert_type("user" in section, bool)
    assert_type(section.keys(), KeysView[str])
    assert_type(section.values(), ValuesView[Any])
    assert_type(section.items(), ItemsView[str, Any])

    for _section_key in section:
        assert_type(_section_key, str)

    # =====================================================================
    # Invalid usages - should NOT type check
    #
    # AttrDict writes return NoReturn, so each invalid call is in its own
    # function. Otherwise a write marks later checks unreachable.
    # =====================================================================

    def _secrets_reject_non_str_key() -> None:
        st.secrets[1]  # type: ignore[index]  # ty: ignore[invalid-argument-type]

    def _secrets_reject_item_assignment() -> None:
        st.secrets["api_key"] = "secret"  # type: ignore[assignment]  # ty: ignore[invalid-assignment]

    def _secrets_reject_attribute_assignment() -> None:
        st.secrets.api_key = "secret"  # type: ignore[assignment]  # ty: ignore[invalid-assignment]

    def _secrets_reject_item_deletion() -> None:
        del st.secrets["api_key"]  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _secrets_reject_non_str_has_key() -> None:
        st.secrets.has_key(1)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _secrets_reject_missing_programmatic_secrets() -> None:
        st.secrets.merge_programmatic_secrets()  # type: ignore[call-arg]  # ty: ignore[missing-argument]

    def _secrets_reject_non_mapping_programmatic_secrets() -> None:
        st.secrets.merge_programmatic_secrets("nope")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def _secrets_reject_non_str_programmatic_key() -> None:
        st.secrets.merge_programmatic_secrets({1: "secret"})  # type: ignore[dict-item]  # ty: ignore[invalid-argument-type]

    def _secrets_reject_none_programmatic_value() -> None:
        st.secrets.merge_programmatic_secrets({"api_key": None})  # type: ignore[dict-item]  # ty: ignore[invalid-argument-type]

    def _secrets_reject_tuple_programmatic_value() -> None:
        st.secrets.merge_programmatic_secrets({"tags": ("a", "b")})  # type: ignore[dict-item]  # ty: ignore[invalid-argument-type]

    def _attr_dict_reject_non_str_key() -> None:
        section[1]  # type: ignore[index]  # ty: ignore[invalid-argument-type]

    def _attr_dict_reject_item_assignment() -> None:
        section["user"] = "jane"  # type: ignore[assignment]  # ty: ignore[invalid-assignment]

    def _attr_dict_reject_attribute_assignment() -> None:
        section.user = "jane"  # type: ignore[assignment]  # ty: ignore[invalid-assignment]

    def _attr_dict_reject_item_deletion() -> None:
        del section["user"]  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
