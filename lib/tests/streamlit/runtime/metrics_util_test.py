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

import contextlib
import datetime
import unittest
from collections import Counter
from typing import Callable
from unittest.mock import MagicMock, mock_open, patch

import pandas as pd
from parameterized import parameterized

import streamlit as st
import streamlit.components.v1 as components
from streamlit.runtime import metrics_util
from streamlit.runtime.caching import cache_data_api, cache_resource_api
from streamlit.runtime.legacy_caching import caching
from streamlit.runtime.scriptrunner import get_script_run_ctx, magic_funcs
from streamlit.web.server import websocket_headers
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
            "streamlit.runtime.metrics_util.os.path.isfile",
            side_effect=lambda path: path == "/etc/machine-id",
        ):
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
            "streamlit.runtime.metrics_util.os.path.isfile",
            side_effect=lambda path: path == "/var/lib/dbus/machine-id",
        ):
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
    def setUp(self):
        super().setUp()
        ctx = get_script_run_ctx()
        ctx.reset()
        ctx.gather_usage_stats = True

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
        """Test getting command telemetry via _get_command_telemetry."""
        # Test with dataframe command:
        command_metadata = metrics_util._get_command_telemetry(
            st.dataframe, "dataframe", pd.DataFrame(), width=250
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
            st.text_input, "text_input", label="text input", value="foo", disabled=True
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
        """Test creating the page profile message via create_page_profile_message."""
        forward_msg = metrics_util.create_page_profile_message(
            commands=[
                metrics_util._get_command_telemetry(
                    st.dataframe, "dataframe", pd.DataFrame(), width=250
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
        """The gather_metrics decorator works as expected."""
        ctx = get_script_run_ctx()

        @metrics_util.gather_metrics("test_function")
        def test_function(param1: int, param2: str, param3: float = 0.1) -> str:
            st.markdown("This command should not be tracked")
            return "foo"

        test_function(param1=10, param2="foobar")

        self.assertEqual(len(ctx.tracked_commands), 1)
        self.assertTrue(ctx.tracked_commands[0].name.endswith("test_function"))
        self.assertTrue(ctx.tracked_commands[0].name.startswith("external:"))

        st.markdown("This function should be tracked")

        self.assertEqual(len(ctx.tracked_commands), 2)
        self.assertTrue(ctx.tracked_commands[0].name.endswith("test_function"))
        self.assertTrue(ctx.tracked_commands[0].name.startswith("external:"))
        self.assertEqual(ctx.tracked_commands[1].name, "markdown")

        ctx.reset()
        # Deactivate usage stats gathering
        ctx.gather_usage_stats = False

        self.assertEqual(len(ctx.tracked_commands), 0)
        test_function(param1=10, param2="foobar")
        self.assertEqual(len(ctx.tracked_commands), 0)

    @parameterized.expand(
        [
            (magic_funcs.transparent_write, "magic"),
            (st.experimental_memo.clear, "clear_memo"),
            (st.experimental_singleton.clear, "clear_singleton"),
            (st.session_state.__setattr__, "session_state.set_attr"),
            (st.session_state.__setitem__, "session_state.set_item"),
            (cache_data_api.DataCache.write_result, "_cache_memo_object"),
            (
                cache_resource_api.ResourceCache.write_result,
                "_cache_singleton_object",
            ),
            (caching._write_to_cache, "_cache_object"),
            (websocket_headers._get_websocket_headers, "_get_websocket_headers"),
            (components.html, "_html"),
            (components.iframe, "_iframe"),
        ]
    )
    def test_internal_api_commands(self, command: Callable, expected_name: str):
        """Some internal functions are also tracked and should use the correct name."""
        ctx = get_script_run_ctx()

        # This will always throw an exception because of missing arguments
        # This is fine since the command still get tracked
        with contextlib.suppress(Exception):
            command()

        self.assertGreater(
            len(ctx.tracked_commands),
            0,
            f"No command tracked for {expected_name}",
        )

        # Sometimes multiple commands are executed
        # so we check the full list of tracked commands
        self.assertIn(
            expected_name,
            [tracked_commands.name for tracked_commands in ctx.tracked_commands],
            f"Command {expected_name} was not tracked.",
        )

    def test_public_api_commands(self):
        """All commands of the public API should be tracked with the correct name."""
        ctx = get_script_run_ctx()

        # Some commands are currently not tracked for various reasons:
        ignored_commands = {
            "experimental_rerun",
            "stop",
            "spinner",
            "empty",
            "progress",
            "get_option",
        }

        public_commands = {
            k
            for k, v in st.__dict__.items()
            if not k.startswith("_") and not isinstance(v, type(st))
        }

        for command_name in public_commands.difference(ignored_commands):
            if command_name in ignored_commands:
                continue
            command = getattr(st, command_name)
            if callable(command):
                # This will always throw an exception because of missing arguments
                # This is fine since the command still get tracked
                with contextlib.suppress(Exception):
                    command()

                self.assertGreater(
                    len(ctx.tracked_commands),
                    0,
                    f"No command tracked for {command_name}",
                )

                # Sometimes also multiple commands are executed
                # so we check the full list.
                self.assertIn(
                    command_name,
                    [
                        tracked_commands.name
                        for tracked_commands in ctx.tracked_commands
                    ],
                )

                ctx.reset()
                ctx.gather_usage_stats = True

    def test_command_tracking_limits(self):
        """Command tracking limits should be respected.

        Current limits are 25 per unique command and 200 in total.
        """
        ctx = get_script_run_ctx()
        ctx.reset()
        ctx.gather_usage_stats = True

        funcs = []
        for i in range(10):

            def test_function() -> str:
                return "foo"

            funcs.append(
                metrics_util.gather_metrics(f"test_function_{i}", test_function)
            )

        for _ in range(metrics_util._MAX_TRACKED_PER_COMMAND + 1):
            for func in funcs:
                func()

        self.assertLessEqual(
            len(ctx.tracked_commands), metrics_util._MAX_TRACKED_COMMANDS
        )

        # Test that no individual command is tracked more than _MAX_TRACKED_PER_COMMAND
        command_counts = Counter(
            [command.name for command in ctx.tracked_commands]
        ).most_common()
        self.assertLessEqual(
            command_counts[0][1], metrics_util._MAX_TRACKED_PER_COMMAND
        )
