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

import datetime
import unittest
from typing import Callable
from unittest.mock import MagicMock, mock_open, patch

import pandas as pd
from parameterized import parameterized

import streamlit
from streamlit.runtime import metrics_util
from streamlit.runtime.scriptrunner import get_script_run_ctx
from tests.delta_generator_test_case import DeltaGeneratorTestCase

MAC = "mac"
UUID = "uuid"
FILENAME = "/some/id/file"
mock_get_path = MagicMock(return_value=FILENAME)


class MetricsUtilTest(unittest.TestCase):
    def setUp(self):
        self.patch1 = patch("streamlit.file_util.os.stat")
        self.os_stat = self.patch1.start()

    def tearDown(self):
        self.patch1.stop()

    def test_machine_id_v3_from_etc(self):
        """Test getting the machine id from /etc"""
        file_data = "etc"

        with patch(
            "streamlit.runtime.metrics_util.uuid.getnode", return_value=MAC
        ), patch(
            "streamlit.runtime.metrics_util.open",
            mock_open(read_data=file_data),
            create=True,
        ), patch(
            "streamlit.runtime.metrics_util.os.path.isfile"
        ) as path_isfile:

            def path_isfile(path):
                return path == "/etc/machine-id"

            machine_id = metrics_util._get_machine_id_v3()
        self.assertEqual(machine_id, file_data)

    def test_machine_id_v3_from_dbus(self):
        """Test getting the machine id from /var/lib/dbus"""
        file_data = "dbus"

        with patch(
            "streamlit.runtime.metrics_util.uuid.getnode", return_value=MAC
        ), patch(
            "streamlit.runtime.metrics_util.open",
            mock_open(read_data=file_data),
            create=True,
        ), patch(
            "streamlit.runtime.metrics_util.os.path.isfile"
        ) as path_isfile:

            def path_isfile(path):
                return path == "/var/lib/dbus/machine-id"

            machine_id = metrics_util._get_machine_id_v3()
        self.assertEqual(machine_id, file_data)

    def test_machine_id_v3_from_node(self):
        """Test getting the machine id as the mac address"""

        with patch(
            "streamlit.runtime.metrics_util.uuid.getnode", return_value=MAC
        ), patch("streamlit.runtime.metrics_util.os.path.isfile", return_value=False):

            machine_id = metrics_util._get_machine_id_v3()
        self.assertEqual(machine_id, MAC)


class PageTelemetryTest(DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            (streamlit.dataframe, "dataframe"),
            (streamlit._transparent_write, "magic"),
            (streamlit.write, "write"),
            (streamlit.cache, "cache"),
        ]
    )
    def test_get_callable_name(self, callable: Callable, expected_name: str):
        """Test getting the callable name _get_callable_name"""

        self.assertEqual(metrics_util._get_callable_name(callable), expected_name)

    @parameterized.expand(
        [
            (10, "int"),
            (0.01, "float"),
            (True, "bool"),
            (None, "NoneType"),
            (["1"], "list"),
            ({"foo": "bar"}, "dict"),
            ("foo", "str"),
            (datetime.date.today(), "datetime.date"),
            (datetime.datetime.today().time(), "datetime.time"),
            (pd.DataFrame(), "DataFrame"),
            (pd.Series(), "PandasSeries"),
        ]
    )
    def test_get_type_name(self, obj: object, expected_type: str):
        """Test getting the type name via _get_type_name"""

        self.assertEqual(metrics_util._get_type_name(obj), expected_type)

    def test_get_command_telemetry(self):
        """Test getting command telemetry via _get_command_telemetry"""

        # Test with dataframe command:
        command_metadata = metrics_util._get_command_telemetry(
            streamlit.dataframe, pd.DataFrame(), width=250
        )

        self.assertEqual(command_metadata.name, "dataframe")
        self.assertEqual(len(command_metadata.args), 2)
        self.assertEqual(
            str(command_metadata.args[0]).strip(),
            'k: "data"\nt: "DataFrame"\nm: "len:0"',
        )
        self.assertEqual(
            str(command_metadata.args[1]).strip(),
            'k: "width"\nt: "int"',
        )

        # Test with text_input command:
        command_metadata = metrics_util._get_command_telemetry(
            streamlit.text_input, label="text input", value="foo", disabled=True
        )

        self.assertEqual(command_metadata.name, "text_input")
        self.assertEqual(len(command_metadata.args), 3)
        self.assertEqual(
            str(command_metadata.args[0]).strip(),
            'k: "label"\nt: "str"\nm: "len:10"',
        )
        self.assertEqual(
            str(command_metadata.args[1]).strip(),
            'k: "value"\nt: "str"\nm: "len:3"',
        )
        self.assertEqual(
            str(command_metadata.args[2]).strip(),
            'k: "disabled"\nt: "bool"\nm: "val:True"',
        )

    def test_create_page_profile_message(self):
        """Test creating the page profile message via create_page_profile_message"""

        forward_msg = metrics_util.create_page_profile_message(
            commands=[
                metrics_util._get_command_telemetry(
                    streamlit.dataframe, pd.DataFrame(), width=250
                )
            ],
            exec_time=1000,
            prep_time=2000,
        )

        self.assertEqual(len(forward_msg.page_profile.commands), 1)
        self.assertEqual(forward_msg.page_profile.exec_time, 1000)
        self.assertEqual(forward_msg.page_profile.prep_time, 2000)
        self.assertEqual(forward_msg.page_profile.commands[0].name, "dataframe")

    def test_gather_metrics_decorator(self):
        """Test gather_metrics decorator"""

        ctx = get_script_run_ctx()
        ctx.reset()
        ctx.gather_usage_stats = True

        @metrics_util.gather_metrics
        def test_function(param1: int, param2: str, param3: float = 0.1) -> str:
            streamlit.markdown("This command should not be tracked")
            return "foo"

        test_function(param1=10, param2="foobar")

        self.assertEqual(len(ctx.tracked_commands), 1)
        self.assertEqual(ctx.tracked_commands[0].name, "test_function")

        streamlit.markdown("This function should be tracked")

        self.assertEqual(len(ctx.tracked_commands), 2)
        self.assertEqual(ctx.tracked_commands[0].name, "test_function")
        self.assertEqual(ctx.tracked_commands[1].name, "markdown")

        ctx.reset()
        # Deactivate usage stats gathering
        ctx.gather_usage_stats = False

        self.assertEqual(len(ctx.tracked_commands), 0)
        test_function(param1=10, param2="foobar")
        self.assertEqual(len(ctx.tracked_commands), 0)
