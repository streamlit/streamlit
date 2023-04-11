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
import sys
import threading
import unittest
from unittest.mock import MagicMock, mock_open, patch

import pytest
from parameterized import parameterized

from streamlit.connections import SQL, ExperimentalBaseConnection, Snowpark
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching.cache_resource_api import _resource_caches
from streamlit.runtime.connection_factory import (
    _create_connection,
    _get_first_party_connection,
    connection_factory,
)
from streamlit.runtime.scriptrunner import add_script_run_ctx
from streamlit.runtime.secrets import secrets_singleton
from tests.testutil import create_mock_script_run_ctx


class MockConnection(ExperimentalBaseConnection[None]):
    def _connect(self, **kwargs):
        pass


class ConnectionFactoryTest(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()

        # st.secrets modifies os.environ, so we save it here and
        # restore in tearDown.
        self._prev_environ = dict(os.environ)

        # Caching functions rely on an active script run ctx
        add_script_run_ctx(threading.current_thread(), create_mock_script_run_ctx())

    def tearDown(self) -> None:
        super().tearDown()

        secrets_singleton._reset()
        _resource_caches.clear_all()

        os.environ.clear()
        os.environ.update(self._prev_environ)

    def test_create_connection_helper_explodes_if_not_ExperimentalBaseConnection_subclass(
        self,
    ):
        class NotABaseConnection:
            pass

        with pytest.raises(StreamlitAPIException) as e:
            _create_connection("my_connection", NotABaseConnection)

        assert "is not a subclass of ExperimentalBaseConnection" in str(e.value)

    @parameterized.expand(
        [
            ("snowpark", Snowpark),
            ("sql", SQL),
        ]
    )
    def test_get_first_party_connection_helper(
        self, connection_class_name, expected_connection_class
    ):
        assert (
            _get_first_party_connection(connection_class_name)
            == expected_connection_class
        )

    def test_get_first_party_connection_helper_errors_when_invalid(self):
        with pytest.raises(StreamlitAPIException) as e:
            _get_first_party_connection("not_a_first_party_connection")

        assert "Invalid connection" in str(e.value)

    @parameterized.expand(
        [
            # No type is specified, and there's no config file to find one
            # in.
            (None, FileNotFoundError, "No secrets files found"),
            # Nonexistent module.
            (
                "nonexistent.module.SomeConnection",
                ModuleNotFoundError,
                "No module named 'nonexistent'",
            ),
            # The module exists, but the connection_class doesn't.
            (
                "streamlit.connections.Nonexistent",
                AttributeError,
                "module 'streamlit.connections' has no attribute 'Nonexistent'",
            ),
            # Invalid first party connection name.
            (
                "not_a_first_party_connection",
                StreamlitAPIException,
                "Invalid connection 'not_a_first_party_connection'",
            ),
        ]
    )
    def test_connection_factory_errors(
        self, type, expected_error_class, expected_error_msg
    ):
        with pytest.raises(expected_error_class) as e:
            connection_factory("nonexistsent_connection", type=type)

        assert expected_error_msg in str(e.value)

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_specify_class_with_full_name_in_kwargs(
        self, patched_create_connection
    ):
        connection_factory("my_connection", type="streamlit.connections.SQL")

        patched_create_connection.assert_called_once_with(
            "my_connection", SQL, max_entries=None, ttl=None
        )

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_specify_first_party_class_in_kwargs(self, patched_create_connection):
        connection_factory("my_connection", type="sql")

        patched_create_connection.assert_called_once_with(
            "my_connection", SQL, max_entries=None, ttl=None
        )

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_specify_class_with_full_name_in_config(
        self, patched_create_connection
    ):
        mock_toml = """
[connections.my_connection]
type="streamlit.connections.SQL"
"""
        with patch("builtins.open", new_callable=mock_open, read_data=mock_toml):
            connection_factory("my_connection")

        patched_create_connection.assert_called_once_with(
            "my_connection", SQL, max_entries=None, ttl=None
        )

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_specify_first_party_class_in_config(self, patched_create_connection):
        mock_toml = """
[connections.my_connection]
type="snowpark"
"""
        with patch("builtins.open", new_callable=mock_open, read_data=mock_toml):
            connection_factory("my_connection")

        patched_create_connection.assert_called_once_with(
            "my_connection", Snowpark, max_entries=None, ttl=None
        )

    def test_can_pass_class_directly_to_factory_func(self):
        conn = connection_factory("my_connection", MockConnection, foo="bar")
        assert conn._connection_name == "my_connection"
        assert conn._kwargs == {"foo": "bar"}

    def test_caches_connection_instance(self):
        conn = connection_factory("my_connection", MockConnection)
        assert connection_factory("my_connection", MockConnection) is conn

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

        patched_create_connection.side_effect = ModuleNotFoundError(
            f"No module named '{missing_module}'"
        )

        with pytest.raises(ModuleNotFoundError) as e:
            connection_factory("my_connection", MockConnection)
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
            connection_factory("my_connection", MockConnection)
        assert str(e.value) == (
            "No module named 'foo'. "
            "You may be missing a dependency required to use this connection."
        )

    @pytest.mark.skip(
        reason="Existing tests import some of these modules, so we need to figure out some other way to test this."
    )
    def test_optional_dependencies_not_imported(self):
        """Test that the dependencies of first party connections aren't transitively
        imported just by importing the connection_factory function.
        """

        DISALLOWED_IMPORTS = ["sqlalchemy"]

        modules = list(sys.modules.keys())

        for m in modules:
            for disallowed_import in DISALLOWED_IMPORTS:
                assert disallowed_import not in m

    @patch("streamlit.runtime.connection_factory._create_connection")
    def test_can_set_connection_name_via_env_var(self, patched_create_connection):
        os.environ["MY_CONN_NAME"] = "staging"
        connection_factory("env:MY_CONN_NAME", MockConnection)

        patched_create_connection.assert_called_once_with(
            "staging", MockConnection, max_entries=None, ttl=None
        )
