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

import streamlit as st
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class LensTest(DeltaGeneratorTestCase):
    """Test ability to marshall lens protos."""

    def test_basic_lens(self):
        """Test that lens can be created with minimal params."""
        st.lens()

        proto = self.get_delta_from_queue().new_element.lens
        assert proto.label == ""
        assert proto.target_key == ""
        assert not proto.disabled
        assert (
            proto.label_visibility.value
            == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )

    def test_lens_with_label(self):
        """Test that lens can be created with a label."""
        st.lens("my-chart", label="Chart AI")

        proto = self.get_delta_from_queue().new_element.lens
        assert proto.target_key == "my-chart"
        assert proto.label == "Chart AI"

    def test_lens_with_target_key(self):
        """Test that lens can be created with a target key."""
        st.lens(target_key="my-chart")

        proto = self.get_delta_from_queue().new_element.lens
        assert proto.target_key == "my-chart"

    def test_lens_disabled(self):
        """Test that lens can be created in disabled state."""
        st.lens(disabled=True)

        proto = self.get_delta_from_queue().new_element.lens
        assert proto.disabled

    def test_lens_with_label_visibility_hidden(self):
        """Test that lens respects label visibility."""
        st.lens(label_visibility="hidden")

        proto = self.get_delta_from_queue().new_element.lens
        assert (
            proto.label_visibility.value
            == LabelVisibility.LabelVisibilityOptions.HIDDEN
        )

    def test_lens_with_label_visibility_collapsed(self):
        """Test that lens respects label visibility collapsed."""
        st.lens(label_visibility="collapsed")

        proto = self.get_delta_from_queue().new_element.lens
        assert (
            proto.label_visibility.value
            == LabelVisibility.LabelVisibilityOptions.COLLAPSED
        )

    def test_lens_with_help(self):
        """Test that lens can be created with help text."""
        st.lens(help="Analyze the target content")

        proto = self.get_delta_from_queue().new_element.lens
        assert proto.help == "Analyze the target content"

    def test_lens_help_dedents(self):
        """Test that lens help properly dedents."""
        st.lens(help="  Indented help text")

        proto = self.get_delta_from_queue().new_element.lens
        assert proto.help == "Indented help text"

    def test_lens_outside_form(self):
        """Test that lens works outside a form (no form_id needed)."""
        st.lens()

        proto = self.get_delta_from_queue().new_element.lens
        assert proto.id != ""

    def test_lens_returns_none_initially(self):
        """Test that lens returns None when no result available."""
        result = st.lens()
        assert result is None

    def test_lens_with_on_result(self):
        """Test that lens can accept an on_result callback."""

        def callback(snapshot: str, prompt: str) -> str:
            return f"Processed: {prompt}"

        result = st.lens(on_result=callback)
        assert result is None  # No capture yet, so no result

    def test_lens_key_identity_stable(self):
        """Test that lens with key produces a stable element ID."""
        st.lens(key="my_lens")
        proto1 = self.get_delta_from_queue().new_element.lens

        assert "my_lens" in proto1.id
        assert proto1.id != ""

    def test_lens_serde_deserialize_with_callback_and_args(self):
        """Test that LensSerde calls on_result with decoded snapshot, prompt, args and kwargs."""
        import base64
        import json

        from streamlit.elements.widgets.lens import LensSerde

        called = []

        def callback(snapshot: str, prompt: str, arg1, kwarg1="default"):
            called.append((snapshot, prompt, arg1, kwarg1))
            return "ok"

        serde = LensSerde(
            on_result=callback, args=("hello",), kwargs={"kwarg1": "world"}
        )
        payload = {
            "snapshot": base64.b64encode(b"dummy_bytes").decode("utf-8"),
            "prompt": "test_prompt",
        }
        res = serde.deserialize(json.dumps(payload))

        assert res == "ok"
        assert len(called) == 1
        assert called[0] == ("dummy_bytes", "test_prompt", "hello", "world")
