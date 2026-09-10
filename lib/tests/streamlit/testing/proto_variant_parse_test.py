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

"""AppTest parse smoke tests for every public Element/Block proto oneof (P0.5)."""

from __future__ import annotations

import textwrap
from typing import Any, NamedTuple

import pytest

from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.testing.v1 import AppTest


def _oneof_names(descriptor: Any) -> set[str]:
    """Return field names in the ``type`` oneof of a proto message descriptor."""
    return {field.name for field in descriptor.oneofs_by_name["type"].fields}


# Public st.* never puts these oneofs in the AppTest element tree.
EXCLUDED_ELEMENT_TYPES: dict[str, str] = {
    "favicon": "st.set_page_config sends page_config_changed, not Element.favicon",
}
EXCLUDED_BLOCK_TYPES: dict[str, str] = {
    "vertical": "legacy; layouts emit flex_container",
    "horizontal": "legacy; layouts emit flex_container",
    "transparent": "internal fragment outside-container wrapper, not a public st.* command",
}


class ParseCase(NamedTuple):
    """One AppTest script that must emit the given proto oneofs."""

    proto_names: frozenset[str]
    body: str
    tree_types: frozenset[str]
    case_id: str


def _el(name: str, body: str, *tree: str) -> ParseCase:
    return ParseCase(frozenset({name}), body, frozenset(tree), name)


def _blk(name: str, body: str, *tree: str) -> ParseCase:
    return ParseCase(frozenset({name}), body, frozenset(tree), name)


# One case per public Element/Block oneof (tabs share a script). spinner is
# transient and is skipped by parse_tree; .run() must still succeed.
PARSE_CASES: list[ParseCase] = [
    _el("alert", "st.error('e')", "error"),
    _el(
        "dataframe",
        "import pandas as pd\n"
        "df = pd.DataFrame({'a': [1]})\n"
        "st.dataframe(df)\n"
        "st.data_editor(df)",
        "dataframe",
    ),
    _el("table", "import pandas as pd\nst.table(pd.DataFrame({'a': [1]}))", "table"),
    _el(
        "vega_lite_chart",
        "import pandas as pd\nst.line_chart(pd.DataFrame({'y': [1, 2]}))",
        "vega_lite_chart",
    ),
    _el("audio", "st.audio(b'\\x11\\x22')", "audio"),
    _el("audio_input", "st.audio_input('a')", "audio_input"),
    _el("balloons", "st.balloons()", "balloons"),
    _el(
        "bidi_component",
        "c = st.components.v2.component('p05_bidi', html='<div>hi</div>')\nc()",
        "bidi_component",
    ),
    _el("button", "st.button('b')", "button"),
    _el("button_group", "st.pills('p', ['a'])", "button_group"),
    _el(
        "download_button",
        "st.download_button('d', data='x', file_name='a.txt')",
        "download_button",
    ),
    _el("camera_input", "st.camera_input('c')", "camera_input"),
    _el("chat_input", "st.chat_input('c')", "chat_input"),
    _el("checkbox", "st.checkbox('c')", "checkbox"),
    _el("color_picker", "st.color_picker('c')", "color_picker"),
    _el(
        "component_instance",
        "import streamlit.components.v1 as components\n"
        "foo = components.declare_component('p05_v1', url='http://example.com')\n"
        "foo()",
        "component_instance",
    ),
    _el("date_input", "st.date_input('d')", "date_input"),
    _el("deck_gl_json_chart", "st.map()", "deck_gl_json_chart"),
    _el("help_info", "st.help(st.write)", "help_info"),
    _el("empty", "st.empty()", "empty"),
    _el("exception", "st.exception(RuntimeError('boom'))", "exception"),
    _el("feedback", "st.feedback('thumbs')", "feedback"),
    _el("file_uploader", "st.file_uploader('f')", "file_uploader"),
    _el(
        "graphviz_chart",
        "st.graphviz_chart('digraph { a -> b }')",
        "graphviz_chart",
    ),
    _el("html", "st.html('<b>h</b>')", "html"),
    _el(
        "iframe",
        "st.components.v1.iframe('https://example.com')",
        "iframe",
    ),
    _el("imgs", "st.image('https://example.com/x.png')", "image"),
    _el("json", "st.json({'a': 1})", "json"),
    _el(
        "link_button",
        "st.link_button('Go', 'https://example.com')",
        "link_button",
    ),
    _el("markdown", "st.markdown('hi')", "markdown"),
    _el("metric", "st.metric('m', 1)", "metric"),
    _el("multiselect", "st.multiselect('m', ['a'])", "multiselect"),
    _el("number_input", "st.number_input('n')", "number_input"),
    _el(
        "page_link",
        "st.page_link('https://example.com', label='Ex')",
        "page_link",
    ),
    _el(
        "plotly_chart",
        "st.plotly_chart({'data': [{'x': [1], 'y': [2], 'type': 'scatter'}]})",
        "plotly_chart",
    ),
    _el("progress", "st.progress(40)", "progress"),
    _el("radio", "st.radio('r', ['a'])", "radio"),
    _el("selectbox", "st.selectbox('s', ['a'])", "selectbox"),
    _el("skeleton", "st.skeleton()", "skeleton"),
    _el("slider", "st.slider('s')", "slider"),
    _el("snow", "st.snow()", "snow"),
    _el("space", "st.space()", "space"),
    _el("spinner", "with st.spinner('w'):\n    pass"),
    _el("text", "st.text('t')", "text"),
    _el("text_area", "st.text_area('t')", "text_area"),
    _el("text_input", "st.text_input('t')", "text_input"),
    _el("time_input", "st.time_input('t')", "time_input"),
    _el("date_time_input", "st.datetime_input('d')", "date_time_input"),
    _el("toast", "st.toast('t')", "toast"),
    _el("video", "st.video(b'\\x12\\x10')", "video"),
    _el("heading", "st.title('T')", "title"),
    _el("code", "st.code('x=1')", "code"),
    _el("menu_button", "st.menu_button('m', ['a'])", "menu_button"),
    _el("pagination", "st.pagination(5)", "pagination"),
    _el(
        "echarts_chart",
        "st.echarts_chart({'xAxis': {'type': 'category', 'data': ['A']}, "
        "'yAxis': {'type': 'value'}, 'series': [{'type': 'bar', 'data': [1]}]})",
        "echarts_chart",
    ),
    _blk("column", "c1, c2 = st.columns(2)\nc1.write('a')\nc2.write('b')", "column"),
    _blk("expandable", "with st.expander('e'):\n    st.write('x')", "expander"),
    _blk(
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
    _blk(
        "chat_message",
        "with st.chat_message('user'):\n    st.write('hi')",
        "chat_message",
    ),
    _blk("popover", "with st.popover('p'):\n    st.write('x')", "popover"),
    _blk(
        "dialog",
        "@st.dialog('D')\ndef _dlg():\n    st.write('x')\n_dlg()",
        "dialog",
    ),
    _blk("flex_container", "with st.container():\n    st.write('x')", "flex_container"),
]


def test_every_public_proto_oneof_has_a_parse_smoke_case() -> None:
    """Every Element/Block type oneof is covered by a smoke case or an exclusion."""
    covered = {name for case in PARSE_CASES for name in case.proto_names}
    missing_elements = (
        _oneof_names(ElementProto.DESCRIPTOR) - covered - set(EXCLUDED_ELEMENT_TYPES)
    )
    missing_blocks = (
        _oneof_names(BlockProto.DESCRIPTOR) - covered - set(EXCLUDED_BLOCK_TYPES)
    )
    assert missing_elements == set()
    assert missing_blocks == set()

    extra = (
        covered
        - _oneof_names(ElementProto.DESCRIPTOR)
        - _oneof_names(BlockProto.DESCRIPTOR)
    )
    assert extra == set()


@pytest.mark.parametrize("case", PARSE_CASES, ids=[c.case_id for c in PARSE_CASES])
def test_public_st_command_proto_variant_parses(case: ParseCase) -> None:
    """AppTest.run() must parse each public st.* proto variant without crashing."""
    script = "import streamlit as st\n" + textwrap.dedent(case.body).strip() + "\n"
    at = AppTest.from_string(script, default_timeout=10).run()
    assert at.session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY], [
        getattr(exc, "message", str(exc)) for exc in at.exception
    ]
    tree_types = {node.type for node in at}
    assert case.tree_types <= tree_types, tree_types
