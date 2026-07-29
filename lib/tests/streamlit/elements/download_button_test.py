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

"""download_button unit test."""

import io
import os
import tempfile

from parameterized import parameterized

import streamlit as st
from streamlit.proto.DownloadButton_pb2 import DownloadButton as DownloadButtonProto
from streamlit.runtime.memory_media_file_storage import MemoryFile
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class DownloadButtonTest(DeltaGeneratorTestCase):
    """Test ability to marshall download_button protos."""

    @parameterized.expand([("hello world",), (b"byteshere",)])
    def test_just_label(self, data):
        """Test that it can be called with label and string or bytes data."""
        st.download_button("the label", data=data)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.label == "the label"
        assert c.type == "secondary"
        assert not c.disabled
        assert not c.ignore_rerun

    def test_emoji_icon(self):
        """Test that it can be called with emoji icon."""
        st.download_button("the label", icon="⚡", data="juststring")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.icon == "⚡"

    def test_material_icon(self):
        """Test that it can be called with material icon."""
        st.download_button("the label", icon=":material/thumb_up:", data="juststring")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.icon == ":material/thumb_up:"

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.download_button("the label", data="juststring", disabled=True)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.disabled

    def test_url_exist(self):
        """Test that file url exist in proto."""
        st.download_button("the label", data="juststring")

        c = self.get_delta_from_queue().new_element.download_button
        assert "/media/" in c.url

    def test_sets_ignore_rerun(self):
        """Test that it can be called with on_click="ignore"."""
        st.download_button("the label", data="juststring", on_click="ignore")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.ignore_rerun

    @parameterized.expand(["primary", "secondary", "tertiary"])
    def test_type(self, type):
        """Test that it can be called with type param."""
        st.download_button("the label", data="Streamlit", type=type)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.type == type

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.download_button("the label", data="juststring"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_callable_data_detected(self):
        """Test that callable data is properly detected and deferred."""

        def generate_data():
            return "generated content"

        st.download_button("Download", data=generate_data)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.HasField("deferred_file_id")
        assert c.deferred_file_id != ""  # Value set by runtime
        assert c.url == ""

    def test_callable_with_lambda(self):
        """Test that lambda functions work as callables."""
        st.download_button("Download", data=lambda: "lambda content")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.HasField("deferred_file_id")
        assert c.deferred_file_id != ""
        assert c.url == ""

    def test_callable_returns_bytes(self):
        """Test that callable returning bytes is handled correctly."""
        st.download_button("Download", data=lambda: b"bytes content")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.HasField("deferred_file_id")
        assert c.deferred_file_id != ""

    def test_callable_returns_string(self):
        """Test that callable returning string is handled correctly."""
        st.download_button("Download", data=lambda: "string content")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.HasField("deferred_file_id")

    def test_callable_returns_io(self):
        """Test that callable returning IO object is handled correctly."""

        def generate_io():
            return io.BytesIO(b"io content")

        st.download_button("Download", data=generate_io)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.HasField("deferred_file_id")

    def test_callable_with_mime_type(self):
        """Test that callable with mime type is handled correctly."""
        st.download_button("Download CSV", data=lambda: "csv,data", mime="text/csv")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.HasField("deferred_file_id")
        assert c.deferred_file_id != ""

    def test_callable_with_file_name(self):
        """Test that callable with file_name is handled correctly."""
        st.download_button("Download", data=lambda: "content", file_name="output.txt")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.HasField("deferred_file_id")

    def test_non_callable_data_unchanged(self):
        """Test that non-callable data types still work as before."""
        st.download_button("Download String", data="string data")
        c1 = self.get_delta_from_queue().new_element.download_button
        assert not c1.HasField("deferred_file_id")
        assert "/media/" in c1.url

        st.download_button("Download Bytes", data=b"bytes data")
        c2 = self.get_delta_from_queue().new_element.download_button
        assert not c2.HasField("deferred_file_id")
        assert "/media/" in c2.url

    def _stored_file(self, proto: DownloadButtonProto) -> MemoryFile:
        """Return the MemoryFile stored for a download_button proto."""
        return self.media_file_storage.get_file(os.path.basename(proto.url))

    def test_file_object_infers_file_name_and_mime(self) -> None:
        """A file object opened from disk fills in a missing file_name and
        mime from its `name` attribute."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = os.path.join(tmp_dir, "report.csv")
            with open(path, "w", encoding="utf-8") as f:
                f.write("a,b\n1,2\n")
            with open(path, "rb") as data:
                st.download_button("Download", data=data)

        c = self.get_delta_from_queue().new_element.download_button
        stored = self._stored_file(c)
        assert stored.filename == "report.csv"
        assert stored.mimetype == "text/csv"

    def test_raw_file_io_infers_file_name_and_mime(self) -> None:
        """io.FileIO (the type mentioned in the issue) is also supported."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = os.path.join(tmp_dir, "photo.png")
            with open(path, "wb") as f:
                f.write(b"\x89PNG fake")
            with io.FileIO(path, "rb") as data:
                st.download_button("Download", data=data)

        c = self.get_delta_from_queue().new_element.download_button
        stored = self._stored_file(c)
        assert stored.filename == "photo.png"
        assert stored.mimetype == "image/png"

    def test_file_object_explicit_params_take_precedence(self) -> None:
        """User-provided file_name/mime always win over inferred values."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = os.path.join(tmp_dir, "report.csv")
            with open(path, "w", encoding="utf-8") as f:
                f.write("a,b\n")
            with open(path, "rb") as data:
                st.download_button(
                    "Download",
                    data=data,
                    file_name="custom.bin",
                    mime="application/x-foo",
                )

        c = self.get_delta_from_queue().new_element.download_button
        stored = self._stored_file(c)
        assert stored.filename == "custom.bin"
        assert stored.mimetype == "application/x-foo"

    def test_explicit_file_name_drives_mime_inference(self) -> None:
        """When file_name is user-provided but mime is not, the mime is
        guessed from the explicit file_name, not from data.name."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = os.path.join(tmp_dir, "data.bin")
            with open(path, "wb") as f:
                f.write(b"{}")
            with open(path, "rb") as data:
                st.download_button("Download", data=data, file_name="report.json")

        c = self.get_delta_from_queue().new_element.download_button
        stored = self._stored_file(c)
        assert stored.filename == "report.json"
        assert stored.mimetype == "application/json"

    def test_nameless_buffer_keeps_existing_behavior(self) -> None:
        """In-memory buffers without a usable name are unaffected."""
        st.download_button("Download", data=io.BytesIO(b"payload"))

        c = self.get_delta_from_queue().new_element.download_button
        stored = self._stored_file(c)
        assert stored.filename is None
        assert stored.mimetype == "application/octet-stream"

    def test_text_wrapper_over_nameless_buffer_keeps_existing_behavior(self) -> None:
        """A TextIOWrapper over a nameless buffer must not crash: its `name`
        property delegates to the buffer and raises AttributeError."""
        st.download_button(
            "Download", data=io.TextIOWrapper(io.BytesIO(b"payload"), encoding="utf-8")
        )

        c = self.get_delta_from_queue().new_element.download_button
        stored = self._stored_file(c)
        assert stored.filename is None
        assert stored.mimetype == "text/plain"

    def test_stream_raising_on_name_access_keeps_existing_behavior(self) -> None:
        """A stream whose `name` property raises (e.g. a detached or closed
        TextIOWrapper raises ValueError) must not crash inference."""

        class RaisingNameBuffer(io.BytesIO):
            @property
            def name(self) -> str:
                raise ValueError("underlying buffer has been detached")

        st.download_button("Download", data=RaisingNameBuffer(b"payload"))

        c = self.get_delta_from_queue().new_element.download_button
        stored = self._stored_file(c)
        assert stored.filename is None
        assert stored.mimetype == "application/octet-stream"
