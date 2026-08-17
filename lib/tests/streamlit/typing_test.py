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

"""Tests for the public ``streamlit.typing`` namespace."""

from __future__ import annotations

import importlib.resources
import importlib.util

import streamlit as st
import streamlit.typing
from streamlit.elements.arrow import DataframeState
from streamlit.elements.deck_gl_json_chart import PydeckState
from streamlit.elements.lib.column_config_utils import ButtonColumnClickState
from streamlit.elements.plotly_chart import PlotlyState
from streamlit.elements.vega_charts import VegaLiteState
from streamlit.elements.widgets.chat import ChatInputValue
from streamlit.elements.widgets.data_editor import DataEditorState
from streamlit.proto.Common_pb2 import FileURLs as FileURLsProto
from streamlit.runtime.uploaded_file_manager import UploadedFile, UploadedFileRec

_EXPECTED_EXPORTS = {
    "ButtonColumnClickState",
    "ChatInputValue",
    "DataEditorState",
    "DataframeState",
    "FilterBarState",
    "PlotlyState",
    "PydeckState",
    "UploadedFile",
    "VegaLiteState",
}


def test_import_surfaces_resolve_to_same_module() -> None:
    """All import styles resolve to the same ``streamlit.typing`` module object."""
    from streamlit import typing as typing_from_streamlit

    assert st.typing is streamlit.typing
    assert typing_from_streamlit is streamlit.typing


def test_all_matches_expected_exports() -> None:
    """``__all__`` contains exactly the curated public exports."""
    assert set(streamlit.typing.__all__) == _EXPECTED_EXPORTS


def test_all_names_are_real_attributes() -> None:
    """Every name in ``__all__`` is an actual attribute of the module."""
    for name in streamlit.typing.__all__:
        assert hasattr(streamlit.typing, name), name


def test_excluded_selection_schemas_are_not_exported() -> None:
    """Inner selection schemas are intentionally kept out of ``__all__``."""
    excluded = {
        "DataframeSelectionState",
        "PlotlySelectionState",
        "PydeckSelectionState",
    }
    assert excluded.isdisjoint(streamlit.typing.__all__)


def test_exports_preserve_object_identity() -> None:
    """Each export is the same runtime object as its internal definition."""
    assert streamlit.typing.UploadedFile is UploadedFile
    assert streamlit.typing.ChatInputValue is ChatInputValue
    assert streamlit.typing.DataEditorState is DataEditorState
    assert streamlit.typing.DataframeState is DataframeState
    assert streamlit.typing.PlotlyState is PlotlyState
    assert streamlit.typing.VegaLiteState is VegaLiteState
    assert streamlit.typing.PydeckState is PydeckState
    assert streamlit.typing.ButtonColumnClickState is ButtonColumnClickState


def test_uploaded_file_isinstance() -> None:
    """A constructed ``UploadedFile`` is an instance of the public export."""
    uploaded_file = UploadedFile(
        UploadedFileRec("id", "name", "type", b""), FileURLsProto()
    )
    assert isinstance(uploaded_file, streamlit.typing.UploadedFile)


def test_chat_input_value_isinstance() -> None:
    """A constructed ``ChatInputValue`` is an instance of the public export."""
    assert isinstance(ChatInputValue(text="hi"), streamlit.typing.ChatInputValue)


def test_state_classes_isinstance() -> None:
    """The dict-backed state classes are instances of their public exports."""
    assert isinstance(
        DataEditorState({"edited_rows": {}, "added_rows": [], "deleted_rows": []}),
        streamlit.typing.DataEditorState,
    )
    assert isinstance(
        DataframeState({"selection": {}}), streamlit.typing.DataframeState
    )
    assert isinstance(PlotlyState({"selection": {}}), streamlit.typing.PlotlyState)
    assert isinstance(VegaLiteState({"selection": {}}), streamlit.typing.VegaLiteState)
    assert isinstance(PydeckState({"selection": {}}), streamlit.typing.PydeckState)
    assert isinstance(
        ButtonColumnClickState({"row": 0, "label": "x"}),
        streamlit.typing.ButtonColumnClickState,
    )


def test_exports_are_first_party_types() -> None:
    """Every re-exported type is defined in a first-party ``streamlit`` module.

    Guards the spec's "no new dependencies" intent: the namespace only surfaces
    Streamlit-owned types, so importing it introduces no third-party dependency.
    A runtime ``sys.modules`` probe is not meaningful here because
    ``streamlit/__init__.py`` already imports ``streamlit.typing`` at package
    init, so any module it pulls in is loaded by a bare ``import streamlit``.
    """
    for name in streamlit.typing.__all__:
        module = getattr(streamlit.typing, name).__module__
        assert module.startswith("streamlit."), (name, module)


def test_namespace_is_packaged_with_py_typed_marker() -> None:
    """``streamlit.typing`` is an importable module and ships the ``py.typed`` marker.

    A source-level smoke test for the spec's packaging requirement: the module
    must resolve (so the public path is importable) and Streamlit must expose
    ``py.typed`` so type checkers treat the re-exports as typed. This inspects the
    source/editable checkout rather than a built wheel; verifying the wheel's
    contents is left to the packaging/CI build.
    """
    assert importlib.util.find_spec("streamlit.typing") is not None
    assert importlib.resources.files("streamlit").joinpath("py.typed").is_file()
