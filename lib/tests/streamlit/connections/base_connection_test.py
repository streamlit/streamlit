# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import os
import unittest
from unittest.mock import MagicMock, mock_open, patch

import pytest

import streamlit as st
from streamlit.connections import BaseConnection
from streamlit.runtime.secrets import AttrDict

MOCK_TOML = """
[connections.mock_connection]
foo="bar"

[connections.nondefault_connection_name]
baz="qux"
"""


class MockConnection(BaseConnection[str]):
    _default_connection_name = "mock_connection"

    def _connect(self, **kwargs) -> str:
        return "hooray, I'm connected!"


class BaseConnectionDefaultMethodTests(unittest.TestCase):
    def setUp(self) -> None:
        # st.secrets modifies os.environ, so we save it here and
        # restore in tearDown.
        self._prev_environ = dict(os.environ)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._prev_environ)
        st.secrets._reset()

    def test_instance_set_to_connect_return_value(self):
        assert MockConnection()._instance == "hooray, I'm connected!"

    def test_default_name(self):
        assert MockConnection()._default_name() == "mock_connection"

    def test_default_name_with_unset_default(self):
        class ExplodingConnection(BaseConnection[str]):
            # Intentionally don't define _default_connection_name.

            def _connect(self, **kwargs):
                pass

        with pytest.raises(NotImplementedError):
            ExplodingConnection()

    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_get_secrets(self, _):
        conn = MockConnection()
        assert conn._get_secrets().foo == "bar"

    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_get_secrets_nondefault_connection_name(self, _):
        conn = MockConnection(connection_name="nondefault_connection_name")
        assert conn._get_secrets().baz == "qux"

    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_get_secrets_no_matching_section(self, _):
        conn = MockConnection(connection_name="nonexistent")
        assert conn._get_secrets() == {}

    def test_get_secrets_no_secrets(self):
        conn = MockConnection()
        assert conn._get_secrets() == {}

    def test_instance_prop_caches_raw_instance(self):
        conn = MockConnection()
        conn._raw_instance = "some other value"

        assert conn._instance == "some other value"

    def test_instance_prop_reinitializes_if_reset(self):
        conn = MockConnection()
        conn._raw_instance = None

        assert conn._instance == "hooray, I'm connected!"

    def test_on_secrets_changed_when_nothing_changed(self):
        conn = MockConnection()

        # conn.reset() shouldn't be called because secrets haven't changed since conn
        # was constructed.
        with patch(
            "streamlit.connections.base_connection.BaseConnection.reset"
        ) as patched_reset:
            conn._on_secrets_changed("unused_arg")
            patched_reset.assert_not_called()

    def test_on_secrets_changed(self):
        conn = MockConnection()

        with patch(
            "streamlit.connections.base_connection.BaseConnection.reset"
        ) as patched_reset, patch(
            "streamlit.connections.base_connection.BaseConnection._get_secrets",
            MagicMock(return_value=AttrDict({"mock_connection": {"new": "secret"}})),
        ):
            conn._on_secrets_changed("unused_arg")
            patched_reset.assert_called_once()
