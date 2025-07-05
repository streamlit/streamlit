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

"""toast unit tests."""

from __future__ import annotations

from datetime import timedelta

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ToastTest(DeltaGeneratorTestCase):
    def test_just_text(self):
        """Test that it can be called with just text."""
        st.toast("toast text")

        c = self.get_delta_from_queue().new_element.toast
        assert c.body == "toast text"
        assert c.icon == ""
        assert c.duration == 4.0

    def test_no_text(self):
        """Test that an error is raised if no text is provided."""
        with pytest.raises(StreamlitAPIException) as e:
            st.toast("")
        assert str(e.value) == "Toast body cannot be blank - please provide a message."

    def test_valid_icon(self):
        """Test that it can be called passing a valid emoji as icon."""
        st.toast("toast text", icon="🦄")

        c = self.get_delta_from_queue().new_element.toast
        assert c.body == "toast text"
        assert c.icon == "🦄"
        assert c.duration == 4.0

    def test_invalid_icon(self):
        """Test that an error is raised if an invalid icon is provided."""
        with pytest.raises(StreamlitAPIException) as e:
            st.toast("toast text", icon="invalid")
        assert str(e.value) == (
            'The value "invalid" is not a valid emoji. Shortcodes '
            "are not allowed, please use a single character instead."
        )

    def test_duration_int(self):
        """Test that it can be called with an int duration."""
        st.toast("toast text", duration=10)

        c = self.get_delta_from_queue().new_element.toast
        assert c.body == "toast text"
        assert c.duration == 10.0

    def test_duration_float(self):
        """Test that it can be called with a float duration."""
        st.toast("toast text", duration=0.5)

        c = self.get_delta_from_queue().new_element.toast
        assert c.body == "toast text"
        assert c.duration == 0.5

    def test_duration_timedelta(self):
        """Test that it can be called with a timedelta duration."""
        st.toast("toast text", duration=timedelta(seconds=5))

        c = self.get_delta_from_queue().new_element.toast
        assert c.body == "toast text"
        assert c.duration == 5.0

    def test_duration_str(self):
        """Test that it can be called with a string duration."""
        st.toast("toast text", duration="1s500ms")

        c = self.get_delta_from_queue().new_element.toast
        assert c.body == "toast text"
        assert c.duration == 1.5

    def test_duration_none(self):
        """Test that duration is not set when it is None."""
        st.toast("toast text", duration=None)

        c = self.get_delta_from_queue().new_element.toast
        assert c.body == "toast text"
        assert not c.HasField("duration")
