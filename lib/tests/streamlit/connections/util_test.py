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

import unittest
from unittest.mock import MagicMock, mock_open, patch

import pytest

from streamlit.connections.util import (
    extract_from_dict,
    load_from_snowsql_config_file,
    running_in_sis,
)


class ConnectionUtilTest(unittest.TestCase):
    def test_extract_from_dict(self):
        d = {"k1": "v1", "k2": "v2", "k3": "v3", "k4": "v4"}

        extracted = extract_from_dict(
            ["k1", "k2", "nonexistent_key"],
            d,
        )

        assert extracted == {"k1": "v1", "k2": "v2"}
        assert d == {"k3": "v3", "k4": "v4"}

    @pytest.mark.require_snowflake
    @patch("snowflake.connector.connection", MagicMock())
    def test_not_running_in_sis(self):
        assert not running_in_sis()

    @pytest.mark.require_snowflake
    @patch(
        "snowflake.connector.connection",
    )
    def test_running_in_sis(self, patched_connection):
        delattr(patched_connection, "SnowflakeConnection")
        assert running_in_sis()

    def test_load_from_snowsql_config_file_no_file(self):
        assert load_from_snowsql_config_file("my_snowpark_connection") == {}

    @patch(
        "streamlit.connections.util.os.path.exists",
        MagicMock(return_value=True),
    )
    def test_load_from_snowsql_config_file_no_section(self):
        with patch("builtins.open", new_callable=mock_open, read_data=""):
            assert load_from_snowsql_config_file("my_snowpark_connection") == {}

    @patch(
        "streamlit.connections.util.os.path.exists",
        MagicMock(return_value=True),
    )
    def test_load_from_snowsql_config_file_named_section(self):
        config_data = """
[connections.my_snowpark_connection]
accountname = "hello"
dbname = notPostgres

[connections]
accountname = "i get overwritten"
schemaname = public
"""
        with patch("builtins.open", new_callable=mock_open, read_data=config_data):
            assert load_from_snowsql_config_file("my_snowpark_connection") == {
                "account": "hello",
                "database": "notPostgres",
            }

    @patch(
        "streamlit.connections.util.os.path.exists",
        MagicMock(return_value=True),
    )
    def test_load_from_snowsql_config_file_default_section(self):
        config_data = """
[connections]
accountname = "not overwritten"
schemaname = public
"""
        with patch("builtins.open", new_callable=mock_open, read_data=config_data):
            assert load_from_snowsql_config_file("my_snowpark_connection") == {
                "account": "not overwritten",
                "schema": "public",
            }
