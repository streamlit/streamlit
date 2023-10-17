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

import threading
import unittest
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

import streamlit as st
from streamlit.connections import SnowflakeConnection
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.secrets import AttrDict
from tests.testutil import create_mock_script_run_ctx


@pytest.mark.require_snowflake
class SnowflakeConnectionTest(unittest.TestCase):
    def tearDown(self) -> None:
        st.cache_data.clear()

    @patch(
        "snowflake.snowpark.context.get_active_session",
    )
    @patch(
        "streamlit.connections.snowflake_connection.running_in_sis",
        MagicMock(return_value=True),
    )
    def test_uses_active_session_if_in_sis(self, patched_get_active_session):
        active_session_mock = MagicMock()
        active_session_mock.connection = "some active session"
        patched_get_active_session.return_value = active_session_mock

        conn = SnowflakeConnection("my_snowflake_connection")
        assert conn._instance == "some active session"

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._secrets",
        PropertyMock(
            return_value=AttrDict({"account": "some_val_1", "some_key": "some_val_2"})
        ),
    )
    @patch("snowflake.connector.connect")
    def test_uses_streamlit_secrets_if_available(self, patched_connect):
        SnowflakeConnection("my_snowflake_connection")
        patched_connect.assert_called_once_with(
            account="some_val_1", some_key="some_val_2"
        )

    @patch("snowflake.connector.connect")
    def test_uses_config_manager_if_available(self, patched_connect):
        SnowflakeConnection("snowflake", some_kwarg="some_value")

        patched_connect.assert_called_once_with(
            connection_name="default", some_kwarg="some_value"
        )

    @patch("snowflake.connector.connection")
    @patch("snowflake.connector.connect")
    def test_falls_back_to_using_kwargs_last(self, patched_connect, patched_connection):
        delattr(patched_connection, "CONFIG_MANAGER")

        SnowflakeConnection("snowflake", account="account", some_kwarg="some_value")
        patched_connect.assert_called_once_with(
            account="account", some_kwarg="some_value"
        )

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_query_caches_value(self):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(return_value="i am a dataframe")

        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        assert conn.query("SELECT 1;") == "i am a dataframe"
        assert conn.query("SELECT 1;") == "i am a dataframe"

        conn._instance.cursor.assert_called_once()
        mock_cursor.execute.assert_called_once_with("SELECT 1;", params=None)

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_retry_behavior(self):
        from snowflake.connector import Error as SnowflakeError

        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(
            side_effect=SnowflakeError("oh noes :()")
        )

        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        with patch.object(conn, "reset", wraps=conn.reset) as wrapped_reset:
            with pytest.raises(SnowflakeError):
                conn.query("SELECT 1;")

            # Our connection should have been reset after each failed attempt to call
            # query.
            assert wrapped_reset.call_count == 3

        # conn._connect should have been called three times: once in the initial
        # connection, then once each after the second and third attempts to call
        # query.
        assert conn._connect.call_count == 3

    @patch(
        "streamlit.connections.snowflake_connection.SnowflakeConnection._connect",
        MagicMock(),
    )
    def test_retry_fails_fast_for_most_errors(self):
        mock_cursor = MagicMock()
        mock_cursor.fetch_pandas_all = MagicMock(side_effect=Exception("oh noes :()"))

        conn = SnowflakeConnection("my_snowflake_connection")
        conn._instance.cursor.return_value = mock_cursor

        with pytest.raises(Exception):
            conn.query("SELECT 1;")

        # conn._connect should have just been called once when first creating the
        # connection.
        assert conn._connect.call_count == 1
