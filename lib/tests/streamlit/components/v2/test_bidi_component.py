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

from __future__ import annotations

import pytest

from streamlit import _main as st_main
from streamlit.components.v2.bidi_component.constants import EVENT_DELIM
from streamlit.components.v2.bidi_component.main import _make_trigger_id
from streamlit.components.v2.component_registry import BidiComponentDefinition
from streamlit.errors import (
    BidiComponentInvalidCallbackNameError,
    StreamlitAPIException,
)
from streamlit.runtime import Runtime
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def test_make_trigger_id():
    """Test that _make_trigger_id constructs a valid trigger ID."""
    base = "component_id"
    event = "click"
    trigger_id = _make_trigger_id(base, event)
    assert base in trigger_id
    assert event in trigger_id
    assert EVENT_DELIM in trigger_id


def test_make_trigger_id_with_invalid_chars():
    """Test that _make_trigger_id raises an exception if invalid characters are used."""
    with pytest.raises(StreamlitAPIException):
        _make_trigger_id(f"base{EVENT_DELIM}id", "click")
    with pytest.raises(StreamlitAPIException):
        _make_trigger_id("base_id", f"click{EVENT_DELIM}event")


class BidiComponentTest(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        registry = Runtime.instance().bidi_component_registry
        component_def = BidiComponentDefinition(
            name="my_component",
            js="console.log('hello');",
        )
        registry._components["my_component"] = component_def
        self.dg = st_main

    def test_bidi_component_disallowed_on_change_callbacks(self):
        """Test that `on_change` and `on__change` are disallowed as callbacks."""
        with pytest.raises(BidiComponentInvalidCallbackNameError):
            self.dg._bidi_component(
                "my_component",
                key="key1",
                on_change=lambda: None,
            )

        with pytest.raises(BidiComponentInvalidCallbackNameError):
            self.dg._bidi_component(
                "my_component",
                key="key2",
                on__change=lambda: None,
            )
