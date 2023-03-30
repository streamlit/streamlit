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
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

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
    @patch("sqlalchemy.engine.make_url", MagicMock(return_value="some_sql_conn_string"))
    @patch(
        "streamlit.connections.sql_connection.SQL.get_secrets",
        MagicMock(return_value=AttrDict({"url": "some_sql_conn_string"})),
    )
    @patch("sqlalchemy.create_engine")
    def test_url_set_explicitly_in_secrets(self, patched_create_engine):
        SQL()

        patched_create_engine.assert_called_once_with("some_sql_conn_string")

    @patch(
        "streamlit.connections.sql_connection.SQL.get_secrets",
        MagicMock(return_value=AttrDict(DB_SECRETS)),
    )
    @patch("sqlalchemy.create_engine")
    def test_url_constructed_from_secrets_params(self, patched_create_engine):
        SQL()

        patched_create_engine.assert_called_once()
        args, _ = patched_create_engine.call_args_list[0]
        assert (
            str(args[0])
            == "postgres+psycopg2://AzureDiamond:hunter2@localhost:5432/postgres"
        )

    @parameterized.expand([("dialect",), ("username",), ("host",)])
    def test_error_if_missing_required_param(self, missing_param):
        secrets = deepcopy(DB_SECRETS)
        del secrets[missing_param]

        with patch(
            "streamlit.connections.sql_connection.SQL.get_secrets",
            MagicMock(return_value=AttrDict(secrets)),
        ):
            with pytest.raises(StreamlitAPIException) as e:
                SQL()

            assert str(e.value) == f"Missing SQL DB connection param: {missing_param}"

    @patch("streamlit.connections.sql_connection.SQL.connect", MagicMock())
    @patch("streamlit.connections.sql_connection.pd.read_sql")
    def test_read_sql_caches_value(self, patched_read_sql):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())
        patched_read_sql.return_value = "i am a dataframe"

        conn = SQL()

        assert conn.read_sql("SELECT 1;") == "i am a dataframe"
        assert conn.read_sql("SELECT 1;") == "i am a dataframe"
        patched_read_sql.assert_called_once()
