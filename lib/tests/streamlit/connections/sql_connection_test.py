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
from copy import deepcopy
from unittest.mock import MagicMock, PropertyMock, patch

import pytest
from parameterized import parameterized
from sqlalchemy.exc import DatabaseError, InternalError, OperationalError

import streamlit as st
from streamlit.connections import SQL
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.secrets import AttrDict
from tests.testutil import create_mock_script_run_ctx

DB_SECRETS = {
    "dialect": "postgres",
    "driver": "psycopg2",
    "username": "AzureDiamond",
    "password": "hunter2",
    "host": "localhost",
    "port": "5432",
    "database": "postgres",
}


class SQLConnectionTest(unittest.TestCase):
    def tearDown(self) -> None:
        st.cache_data.clear()

    @patch("sqlalchemy.engine.make_url", MagicMock(return_value="some_sql_conn_string"))
    @patch(
        "streamlit.connections.sql_connection.SQL._secrets",
        PropertyMock(return_value=AttrDict({"url": "some_sql_conn_string"})),
    )
    @patch("sqlalchemy.create_engine")
    def test_url_set_explicitly_in_secrets(self, patched_create_engine):
        SQL("my_sql_connection")

        patched_create_engine.assert_called_once_with("some_sql_conn_string")

    @patch(
        "streamlit.connections.sql_connection.SQL._secrets",
        PropertyMock(return_value=AttrDict(DB_SECRETS)),
    )
    @patch("sqlalchemy.create_engine")
    def test_url_constructed_from_secrets_params(self, patched_create_engine):
        SQL("my_sql_connection")

        patched_create_engine.assert_called_once()
        args, _ = patched_create_engine.call_args_list[0]
        assert (
            str(args[0])
            == "postgres+psycopg2://AzureDiamond:hunter2@localhost:5432/postgres"
        )

    @patch(
        "streamlit.connections.sql_connection.SQL._secrets",
        PropertyMock(return_value=AttrDict(DB_SECRETS)),
    )
    @patch("sqlalchemy.create_engine")
    def test_kwargs_overwrite_secrets_values(self, patched_create_engine):
        SQL("my_sql_connection", port=2345, username="DnomaidEruza")

        patched_create_engine.assert_called_once()
        args, _ = patched_create_engine.call_args_list[0]
        assert (
            str(args[0])
            == "postgres+psycopg2://DnomaidEruza:hunter2@localhost:2345/postgres"
        )

    def test_error_if_no_config(self):
        with patch(
            "streamlit.connections.sql_connection.SQL._secrets",
            PropertyMock(return_value=AttrDict({})),
        ):
            with pytest.raises(StreamlitAPIException) as e:
                SQL("my_sql_connection")

            assert "Missing SQL DB connection configuration." in str(e.value)

    @parameterized.expand([("dialect",), ("username",), ("host",)])
    def test_error_if_missing_required_param(self, missing_param):
        secrets = deepcopy(DB_SECRETS)
        del secrets[missing_param]

        with patch(
            "streamlit.connections.sql_connection.SQL._secrets",
            PropertyMock(return_value=AttrDict(secrets)),
        ):
            with pytest.raises(StreamlitAPIException) as e:
                SQL("my_sql_connection")

            assert str(e.value) == f"Missing SQL DB connection param: {missing_param}"

    @patch(
        "streamlit.connections.sql_connection.SQL._secrets",
        PropertyMock(
            return_value=AttrDict(
                {
                    **DB_SECRETS,
                    "create_engine_kwargs": {"foo": "bar", "baz": "i get overwritten"},
                }
            )
        ),
    )
    @patch("sqlalchemy.create_engine")
    def test_create_engine_kwargs_secrets_section(self, patched_create_engine):
        SQL("my_sql_connection", baz="qux")

        patched_create_engine.assert_called_once()
        _, kwargs = patched_create_engine.call_args_list[0]

        assert kwargs == {"foo": "bar", "baz": "qux"}

    @patch("streamlit.connections.sql_connection.SQL._connect", MagicMock())
    @patch("streamlit.connections.sql_connection.pd.read_sql")
    def test_query_caches_value(self, patched_read_sql):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        patched_read_sql.return_value = "i am a dataframe"

        conn = SQL("my_sql_connection")

        assert conn.query("SELECT 1;") == "i am a dataframe"
        assert conn.query("SELECT 1;") == "i am a dataframe"
        patched_read_sql.assert_called_once()

    @patch("streamlit.connections.sql_connection.SQL._connect", MagicMock())
    def test_repr_html_(self):
        conn = SQL("my_sql_connection")
        with conn.session() as s:
            s.bind.dialect.name = "postgres"
        repr_ = conn._repr_html_()

        assert (
            "st.connection my_sql_connection built from `streamlit.connections.sql_connection.SQL`"
            in repr_
        )
        assert "Dialect: `postgres`" in repr_

    @patch("streamlit.connections.sql_connection.SQL._connect", MagicMock())
    @patch(
        "streamlit.connections.sql_connection.SQL._secrets",
        PropertyMock(return_value=AttrDict({"url": "some_sql_conn_string"})),
    )
    def test_repr_html_with_secrets(self):
        conn = SQL("my_sql_connection")
        with conn.session() as s:
            s.bind.dialect.name = "postgres"
        repr_ = conn._repr_html_()

        assert (
            "st.connection my_sql_connection built from `streamlit.connections.sql_connection.SQL`"
            in repr_
        )
        assert "Dialect: `postgres`" in repr_
        assert "Configured from `[connections.my_sql_connection]`" in repr_

    @parameterized.expand([(DatabaseError,), (InternalError,), (OperationalError,)])
    @patch("streamlit.connections.sql_connection.SQL._connect", MagicMock())
    @patch("streamlit.connections.sql_connection.pd.read_sql")
    def test_retry_behavior(self, error_class, patched_read_sql):
        patched_read_sql.side_effect = error_class("kaboom", params=None, orig=None)

        conn = SQL("my_sql_connection")

        with patch.object(conn, "reset", wraps=conn.reset) as wrapped_reset:
            with pytest.raises(error_class):
                conn.query("SELECT 1;")

            # Our connection should have been reset after each failed attempt to call
            # query.
            assert wrapped_reset.call_count == 3

        # conn._connect should have been called three times: once in the initial
        # connection, then once each after the second and third attempts to call
        # query.
        assert conn._connect.call_count == 3
        conn._connect.reset_mock()

    @patch("streamlit.connections.sql_connection.SQL._connect", MagicMock())
    @patch("streamlit.connections.sql_connection.pd.read_sql")
    def test_retry_behavior_fails_fast_for_most_errors(self, patched_read_sql):
        patched_read_sql.side_effect = Exception("kaboom")

        conn = SQL("my_sql_connection")

        with pytest.raises(Exception):
            conn.query("SELECT 1;")

        # conn._connect should have just been called once when first creating the
        # connection.
        assert conn._connect.call_count == 1
        conn._connect.reset_mock()
