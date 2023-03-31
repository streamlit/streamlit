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
from unittest.mock import MagicMock, patch

from streamlit.connections import Snowpark
from streamlit.runtime.scriptrunner import add_script_run_ctx
from tests.testutil import create_mock_script_run_ctx


class SnowparkConnectionTest(unittest.TestCase):
    @patch("streamlit.connections.snowpark_connection.Snowpark.connect", MagicMock())
    def test_read_sql_caches_value(self):
        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

        mock_sql_return = MagicMock()
        mock_sql_return.to_pandas = MagicMock(return_value="i am a dataframe")

        conn = Snowpark()
        conn._instance.sql.return_value = mock_sql_return

        assert conn.read_sql("SELECT 1;") == "i am a dataframe"
        assert conn.read_sql("SELECT 1;") == "i am a dataframe"
        conn._instance.sql.assert_called_once()
