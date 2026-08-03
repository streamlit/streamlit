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
import subprocess
import sys

import streamlit as st
import streamlit.typing
from streamlit.elements.arrow import DataframeState
from streamlit.elements.deck_gl_json_chart import PydeckState
from streamlit.elements.lib.column_config_utils import ButtonColumnClickState
from streamlit.elements.plotly_chart import PlotlyState
from streamlit.elements.vega_charts import VegaLiteState
from streamlit.elements.widgets.chat import ChatInputValue
from streamlit.proto.Common_pb2 import FileURLs as FileURLsProto
from streamlit.runtime.uploaded_file_manager import UploadedFile, UploadedFileRec

_EXPECTED_EXPORTS = {
    "ButtonColumnClickState",
    "ChatInputValue",
    "DataframeState",
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
    """``__all__`` contains exactly the 7 curated public exports."""
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
        DataframeState({"selection": {}}), streamlit.typing.DataframeState
    )
    assert isinstance(PlotlyState({"selection": {}}), streamlit.typing.PlotlyState)
    assert isinstance(VegaLiteState({"selection": {}}), streamlit.typing.VegaLiteState)
    assert isinstance(PydeckState({"selection": {}}), streamlit.typing.PydeckState)
    assert isinstance(
        ButtonColumnClickState({"row": 0, "label": "x"}),
        streamlit.typing.ButtonColumnClickState,
    )


def test_import_pulls_in_no_new_third_party_modules() -> None:
    """Importing ``streamlit.typing`` adds no third-party top-level module.

    Guards the spec's "no new dependencies" requirement: loading the public
    typing namespace must not import any package beyond what a bare
    ``import streamlit`` already loads.
    """
    script = """
import sys
import streamlit

baseline = set(sys.modules)
import streamlit.typing

new = {
    module.split(".")[0]
    for module in set(sys.modules) - baseline
    if not module.startswith("streamlit")
}
assert not new, new
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_namespace_is_packaged_with_py_typed_marker() -> None:
    """``streamlit.typing`` is an importable module and ships the ``py.typed`` marker.

    A wheel-level smoke test from the spec: the module must be packaged (so the
    public path resolves) and Streamlit must expose ``py.typed`` so type checkers
    treat the re-exports as typed.
    """
    assert importlib.util.find_spec("streamlit.typing") is not None
    assert importlib.resources.files("streamlit").joinpath("py.typed").is_file()
