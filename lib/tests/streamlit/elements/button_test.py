# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""button unit test."""

from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path
from textwrap import dedent
from typing import Any, Callable
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.button import marshall_file
from streamlit.errors import StreamlitAPIException, StreamlitPageNotFoundError
from streamlit.navigation.page import StreamlitPage
from streamlit.proto.DownloadButton_pb2 import (
    DownloadButton as DownloadButtonProto,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


def get_button_command_matrix(
    test_params: list[Any] | None = None,
) -> list[tuple[Any, ...]]:
    """Return a test matrix for the different button commands and the passed arguments.

    This function creates a cartesian product of the button commands and the
    provided `test_params`.

    Parameters
    ----------
    test_params
        A list of test cases. Each item in the list will be treated as a set of
        arguments for a single test run. If an item is not a tuple, it will be
        wrapped in one.

    """
    # The callables are wrapped in a list of tuples with a name for better test
    # case naming.
    commands: list[tuple[str, Callable[..., Any]]] = [
        (
            "button",
            lambda label="test_label_button", **kwargs: st.button(label, **kwargs),
        ),
        (
            "download_button",
            lambda label="test_label_download_button", **kwargs: st.download_button(
                label, "data", **kwargs
            ),
        ),
        (
            "link_button",
            lambda label="test_label_link_button", **kwargs: st.link_button(
                label, "https://example.com", **kwargs
            ),
        ),
        (
            "page_link",
            lambda label="test_label_page_link", **kwargs: st.page_link(
                "https://example.com", label=label, **kwargs
            ),
        ),
    ]

    if not test_params:
        return commands

    matrix: list[tuple[Any, ...]] = []
    for command_tuple in commands:
        for args in test_params:
            # The arguments for a single test case are always wrapped in a tuple.
            args_tuple = args if isinstance(args, tuple) else (args,)
            matrix.append(command_tuple + args_tuple)
    return matrix


class ButtonTest(DeltaGeneratorTestCase):
    """Test ability to marshall button protos."""

    def test_button(self):
        """Test that it can be called."""
        st.button("the label")

        c = self.get_delta_from_queue().new_element.button
        assert c.label == "the label"
        assert not c.default
        assert c.form_id == ""
        assert c.type == "secondary"
        assert not c.is_form_submitter
        assert not c.disabled

    @parameterized.expand(
        [
            (name, command, type_)
            for name, command in get_button_command_matrix()
            if name != "page_link"
            for type_ in ["primary", "secondary", "tertiary"]
        ]
    )
    def test_type(self, name: str, command: Callable[..., Any], type_: str):
        """Test that it can be called with type param."""
        command(type=type_)

        c = getattr(self.get_delta_from_queue().new_element, name)
        assert c.type == type_

    @parameterized.expand(
        [
            (name, command, icon)
            for name, command in get_button_command_matrix()
            for icon in ["⚡", ":material/thumb_up:"]
        ]
    )
    def test_icon(self, name: str, command: Callable[..., Any], icon: str):
        """Test that it can be called with an icon."""
        command(icon=icon)

        c = getattr(self.get_delta_from_queue().new_element, name)
        assert c.icon == icon

    @parameterized.expand(get_button_command_matrix())
    def test_just_disabled(self, name: str, command: Callable[..., Any]):
        """Test that it can be called with disabled param."""
        command(disabled=True)

        c = getattr(self.get_delta_from_queue().new_element, name)
        assert c.disabled

    def test_stable_id_button_with_key(self):
        """Test that the button ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.button(
                label="Label 1",
                key="button_key",
                help="Help 1",
                type="secondary",
                disabled=False,
                width="content",
                on_click=lambda: st.write("Button clicked"),
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
            )
            c1 = self.get_delta_from_queue().new_element.button
            id1 = c1.id

            st.button(
                label="Label 2",
                key="button_key",
                help="Help 2",
                type="primary",
                disabled=True,
                width="stretch",
                on_click=lambda: st.write("Other button clicked"),
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
            )
            c2 = self.get_delta_from_queue().new_element.button
            id2 = c2.id
            assert id1 == id2

    def test_stable_id_download_button_with_key(self):
        """Test that the download button ID is stable when a key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.download_button(
                label="Label 1",
                data="data1",
                file_name="file1.txt",
                mime="text/plain",
                key="download_button_key",
                help="Help 1",
                type="secondary",
                disabled=False,
                width="content",
                on_click=lambda: st.write("Button clicked"),
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
            )
            c1 = self.get_delta_from_queue().new_element.download_button
            id1 = c1.id

            st.download_button(
                label="Label 2",
                data="data2",
                file_name="file2.txt",
                mime="text/csv",
                key="download_button_key",
                help="Help 2",
                type="primary",
                disabled=True,
                width="stretch",
                on_click=lambda: st.write("Other button clicked"),
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
            )
            c2 = self.get_delta_from_queue().new_element.download_button
            id2 = c2.id
            assert id1 == id2

    def test_use_container_width_true(self):
        """Test use_container_width=True is mapped to width='stretch'."""
        for button_type, button_func, width in get_button_command_matrix(
            test_params=["stretch", "content", 200]
        ):
            with self.subTest(button_type, width=width):
                button_func(
                    label=f"test_use_container_width_true {button_type} {width}",
                    use_container_width=True,
                    width=width,
                )
                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_STRETCH.value
                )
                assert el.width_config.use_stretch is True

        with self.subTest("no width"):
            for button_type, button_func in get_button_command_matrix():
                with self.subTest(button_type):
                    button_func(use_container_width=True)
                    el = self.get_delta_from_queue().new_element
                    assert (
                        el.width_config.WhichOneof("width_spec")
                        == WidthConfigFields.USE_STRETCH.value
                    )
                    assert el.width_config.use_stretch is True

    def test_use_container_width_false(self):
        """Test use_container_width=False is mapped to width='content'."""
        for button_type, button_func, width in get_button_command_matrix(
            test_params=[
                "stretch",
                "content",
                200,
            ]
        ):
            with self.subTest(button_type, width=width):
                button_func(
                    label=f"test_use_container_width_false {button_type} {width}",
                    use_container_width=False,
                    width=width,
                )
                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_CONTENT.value
                )
                assert el.width_config.use_content is True

        with self.subTest("no width"):
            for button_type, button_func in get_button_command_matrix():
                with self.subTest(button_type):
                    button_func(use_container_width=False)
                    el = self.get_delta_from_queue().new_element
                    assert (
                        el.width_config.WhichOneof("width_spec")
                        == WidthConfigFields.USE_CONTENT.value
                    )
                    assert el.width_config.use_content is True

    def test_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.button("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_button_width_content(self):
        """Test button elements with width set to content."""
        for button_type, button_func in get_button_command_matrix():
            with self.subTest(button_type):
                button_func(width="content")
                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_CONTENT.value
                )
                assert el.width_config.use_content is True

    def test_button_width_stretch(self):
        """Test button elements with width set to stretch."""
        for button_type, button_func in get_button_command_matrix():
            with self.subTest(button_type):
                button_func(width="stretch")
                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_STRETCH.value
                )
                assert el.width_config.use_stretch is True

    def test_button_width_pixels(self):
        """Test button elements with width set to pixels."""
        test_cases = get_button_command_matrix()
        for button_type, button_func in test_cases:
            with self.subTest(f"{button_type} with fixed width"):
                button_func(width=200)

                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.PIXEL_WIDTH.value
                )
                assert el.width_config.pixel_width == 200

    def test_button_width_default(self):
        """Test button elements use content width by default."""
        for button_type, button_func in get_button_command_matrix():
            with self.subTest(button_type):
                button_func()

                el = self.get_delta_from_queue().new_element
                assert (
                    el.width_config.WhichOneof("width_spec")
                    == WidthConfigFields.USE_CONTENT.value
                )
                assert el.width_config.use_content is True

    def test_button_invalid_width(self):
        """Test button elements with invalid width values."""
        test_cases = get_button_command_matrix(
            test_params=["invalid", -100, 0, 100.5, None]
        )
        for button_type, button_func, width in test_cases:
            with self.subTest(f"{button_type} with width {width}"):
                with pytest.raises(StreamlitAPIException):
                    button_func(width=width)

    @parameterized.expand(
        [
            (name, command)
            for name, command in get_button_command_matrix()
            if name != "page_link"
        ]
    )
    def test_invalid_type(self, name: str, command: Callable[..., Any]):
        """Test with invalid type parameter."""
        with pytest.raises(StreamlitAPIException) as exc_info:
            command(type="invalid")
        assert 'must be "primary", "secondary", or "tertiary"' in str(exc_info.value)

    @parameterized.expand(
        [
            (name, command, "help text 1")
            for name, command in get_button_command_matrix()
        ]
        + [
            (
                name,
                command,
                """
        This is a multiline help text.
        It should be dedented properly.
        """,
            )
            for name, command in get_button_command_matrix()
        ]
    )
    def test_with_help(self, name: str, command: Callable[..., Any], help_text: str):
        """Test with help parameter."""
        command(help=help_text)
        c = getattr(self.get_delta_from_queue().new_element, name)
        assert c.help == dedent(help_text)

    def test_download_button_in_form(self):
        """Test that download_button raises error when used in form."""
        with st.form("test_form"):
            with pytest.raises(StreamlitAPIException) as exc_info:
                st.download_button("test", data="data")
        assert "can't be used in an `st.form()`" in str(exc_info.value)

    def test_button_serde_serialize(self):
        """Test ButtonSerde serialize method."""
        from streamlit.elements.widgets.button import ButtonSerde

        serde = ButtonSerde()
        # Test serialization with True value
        assert serde.serialize(True) is True
        # Test serialization with False value
        assert serde.serialize(False) is False
        # Test serialization with non-boolean values
        assert serde.serialize(1) is True
        assert serde.serialize(0) is False
        assert serde.serialize("") is False
        assert serde.serialize("text") is True

    def test_page_link_in_sidebar(self):
        """Test that page_link in sidebar uses stretch width."""
        # Create a mock sidebar that returns True for in_sidebar
        with patch("streamlit.elements.widgets.button.in_sidebar", return_value=True):
            st.sidebar.page_link("https://example.com", label="Test", width="content")
            el = self.get_delta_from_queue().new_element
            # Even though we specified content, it should be stretch in sidebar
            assert (
                el.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_STRETCH.value
            )

    def test_page_link_with_path_object(self):
        """Test page_link with pathlib.Path object."""
        # Create a mock context with pages
        ctx = MagicMock()
        ctx.main_script_path = "/app/main.py"
        ctx.pages_manager.get_pages.return_value = {
            "page1": {
                "script_path": "/app/pages/page1.py",
                "page_name": "Page 1",
                "url_pathname": "page1",
                "page_script_hash": "hash123",
            }
        }

        with patch(
            "streamlit.elements.widgets.button.get_script_run_ctx", return_value=ctx
        ):
            with patch(
                "streamlit.file_util.get_main_script_directory", return_value="/app"
            ):
                with patch("os.path.realpath", return_value="/app/pages/page1.py"):
                    st.page_link(Path("pages/page1.py"))
                    c = self.get_delta_from_queue().new_element.page_link
                    assert c.page == "page1"
                    assert c.page_script_hash == "hash123"
                    assert c.label == "Page 1"

    def test_page_link_page_not_found(self):
        """Test page_link with non-existent page."""
        ctx = MagicMock()
        ctx.main_script_path = "/app/main.py"
        ctx.pages_manager.get_pages.return_value = {}

        with patch(
            "streamlit.elements.widgets.button.get_script_run_ctx", return_value=ctx
        ):
            with patch(
                "streamlit.file_util.get_main_script_directory", return_value="/app"
            ):
                with patch(
                    "os.path.realpath", return_value="/app/pages/nonexistent.py"
                ):
                    with pytest.raises(StreamlitPageNotFoundError):
                        st.page_link("pages/nonexistent.py")

    def test_page_link_with_streamlit_page(self):
        """Test page_link with StreamlitPage object."""
        # Create a StreamlitPage manually without going through the constructor
        # that checks for file existence
        page = MagicMock(spec=StreamlitPage)
        page._page = Path("/app/page.py")
        page._title = "Test Page"
        page._icon = "🏠"
        page._url_path = "test-page"
        page._script_hash = "test_hash"
        page._default = False
        page.title = "Test Page"
        page.icon = "🏠"
        page.url_path = "test-page"

        ctx = MagicMock()
        with patch(
            "streamlit.elements.widgets.button.get_script_run_ctx", return_value=ctx
        ):
            st.page_link(page)
            c = self.get_delta_from_queue().new_element.page_link
            assert c.page == "test-page"
            assert c.page_script_hash == "test_hash"
            assert c.label == "Test Page"
            assert c.icon == "🏠"

    def test_marshall_file_with_text_io(self):
        """Test marshall_file with TextIOWrapper."""

        # Create a TextIOWrapper
        text_io = io.TextIOWrapper(io.BytesIO(), encoding="utf-8", write_through=True)
        text_io.write("Hello, World!")
        text_io.seek(0)

        proto = DownloadButtonProto()
        marshall_file("test_coords", text_io, proto, None)

        # The mock runtime in DeltaGeneratorTestCase creates a real MediaFileManager
        assert proto.url.startswith("/media/")
        assert proto.url.endswith(".txt")

    def test_marshall_file_with_bytes_io(self):
        """Test marshall_file with BytesIO."""

        bytes_data = io.BytesIO(b"Binary data")
        proto = DownloadButtonProto()
        marshall_file("test_coords", bytes_data, proto, None)

        # The mock runtime in DeltaGeneratorTestCase creates a real MediaFileManager
        assert proto.url.startswith("/media/")
        assert proto.url.endswith(".bin")

    def test_marshall_file_with_buffered_reader(self):
        """Test marshall_file with BufferedReader."""
        # Create a temporary file to test BufferedReader

        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as tmp:
            tmp.write(b"Test data")
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as f:
                proto = DownloadButtonProto()
                marshall_file("test_coords", f, proto, None)
                # The mock runtime in DeltaGeneratorTestCase creates a real MediaFileManager
                assert proto.url.startswith("/media/")
                assert proto.url.endswith(".bin")
        finally:
            os.unlink(tmp_path)

    def test_marshall_file_with_raw_io(self):
        """Test marshall_file with RawIOBase."""

        # Create a custom RawIOBase for testing
        class MockRawIO(io.RawIOBase):
            def __init__(self, data):
                self.data = data
                self.pos = 0

            def read(self, size=-1):
                if size == -1:
                    result = self.data[self.pos :]
                    self.pos = len(self.data)
                else:
                    result = self.data[self.pos : self.pos + size]
                    self.pos += len(result)
                return result

            def seek(self, pos, whence=0):
                if whence == 0:
                    self.pos = pos
                return self.pos

        raw_io = MockRawIO(b"Raw IO data")
        proto = DownloadButtonProto()
        marshall_file("test_coords", raw_io, proto, None)

        # The mock runtime in DeltaGeneratorTestCase creates a real MediaFileManager
        assert proto.url.startswith("/media/")
        assert proto.url.endswith(".bin")

    def test_marshall_file_invalid_data_type(self):
        """Test marshall_file with invalid data type."""

        proto = DownloadButtonProto()
        with pytest.raises(StreamlitAPIException) as exc_info:
            marshall_file("test_coords", {"invalid": "data"}, proto, None)

        assert "Invalid binary data format" in str(exc_info.value)

    def test_marshall_file_with_runtime(self):
        """Test marshall_file with runtime exists."""

        # Mock runtime.exists() to return True
        mock_runtime = MagicMock()
        mock_runtime.exists.return_value = True
        mock_instance = MagicMock()
        mock_instance.media_file_mgr.add.return_value = "/media/test_file"
        mock_runtime.get_instance.return_value = mock_instance

        with patch("streamlit.elements.widgets.button.runtime", mock_runtime):
            proto = DownloadButtonProto()
            marshall_file("test_coords", "test data", proto, None, "test.txt")

            assert proto.url == "/media/test_file"
            mock_instance.media_file_mgr.add.assert_called_once()

    def test_marshall_file_empty_raw_io(self):
        """Test marshall_file with RawIOBase that returns None."""

        class EmptyRawIO(io.RawIOBase):
            def read(self, size=-1):
                return None

            def seek(self, pos, whence=0):
                return 0

        raw_io = EmptyRawIO()
        proto = DownloadButtonProto()
        # The mock runtime in DeltaGeneratorTestCase creates a real MediaFileManager
        # so the URL will be populated
        marshall_file("test_coords", raw_io, proto, None)

        # Empty data should result in an empty file being added
        assert proto.url.startswith("/media/")
        assert proto.url.endswith(".bin")

    def test_download_button_on_click_rerun(self):
        """Test download_button with on_click='rerun'."""
        st.download_button("test", data="data", on_click="rerun")
        c = self.get_delta_from_queue().new_element.download_button
        assert c.ignore_rerun is False

    def test_download_button_on_click_none(self):
        """Test download_button with on_click=None (should behave like 'rerun')."""
        st.download_button("test", data="data", on_click=None)
        c = self.get_delta_from_queue().new_element.download_button
        assert c.ignore_rerun is False

    def test_download_button_on_click_callback(self):
        """Test download_button with callback function."""

        def callback():
            pass

        st.download_button("test", data="data", on_click=callback)
        c = self.get_delta_from_queue().new_element.download_button
        assert c.ignore_rerun is False
