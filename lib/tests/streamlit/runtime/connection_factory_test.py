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

import pytest
from parameterized import parameterized

from streamlit.connections import BaseConnection
from streamlit.runtime.connection_factory import _create_connection, connection_factory
from streamlit.runtime.scriptrunner import add_script_run_ctx
from tests.testutil import create_mock_script_run_ctx


class MockConnection(BaseConnection[None]):
    _default_connection_name = "mock_connection"

    def connect(self, **kwargs):
        pass


class ConnectionFactoryTest(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()

        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self) -> None:
        super().tearDown()
        _create_connection.clear()

    def test_passes_name_and_args_to_class(self):
        conn = connection_factory(MockConnection, name="nondefault", foo="bar")
        assert conn._connection_name == "nondefault"
        assert conn._kwargs == {"foo": "bar"}

    def test_caches_connection_instance(self):
        conn = connection_factory(MockConnection)
        assert connection_factory(MockConnection) is conn

    @parameterized.expand(
        [
            ("sqlalchemy", "sqlalchemy"),
            ("snowflake", "snowflake-snowpark-python"),
            ("snowflake.snowpark", "snowflake-snowpark-python"),
        ]
    )
    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_friendly_error_with_certain_missing_dependencies(
        self, missing_module, pypi_package, patched_create_connection
    ):
        """Test that our error messages are extra-friendly when a ModuleNotFoundError
        error is thrown for certain missing packages.
        """

        _create_connection.clear()
        patched_create_connection.side_effect = ModuleNotFoundError(
            f"No module named '{missing_module}'"
        )

        with pytest.raises(ModuleNotFoundError) as e:
            connection_factory(MockConnection)
        assert str(e.value) == (
            f"No module named '{missing_module}'. "
            f"You need to install the '{pypi_package}' package to use this connection."
        )

    @patch(
        "streamlit.runtime.connection_factory._create_connection",
        MagicMock(side_effect=ModuleNotFoundError("No module named 'foo'")),
    )
    def test_generic_missing_dependency_error(self):
        """Test our generic error message when a ModuleNotFoundError is thrown."""
        with pytest.raises(ModuleNotFoundError) as e:
            connection_factory(MockConnection)
        assert str(e.value) == (
            "No module named 'foo'. "
            "You may be missing a dependency required to use this connection."
        )
