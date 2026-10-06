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

"""AppTest smoke tests asserting that every public Element/Block proto oneof parses.

Producers come from ``element_mocks`` (the public ``st.*`` inventory). Extra
scripts cover proto behavior those producers do not.

Elements without a dedicated AppTest node class parse as ``UnknownElement``, so
these cases assert that ``run()`` succeeds and the variant reaches the tree, not
that AppTest exposes a typed accessor for it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, NamedTuple

import pytest

from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.testing.v1 import AppTest
from tests.streamlit.element_mocks import (
    CONTAINER_ELEMENTS,
    NON_WIDGET_ELEMENTS,
    WIDGET_ELEMENTS,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from google.protobuf.descriptor import Descriptor

# Public st.* never puts these oneofs in the AppTest element tree.
_EXCLUDED_ELEMENT_TYPES: dict[str, str] = {
    "favicon": "st.set_page_config sends page_config_changed, not Element.favicon",
    "spinner": "transient-only; AppTest skips new_transient deltas",
}
_EXCLUDED_BLOCK_TYPES: dict[str, str] = {
    "vertical": "legacy; layouts emit flex_container",
    "horizontal": "legacy; layouts emit flex_container",
}

# AppTest node.type values that are not Element/Block type oneofs
# (unknown is a synthetic placeholder for intermediate delta-path segments).
_NON_PROTO_NODE_TYPES = frozenset({"root", "main", "sidebar", "event", "unknown"})

# Mock command name -> proto oneofs claimed for inventory coverage.
# Empty frozenset: the mock emits nothing unique (logo is a top-level
# ForwardMsg; echo/spinner/dialog are never entered) or only a oneof
# another mock already claims (form_submit_button proxies text_input;
# pdf delegates to bidi_component).
_MOCK_PROTO_OVERRIDES: dict[str, frozenset[str]] = {
    "form_submit_button": frozenset(),
    "logo": frozenset(),
    "echo": frozenset(),
    "spinner": frozenset(),
    "dialog": frozenset(),
    "pdf": frozenset(),
    "datetime_input": frozenset({"date_time_input"}),
    "help": frozenset({"help_info"}),
    "tabs": frozenset({"tab_container", "tab"}),
    "columns": frozenset({"column"}),
    "container": frozenset({"flex_container"}),
    "expander": frozenset({"expandable"}),
    "status": frozenset({"expandable"}),
    "error": frozenset({"alert"}),
    "info": frozenset({"alert"}),
    "success": frozenset({"alert"}),
    "warning": frozenset({"alert"}),
    "title": frozenset({"heading"}),
    "header": frozenset({"heading"}),
    "subheader": frozenset({"heading"}),
    "caption": frozenset({"markdown"}),
    "badge": frozenset({"markdown"}),
    "divider": frozenset({"markdown"}),
    "latex": frozenset({"markdown"}),
    "write": frozenset({"markdown"}),
    "write_stream": frozenset({"markdown"}),
    "mermaid_chart": frozenset({"markdown"}),
    "image": frozenset({"imgs"}),
    "pyplot": frozenset({"imgs"}),
    "pills": frozenset({"button_group"}),
    "segmented_control": frozenset({"button_group"}),
    "toggle": frozenset({"checkbox"}),
    "select_slider": frozenset({"slider"}),
    "data_editor": frozenset({"dataframe"}),
    "line_chart": frozenset({"vega_lite_chart"}),
    "area_chart": frozenset({"vega_lite_chart"}),
    "bar_chart": frozenset({"vega_lite_chart"}),
    "scatter_chart": frozenset({"vega_lite_chart"}),
    "altair_chart": frozenset({"vega_lite_chart"}),
    "map": frozenset({"deck_gl_json_chart"}),
    "pydeck_chart": frozenset({"deck_gl_json_chart"}),
}

# AppTest node.type -> Element/Block type oneof when they differ.
_TREE_TYPE_TO_PROTO: dict[str, str] = {
    "error": "alert",
    "info": "alert",
    "success": "alert",
    "warning": "alert",
    "image": "imgs",
    "title": "heading",
    "header": "heading",
    "subheader": "heading",
    "caption": "markdown",
    "latex": "markdown",
    "divider": "markdown",
    "toggle": "checkbox",
    "select_slider": "slider",
    "expander": "expandable",
    "status": "expandable",
}

_MOCK_GROUPS: dict[str, list[tuple[str, Callable[[], object]]]] = {
    "widget": WIDGET_ELEMENTS,
    "non_widget": NON_WIDGET_ELEMENTS,
    "container": CONTAINER_ELEMENTS,
}

_MOCK_CASES: list[tuple[str, str]] = [
    (group, name) for group, producers in _MOCK_GROUPS.items() for name, _ in producers
]


def _oneof_names(descriptor: Descriptor) -> set[str]:
    """Return field names in the ``type`` oneof of a proto message descriptor."""
    return {field.name for field in descriptor.oneofs_by_name["type"].fields}


def _all_oneofs() -> set[str]:
    return _oneof_names(ElementProto.DESCRIPTOR) | _oneof_names(BlockProto.DESCRIPTOR)


def _protos_claimed_by_mock(name: str) -> frozenset[str]:
    if name in _MOCK_PROTO_OVERRIDES:
        return _MOCK_PROTO_OVERRIDES[name]
    return frozenset({name})


def _proto_names_from_tree(at: AppTest) -> set[str]:
    names: set[str] = set()
    for node in at:
        if node.type in _NON_PROTO_NODE_TYPES:
            continue
        names.add(_TREE_TYPE_TO_PROTO.get(node.type, node.type))
    return names


def _run_ok(at: AppTest) -> None:
    # st.exception() is a successful display command, so at.exception is
    # non-empty on that mock; SCRIPT_RUN_WITHOUT_ERRORS_KEY is the run status.
    assert at.session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY], [
        exc.message for exc in at.exception
    ]


def _call_element_mock(group: str, name: str) -> None:
    # AppTest.from_function compiles only this function as the app script, so
    # module globals such as _MOCK_GROUPS are out of scope here.
    from tests.streamlit.element_mocks import (
        CONTAINER_ELEMENTS,
        NON_WIDGET_ELEMENTS,
        WIDGET_ELEMENTS,
    )

    groups = {
        "widget": WIDGET_ELEMENTS,
        "non_widget": NON_WIDGET_ELEMENTS,
        "container": CONTAINER_ELEMENTS,
    }
    for mock_name, producer in groups[group]:
        if mock_name == name:
            producer()
            return
    raise KeyError((group, name))


def _extra_bidi_component() -> None:
    import streamlit as st

    c = st.components.v2.component("smoke_test_bidi", html="<div>hi</div>")
    c()


def _extra_component_instance() -> None:
    import streamlit.components.v1 as components

    foo = components.declare_component("smoke_test_v1", url="http://example.com")
    foo()


def _extra_spinner() -> None:
    import streamlit as st

    # Exiting immediately cancels the 0.5s timer, so only an empty
    # clear_transient new_transient delta is sent. AppTest skips those
    # deltas, and spinner never appears as a tree node.
    with st.spinner("w"):
        pass


def _extra_dialog() -> None:
    import streamlit as st

    @st.dialog("D")
    def _dlg() -> None:
        st.write("x")

    _dlg()


def _extra_transparent() -> None:
    import streamlit as st

    outside = st.container()
    outside.empty()

    @st.fragment
    def _frag() -> None:
        outside.write("hi")

    _frag()


class _ExtraCase(NamedTuple):
    """Additional script for proto behavior that element_mocks does not cover.

    ``proto_names`` are the Element/Block ``type`` oneof names this case claims
    coverage for. ``tree_types`` are the ``node.type`` values the parsed tree
    must contain. ``absent_types`` must not appear, for transients such as
    spinner.
    """

    case_id: str
    script: Callable[[], None]
    proto_names: frozenset[str] = frozenset()
    tree_types: frozenset[str] = frozenset()
    absent_types: frozenset[str] = frozenset()


_EXTRA_CASES: list[_ExtraCase] = [
    _ExtraCase(
        "bidi_component",
        _extra_bidi_component,
        frozenset({"bidi_component"}),
        frozenset({"bidi_component"}),
    ),
    _ExtraCase(
        "component_instance",
        _extra_component_instance,
        frozenset({"component_instance"}),
        frozenset({"component_instance"}),
    ),
    _ExtraCase(
        "spinner",
        _extra_spinner,
        absent_types=frozenset({"spinner"}),
    ),
    _ExtraCase(
        "dialog",
        _extra_dialog,
        frozenset({"dialog"}),
        frozenset({"dialog"}),
    ),
    _ExtraCase(
        "transparent",
        _extra_transparent,
        frozenset({"transparent"}),
        frozenset({"transparent"}),
    ),
]


def test_every_public_proto_oneof_has_a_parse_smoke_case() -> None:
    """Every Element/Block type oneof is covered by a mock, extra, or exclusion."""
    covered = {
        name
        for _, mock_name in _MOCK_CASES
        for name in _protos_claimed_by_mock(mock_name)
    }
    covered |= {name for case in _EXTRA_CASES for name in case.proto_names}
    element_oneofs = _oneof_names(ElementProto.DESCRIPTOR)
    block_oneofs = _oneof_names(BlockProto.DESCRIPTOR)
    assert set(_EXCLUDED_ELEMENT_TYPES) <= element_oneofs, (
        "_EXCLUDED_ELEMENT_TYPES names that are no longer Element oneofs: "
        f"{sorted(set(_EXCLUDED_ELEMENT_TYPES) - element_oneofs)}"
    )
    assert set(_EXCLUDED_BLOCK_TYPES) <= block_oneofs, (
        "_EXCLUDED_BLOCK_TYPES names that are no longer Block oneofs: "
        f"{sorted(set(_EXCLUDED_BLOCK_TYPES) - block_oneofs)}"
    )
    missing_elements = element_oneofs - covered - set(_EXCLUDED_ELEMENT_TYPES)
    missing_blocks = block_oneofs - covered - set(_EXCLUDED_BLOCK_TYPES)
    assert not missing_elements, (
        f"Element oneofs without a parse smoke case: {sorted(missing_elements)}. "
        "Add an element_mocks producer, an _EXTRA_CASES entry, or an "
        "_EXCLUDED_ELEMENT_TYPES entry with a reason."
    )
    assert not missing_blocks, (
        f"Block oneofs without a parse smoke case: {sorted(missing_blocks)}. "
        "Add an element_mocks producer, an _EXTRA_CASES entry, or an "
        "_EXCLUDED_BLOCK_TYPES entry with a reason."
    )

    extra = covered - element_oneofs - block_oneofs
    assert not extra, (
        "Parse cases reference names that are no longer Element/Block oneofs: "
        f"{sorted(extra)}"
    )


def test_element_mock_proto_overrides_match_oneofs() -> None:
    """Mock names either match a oneof or have an override table entry."""
    oneofs = _all_oneofs()
    for _, name in _MOCK_CASES:
        claimed = _protos_claimed_by_mock(name)
        if name in _MOCK_PROTO_OVERRIDES:
            extra = claimed - oneofs
            assert not extra, (
                f"element_mocks {name!r} override names that are not oneofs: "
                f"{sorted(extra)}"
            )
            continue
        assert name in oneofs, (
            f"element_mocks {name!r} is not an Element/Block oneof. "
            "Add it to _MOCK_PROTO_OVERRIDES."
        )


@pytest.mark.parametrize(
    ("group", "name"),
    _MOCK_CASES,
    ids=[f"{group}-{name}" for group, name in _MOCK_CASES],
)
def test_element_mock_proto_variant_parses(group: str, name: str) -> None:
    """AppTest.run() must parse each element_mocks producer without crashing."""
    at = AppTest.from_function(
        _call_element_mock, default_timeout=10, args=(group, name)
    ).run()
    _run_ok(at)
    claimed = _protos_claimed_by_mock(name)
    if claimed:
        assert claimed <= _proto_names_from_tree(at), {
            node.type for node in at if node.type not in _NON_PROTO_NODE_TYPES
        }


@pytest.mark.parametrize("case", _EXTRA_CASES, ids=[c.case_id for c in _EXTRA_CASES])
def test_extra_proto_variant_parses(case: _ExtraCase) -> None:
    """AppTest.run() must parse oneofs that element_mocks do not emit."""
    at = AppTest.from_function(case.script, default_timeout=10).run()
    _run_ok(at)
    tree_types = {node.type for node in at}
    assert case.tree_types <= tree_types, tree_types
    assert case.absent_types.isdisjoint(tree_types), tree_types
