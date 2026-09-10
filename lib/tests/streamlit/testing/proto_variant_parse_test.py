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

Elements without a dedicated AppTest node class parse as ``UnknownElement``, so
these cases assert that ``run()`` succeeds and the variant reaches the tree, not
that AppTest exposes a typed accessor for it.
"""

from __future__ import annotations

import textwrap
from typing import TYPE_CHECKING, NamedTuple

import pytest

from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.testing.v1 import AppTest

if TYPE_CHECKING:
    from google.protobuf.descriptor import Descriptor


def _oneof_names(descriptor: Descriptor) -> set[str]:
    """Return field names in the ``type`` oneof of a proto message descriptor."""
    return {field.name for field in descriptor.oneofs_by_name["type"].fields}


# Public st.* never puts these oneofs in the AppTest element tree.
EXCLUDED_ELEMENT_TYPES: dict[str, str] = {
    "favicon": "st.set_page_config sends page_config_changed, not Element.favicon",
}
EXCLUDED_BLOCK_TYPES: dict[str, str] = {
    "vertical": "legacy; layouts emit flex_container",
    "horizontal": "legacy; layouts emit flex_container",
}


class ParseCase(NamedTuple):
    """One AppTest script that exercises one or more proto oneofs.

    ``proto_names`` are the Element/Block ``type`` oneof names this case claims
    coverage for; ``test_every_public_proto_oneof_has_a_parse_smoke_case``
    checks them against the protos. ``tree_types`` are the ``node.type`` values
    the parsed tree must contain, which can differ from the oneof name
    (``alert`` → ``error``, ``imgs`` → ``image``, ``heading`` → ``title``).
    ``absent_types`` must not appear, for transients such as spinner.
    """

    proto_names: frozenset[str]
    body: str
    tree_types: frozenset[str]
    case_id: str
    absent_types: frozenset[str] = frozenset()


def _parse_case(
    name: str, body: str, *tree: str, absent: tuple[str, ...] = ()
) -> ParseCase:
    """Build a case for a single proto oneof ``name``, expecting ``tree`` node types."""
    return ParseCase(frozenset({name}), body, frozenset(tree), name, frozenset(absent))


# One case per public Element/Block oneof; tab_container and tab share one
# script. Spinner is sent as a new_transient delta; parse_tree_from_messages
# skips those deltas.
PARSE_CASES: list[ParseCase] = [
    _parse_case("alert", "st.error('e')", "error"),
    _parse_case(
        "dataframe",
        "import pandas as pd\n"
        "df = pd.DataFrame({'a': [1]})\n"
        "st.dataframe(df)\n"
        "st.data_editor(df)",
        "dataframe",
    ),
    _parse_case(
        "table", "import pandas as pd\nst.table(pd.DataFrame({'a': [1]}))", "table"
    ),
    _parse_case(
        "vega_lite_chart",
        "import pandas as pd\nst.line_chart(pd.DataFrame({'y': [1, 2]}))",
        "vega_lite_chart",
    ),
    _parse_case("audio", "st.audio(b'\\x11\\x22')", "audio"),
    _parse_case("audio_input", "st.audio_input('a')", "audio_input"),
    _parse_case("balloons", "st.balloons()", "balloons"),
    _parse_case(
        "bidi_component",
        "c = st.components.v2.component('smoke_test_bidi', html='<div>hi</div>')\nc()",
        "bidi_component",
    ),
    _parse_case("button", "st.button('b')", "button"),
    _parse_case("button_group", "st.pills('p', ['a'])", "button_group"),
    _parse_case(
        "download_button",
        "st.download_button('d', data='x', file_name='a.txt')",
        "download_button",
    ),
    _parse_case("camera_input", "st.camera_input('c')", "camera_input"),
    _parse_case("chat_input", "st.chat_input('c')", "chat_input"),
    _parse_case("checkbox", "st.checkbox('c')", "checkbox"),
    _parse_case("color_picker", "st.color_picker('c')", "color_picker"),
    _parse_case(
        "component_instance",
        "import streamlit.components.v1 as components\n"
        "foo = components.declare_component('smoke_test_v1', url='http://example.com')\n"
        "foo()",
        "component_instance",
    ),
    _parse_case("date_input", "st.date_input('d')", "date_input"),
    _parse_case("deck_gl_json_chart", "st.map()", "deck_gl_json_chart"),
    _parse_case("help_info", "st.help(st.write)", "help_info"),
    _parse_case("empty", "st.empty()", "empty"),
    _parse_case("exception", "st.exception(RuntimeError('boom'))", "exception"),
    _parse_case("feedback", "st.feedback('thumbs')", "feedback"),
    _parse_case("file_uploader", "st.file_uploader('f')", "file_uploader"),
    _parse_case(
        "graphviz_chart",
        "st.graphviz_chart('digraph { a -> b }')",
        "graphviz_chart",
    ),
    _parse_case("html", "st.html('<b>h</b>')", "html"),
    _parse_case("iframe", "st.iframe('https://example.com')", "iframe"),
    _parse_case("imgs", "st.image('https://example.com/x.png')", "image"),
    _parse_case("json", "st.json({'a': 1})", "json"),
    _parse_case(
        "link_button",
        "st.link_button('Go', 'https://example.com')",
        "link_button",
    ),
    _parse_case("markdown", "st.markdown('hi')", "markdown"),
    _parse_case("metric", "st.metric('m', 1)", "metric"),
    _parse_case("multiselect", "st.multiselect('m', ['a'])", "multiselect"),
    _parse_case("number_input", "st.number_input('n')", "number_input"),
    _parse_case(
        "page_link",
        "st.page_link('https://example.com', label='Ex')",
        "page_link",
    ),
    _parse_case(
        "plotly_chart",
        "st.plotly_chart({'data': [{'x': [1], 'y': [2], 'type': 'scatter'}]})",
        "plotly_chart",
    ),
    _parse_case("progress", "st.progress(40)", "progress"),
    _parse_case("radio", "st.radio('r', ['a'])", "radio"),
    _parse_case("selectbox", "st.selectbox('s', ['a'])", "selectbox"),
    _parse_case("skeleton", "st.skeleton()", "skeleton"),
    _parse_case("slider", "st.slider('s')", "slider"),
    _parse_case("snow", "st.snow()", "snow"),
    _parse_case("space", "st.space()", "space"),
    # Exiting immediately cancels the 0.5s timer, so only the clearing
    # transient is sent — not Element.spinner. That still proves .run()
    # skips new_transient and spinner never appears as a tree node.
    _parse_case("spinner", "with st.spinner('w'):\n    pass", absent=("spinner",)),
    _parse_case("text", "st.text('t')", "text"),
    _parse_case("text_area", "st.text_area('t')", "text_area"),
    _parse_case("text_input", "st.text_input('t')", "text_input"),
    _parse_case("time_input", "st.time_input('t')", "time_input"),
    _parse_case("date_time_input", "st.datetime_input('d')", "date_time_input"),
    _parse_case("toast", "st.toast('t')", "toast"),
    _parse_case("video", "st.video(b'\\x12\\x10')", "video"),
    _parse_case("heading", "st.title('T')", "title"),
    _parse_case("code", "st.code('x=1')", "code"),
    _parse_case("menu_button", "st.menu_button('m', ['a'])", "menu_button"),
    _parse_case("pagination", "st.pagination(5)", "pagination"),
    _parse_case(
        "echarts_chart",
        "st.echarts_chart({'xAxis': {'type': 'category', 'data': ['A']}, "
        "'yAxis': {'type': 'value'}, 'series': [{'type': 'bar', 'data': [1]}]})",
        "echarts_chart",
    ),
    _parse_case(
        "column", "c1, c2 = st.columns(2)\nc1.write('a')\nc2.write('b')", "column"
    ),
    _parse_case("expandable", "with st.expander('e'):\n    st.write('x')", "expander"),
    _parse_case(
        "form",
        "with st.form('f'):\n    st.text_input('n')\n    st.form_submit_button('go')",
        "form",
    ),
    ParseCase(
        frozenset({"tab_container", "tab"}),
        "a, b = st.tabs(['A', 'B'])\na.write('a')\nb.write('b')",
        frozenset({"tab_container", "tab"}),
        "tabs",
    ),
    _parse_case(
        "chat_message",
        "with st.chat_message('user'):\n    st.write('hi')",
        "chat_message",
    ),
    _parse_case("popover", "with st.popover('p'):\n    st.write('x')", "popover"),
    _parse_case(
        "dialog",
        "@st.dialog('D')\ndef _dlg():\n    st.write('x')\n_dlg()",
        "dialog",
    ),
    _parse_case(
        "flex_container", "with st.container():\n    st.write('x')", "flex_container"
    ),
    _parse_case(
        "transparent",
        "outside = st.container()\n"
        "outside.empty()\n"
        "@st.fragment\n"
        "def _frag():\n"
        "    outside.write('hi')\n"
        "_frag()",
        "transparent",
    ),
]


def test_every_public_proto_oneof_has_a_parse_smoke_case() -> None:
    """Every Element/Block type oneof is covered by a smoke case or an exclusion."""
    covered = {name for case in PARSE_CASES for name in case.proto_names}
    element_oneofs = _oneof_names(ElementProto.DESCRIPTOR)
    block_oneofs = _oneof_names(BlockProto.DESCRIPTOR)
    assert set(EXCLUDED_ELEMENT_TYPES) <= element_oneofs, (
        "EXCLUDED_ELEMENT_TYPES names that are no longer Element oneofs: "
        f"{sorted(set(EXCLUDED_ELEMENT_TYPES) - element_oneofs)}"
    )
    assert set(EXCLUDED_BLOCK_TYPES) <= block_oneofs, (
        "EXCLUDED_BLOCK_TYPES names that are no longer Block oneofs: "
        f"{sorted(set(EXCLUDED_BLOCK_TYPES) - block_oneofs)}"
    )
    missing_elements = element_oneofs - covered - set(EXCLUDED_ELEMENT_TYPES)
    missing_blocks = block_oneofs - covered - set(EXCLUDED_BLOCK_TYPES)
    assert not missing_elements, (
        f"Element oneofs without a parse smoke case: {sorted(missing_elements)}. "
        "Add a PARSE_CASES entry, or an EXCLUDED_ELEMENT_TYPES entry with a reason."
    )
    assert not missing_blocks, (
        f"Block oneofs without a parse smoke case: {sorted(missing_blocks)}. "
        "Add a PARSE_CASES entry, or an EXCLUDED_BLOCK_TYPES entry with a reason."
    )

    extra = covered - element_oneofs - block_oneofs
    assert not extra, (
        "PARSE_CASES references names that are no longer Element/Block oneofs: "
        f"{sorted(extra)}"
    )


@pytest.mark.parametrize("case", PARSE_CASES, ids=[c.case_id for c in PARSE_CASES])
def test_public_st_command_proto_variant_parses(case: ParseCase) -> None:
    """AppTest.run() must parse each public st.* proto variant without crashing."""
    script = "import streamlit as st\n" + textwrap.dedent(case.body).strip() + "\n"
    at = AppTest.from_string(script, default_timeout=10).run()
    assert at.session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY], [
        exc.message for exc in at.exception
    ]
    tree_types = {node.type for node in at}
    assert case.tree_types <= tree_types, tree_types
    assert case.absent_types.isdisjoint(tree_types), tree_types
