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

"""BaseCustomComponent unit tests."""

from __future__ import annotations

from typing import Any

import pytest

from streamlit.components.types.base_custom_component import BaseCustomComponent
from streamlit.errors import StreamlitAPIException


class _StubComponent(BaseCustomComponent):
    """Concrete subclass of ``BaseCustomComponent`` for tests."""

    def __eq__(self, other: object) -> bool:  # pragma: no cover - delegated to base
        return NotImplemented

    def __ne__(self, other: object) -> bool:  # pragma: no cover - delegated to base
        return NotImplemented

    __hash__ = BaseCustomComponent.__hash__

    def create_instance(  # type: ignore[override]
        self,
        *args: Any,
        default: Any = None,
        key: str | None = None,
        on_change: Any = None,
        tab_index: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Record arguments and return a representation for assertions."""
        return {
            "args": args,
            "kwargs": kwargs,
            "default": default,
            "key": key,
            "on_change": on_change,
            "tab_index": tab_index,
        }


def test_init_requires_path_or_url() -> None:
    """``BaseCustomComponent`` requires either ``path`` or ``url``."""
    with pytest.raises(StreamlitAPIException, match=r"Either 'path' or 'url'"):
        _StubComponent(name="bad")


def test_repr_returns_non_empty_string() -> None:
    """``repr(component)`` returns a string containing the class name."""
    component = _StubComponent(name="my_comp", path="/some/path")

    result = repr(component)

    assert isinstance(result, str)
    assert "_StubComponent" in result


def test_call_dispatches_to_create_instance() -> None:
    """Invoking the component delegates to ``create_instance`` with the same args."""
    component = _StubComponent(name="my_comp", path="/some/path")

    result = component(1, 2, default="d", key="k", tab_index=0, foo="bar")

    assert result == {
        "args": (1, 2),
        "kwargs": {"foo": "bar"},
        "default": "d",
        "key": "k",
        "on_change": None,
        "tab_index": 0,
    }


@pytest.mark.parametrize(
    ("kwargs", "expected"),
    [
        pytest.param({"path": "/abs/path"}, "'my_comp': /abs/path", id="prefers_path"),
        pytest.param(
            {"url": "https://example.com"},
            "'my_comp': https://example.com",
            id="falls_back_to_url",
        ),
    ],
)
def test_str_renders_name_and_source(kwargs: dict[str, Any], expected: str) -> None:
    """``str(component)`` renders the name and source (path or URL fallback)."""
    component = _StubComponent(name="my_comp", **kwargs)

    assert str(component) == expected


def test_hash_combines_identity_attributes() -> None:
    """Two components with the same identity attributes share the same hash."""
    a = _StubComponent(name="my_comp", path="/abs/path", module_name="mod")
    b = _StubComponent(name="my_comp", path="/abs/path", module_name="mod")
    different = _StubComponent(name="other", path="/abs/path", module_name="mod")

    assert hash(a) == hash(b)
    assert hash(a) != hash(different)


def test_abspath_returns_none_when_path_unset() -> None:
    """``abspath`` returns ``None`` when ``path`` is not provided."""
    component = _StubComponent(name="my_comp", url="https://example.com")

    assert component.abspath is None


def test_property_accessors_return_constructor_values() -> None:
    """Public read-only properties return the values supplied at construction."""
    component = _StubComponent(
        name="my_comp",
        path="/abs/path",
        url="https://example.com",
        module_name="my_mod",
    )

    assert component.name == "my_comp"
    assert component.path == "/abs/path"
    assert component.url == "https://example.com"
    assert component.module_name == "my_mod"
