# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import builtins
import contextlib
import datetime
import inspect
import sys
import unittest
from collections import Counter
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, mock_open, patch

import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
import streamlit.components.v1 as components
from streamlit import config
from streamlit.components.v1.custom_component import CustomComponent
from streamlit.connections import SnowparkConnection, SQLConnection
from streamlit.runtime import metrics_util
from streamlit.runtime.caching import cache_data_api, cache_resource_api
from streamlit.runtime.scriptrunner import get_script_run_ctx, magic_funcs
from streamlit.runtime.scriptrunner_utils.exceptions import RerunException
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.testutil import create_pep649_function

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator
    from pathlib import Path

MAC = "mac"
UUID = "uuid"
FILENAME = "/some/id/file"
mock_get_path = MagicMock(return_value=FILENAME)


def _mock_script_run_ctx() -> MagicMock:
    """Build a script run context for ``gather_metrics`` tests."""
    ctx = MagicMock()
    ctx.gather_usage_stats = True
    ctx.command_tracking_deactivated = False
    ctx.tracked_commands = []
    ctx.tracked_commands_counter = Counter()
    ctx.fragment_ids_this_run = []
    return ctx


class MetricsUtilTest(unittest.TestCase):
    def setUp(self):
        self.patch1 = patch("streamlit.file_util.os.stat")
        self.os_stat = self.patch1.start()

    def tearDown(self):
        self.patch1.stop()

    def test_machine_id_v3_from_etc(self):
        """Test getting the machine id from /etc"""
        file_data = "etc"

        with (
            patch("streamlit.runtime.metrics_util.uuid.getnode", return_value=MAC),
            patch(
                "streamlit.runtime.metrics_util.open",
                mock_open(read_data=file_data),
                create=True,
            ),
            patch(
                "streamlit.runtime.metrics_util.os.path.isfile",
                side_effect=lambda path: path == "/etc/machine-id",
            ),
        ):
            machine_id = metrics_util._get_machine_id_v3()
        assert machine_id == file_data

    def test_machine_id_v3_from_dbus(self):
        """Test getting the machine id from /var/lib/dbus"""
        file_data = "dbus"

        with (
            patch("streamlit.runtime.metrics_util.uuid.getnode", return_value=MAC),
            patch(
                "streamlit.runtime.metrics_util.open",
                mock_open(read_data=file_data),
                create=True,
            ),
            patch(
                "streamlit.runtime.metrics_util.os.path.isfile",
                side_effect=lambda path: path == "/var/lib/dbus/machine-id",
            ),
        ):
            machine_id = metrics_util._get_machine_id_v3()
        assert machine_id == file_data

    def test_machine_id_v3_from_node(self):
        """Test getting the machine id as the mac address"""

        with (
            patch("streamlit.runtime.metrics_util.uuid.getnode", return_value=MAC),
            patch("streamlit.runtime.metrics_util.os.path.isfile", return_value=False),
        ):
            machine_id = metrics_util._get_machine_id_v3()
        assert machine_id == MAC

    @patch(
        "streamlit.runtime.metrics_util.file_util.get_streamlit_file_path",
        mock_get_path,
    )
    def test_stable_id_not_exists(self):
        """Test creating a stable id"""

        with (
            patch("streamlit.runtime.metrics_util.os.path.exists", return_value=False),
            patch("streamlit.runtime.metrics_util.uuid.uuid4", return_value=UUID),
            patch("streamlit.file_util.open", mock_open()) as file_open,
            patch("streamlit.file_util.os.makedirs"),
            patch_config_options({"browser.gatherUsageStats": True}),
        ):
            machine_id = metrics_util._get_machine_id_v4()
            file_open().write.assert_called_once_with(UUID)
        assert machine_id == UUID

    @patch(
        "streamlit.runtime.metrics_util.file_util.get_streamlit_file_path",
        mock_get_path,
    )
    def test_stable_id_exists_and_valid(self):
        """Test getting a stable valid id"""

        with (
            patch("streamlit.runtime.metrics_util.os.path.exists", return_value=True),
            patch("streamlit.file_util.open", mock_open(read_data=UUID)) as file_open,
            patch_config_options({"browser.gatherUsageStats": True}),
        ):
            machine_id = metrics_util._get_machine_id_v4()
            file_open().read.assert_called_once()
        assert machine_id == UUID

    @patch(
        "streamlit.runtime.metrics_util.file_util.get_streamlit_file_path",
        mock_get_path,
    )
    def test_stable_id_exists_and_invalid(self):
        """Test getting a stable invalid id"""

        with (
            patch("streamlit.runtime.metrics_util.os.path.exists", return_value=True),
            patch("streamlit.runtime.metrics_util.uuid.uuid4", return_value=UUID),
            patch("streamlit.file_util.open", mock_open(read_data="")) as file_open,
            patch("streamlit.file_util.os.makedirs"),
            patch_config_options({"browser.gatherUsageStats": True}),
        ):
            machine_id = metrics_util._get_machine_id_v4()
            file_open().read.assert_called_once()
            file_open().write.assert_called_once_with(UUID)
        assert machine_id == UUID


class PageTelemetryTest(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        ctx = get_script_run_ctx()
        assert ctx is not None

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
            (pd.Series(dtype="float64"), "PandasSeries"),
            # Also support classes as input
            (datetime.date, "datetime.date"),
            (pd.DataFrame, "DataFrame"),
            (SnowparkConnection, "SnowparkConnection"),
            (SQLConnection, "SQLConnection"),
        ]
    )
    def test_get_type_name(self, obj: object, expected_type: str):
        """Test getting the type name via _get_type_name"""
        assert metrics_util._get_type_name(obj) == expected_type

    def test_get_command_telemetry(self):
        """Test getting command telemetry via _get_command_telemetry."""
        # Test with dataframe command:
        command_metadata = metrics_util._get_command_telemetry(
            st.dataframe, "dataframe", pd.DataFrame(), width=250
        )

        assert command_metadata.name == "dataframe"
        assert len(command_metadata.args) == 2
        assert (
            str(command_metadata.args[0]).strip()
            == 'k: "data"\nt: "DataFrame"\nm: "len:0"'
        )
        assert str(command_metadata.args[1]).strip() == 'k: "width"\nt: "int"'

        # Test with text_input command:
        command_metadata = metrics_util._get_command_telemetry(
            st.text_input, "text_input", label="text input", value="foo", disabled=True
        )

        assert command_metadata.name == "text_input"
        assert len(command_metadata.args) == 3
        assert (
            str(command_metadata.args[0]).strip() == 'k: "label"\nt: "str"\nm: "len:10"'
        )
        assert (
            str(command_metadata.args[1]).strip() == 'k: "value"\nt: "str"\nm: "len:3"'
        )
        assert (
            str(command_metadata.args[2]).strip()
            == 'k: "disabled"\nt: "bool"\nm: "val:True"'
        )

    def test_get_command_telemetry_custom_component_v2(self):
        """Test getting command telemetry for Custom Components v2 via _get_command_telemetry."""

        def fake_bidi_component(
            self, component_name: str, **_kwargs: Any
        ) -> None:  # pragma: no cover - never executed
            del self, component_name, _kwargs

        fake_bidi_component.__module__ = "streamlit.components.v2.bidi_component"

        # Test with a Custom Components v2 call
        command_metadata = metrics_util._get_command_telemetry(
            fake_bidi_component,
            "_bidi_component",
            MagicMock(name="delta_generator_instance"),
            "my_custom_component",
            key="test",
        )

        assert command_metadata.name == "component_v2:my_custom_component"
        assert len(command_metadata.args) == 2
        assert (
            str(command_metadata.args[0]).strip()
            == 'k: "component_name"\nt: "str"\nm: "len:19"\np: 1'
        )
        assert str(command_metadata.args[1]).strip() == 'k: "key"\nt: "str"\nm: "len:4"'

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

        assert len(forward_msg.page_profile.commands) == 1
        assert forward_msg.page_profile.exec_time == 1000
        assert forward_msg.page_profile.prep_time == 2000
        assert forward_msg.page_profile.commands[0].name == "dataframe"
        assert not forward_msg.page_profile.is_fragment_run

    def test_create_page_profile_message_is_fragment_run(self):
        ctx = get_script_run_ctx()
        ctx.fragment_ids_this_run = ["some_fragment_id"]

        forward_msg = metrics_util.create_page_profile_message(
            commands=[
                metrics_util._get_command_telemetry(
                    st.dataframe, "dataframe", pd.DataFrame(), width=250
                )
            ],
            exec_time=1000,
            prep_time=2000,
        )

        assert forward_msg.page_profile.is_fragment_run

    def test_gather_metrics_decorator(self):
        """The gather_metrics decorator works as expected."""
        ctx = get_script_run_ctx()
        assert ctx is not None

        @metrics_util.gather_metrics("test_function")
        def test_function(param1: int, param2: str, param3: float = 0.1) -> str:
            st.markdown("This command should not be tracked")
            st.text_input("This command should also not be tracked")
            st.text("This command should also not be tracked")
            return "foo"

        test_function(param1=10, param2="foobar")

        assert len(ctx.tracked_commands) == 1
        assert ctx.tracked_commands[0].name.endswith("test_function")
        assert ctx.tracked_commands[0].name.startswith("external:")

        st.markdown("This function should be tracked")

        assert len(ctx.tracked_commands) == 2
        assert ctx.tracked_commands[0].name.endswith("test_function")
        assert ctx.tracked_commands[0].name.startswith("external:")
        assert ctx.tracked_commands[1].name == "markdown"

        ctx.reset()
        # Deactivate usage stats gathering
        ctx.gather_usage_stats = False

        assert len(ctx.tracked_commands) == 0
        test_function(param1=10, param2="foobar")
        assert len(ctx.tracked_commands) == 0

    @parameterized.expand(
        [
            (magic_funcs.transparent_write, "magic"),
            (st.cache_data.clear, "clear_data_caches"),
            (st.cache_resource.clear, "clear_resource_caches"),
            (st.session_state.__setattr__, "session_state.set_attr"),
            (st.session_state.__setitem__, "session_state.set_item"),
            (cache_data_api.DataCache.write_result, "_cache_data_object"),
            (
                cache_resource_api.ResourceCache.write_result,
                "_cache_resource_object",
            ),
            (components.html, "_html"),
            (components.iframe, "_iframe"),
            (st.query_params.__setattr__, "query_params.set_attr"),
            (st.query_params.__getattr__, "query_params.get_attr"),
            (st.query_params.__setitem__, "query_params.set_item"),
            (st.query_params.__getitem__, "query_params.get_item"),
        ]
    )
    def test_internal_api_commands(
        self, command: Callable[..., Any], expected_name: str
    ):
        """Some internal functions are also tracked and should use the correct name."""
        ctx = get_script_run_ctx()
        assert ctx is not None

        # This will always throw an exception because of missing arguments
        # This is fine since the command still get tracked
        with contextlib.suppress(Exception):
            command()

        assert len(ctx.tracked_commands) > 0, f"No command tracked for {expected_name}"

        # Sometimes multiple commands are executed
        # so we check the full list of tracked commands
        assert expected_name in [
            tracked_commands.name for tracked_commands in ctx.tracked_commands
        ], f"Command {expected_name} was not tracked."

    def test_public_api_commands(self):
        """All commands of the public API should be tracked with the correct name."""
        # Some commands are currently not tracked for various reasons:
        ignored_commands = {
            # We need to ignore `connection` because the `@gather_metrics` decorator is
            # attached to a helper function rather than the publicly-exported function,
            # which causes it not to be executed before an Exception is raised due to a
            # lack of required arguments.
            "connection",
            "spinner",
            "progress",
            "context",
            "login",
            "logout",
            # st.App is a class for creating ASGI applications, not a tracked command
            "App",
        }

        # Create a list of all public API names in the `st` module (minus
        # the ignored commands from above).
        public_api_names = sorted(
            [
                k
                for k, v in st.__dict__.items()
                if not k.startswith("_")
                and not isinstance(v, type(st))
                and k not in ignored_commands
            ]
        )

        for api_name in public_api_names:
            st_func = getattr(st, api_name)
            if not callable(st_func):
                continue

            # Reset tracked stats from previous calls.
            ctx = get_script_run_ctx()
            assert ctx is not None
            ctx.reset()
            ctx.gather_usage_stats = True

            # Call the API. This will often throw an exception due to missing
            # arguments. But that's fine: the command will still be tracked.
            with contextlib.suppress(Exception):
                st_func()

            # Assert that the API name is in the list of tracked commands.
            # (It's possible for multiple tracked commands to be issued as
            # the result of a single API call.)
            assert api_name in [cmd.name for cmd in ctx.tracked_commands], (
                (
                    f"When executing `st.{api_name}()`, we expect the string "
                    f'"{api_name}" to be in the list of tracked commands.'
                ),
            )

    def test_column_config_commands(self):
        """All commands of the public column config API should be tracked with the correct name."""
        # Create a list of all public API names in the `st` module (minus
        # the ignored commands from above).
        public_api_names = sorted(
            [
                k
                for k, v in st.column_config.__dict__.items()
                if not k.startswith("_") and not isinstance(v, type(st.column_config))
            ]
        )

        for api_name in public_api_names:
            st_func = getattr(st.column_config, api_name)
            if not callable(st_func):
                continue

            # Reset tracked stats from previous calls.
            ctx = get_script_run_ctx()
            assert ctx is not None
            ctx.reset()
            ctx.gather_usage_stats = True

            # Call the API. This will often throw an exception due to missing
            # arguments. But that's fine: the command will still be tracked.
            with contextlib.suppress(Exception):
                st_func()

            # Assert that the API name is in the list of tracked commands.
            # (It's possible for multiple tracked commands to be issued as
            # the result of a single API call.)
            assert f"column_config.{api_name}" in [
                cmd.name for cmd in ctx.tracked_commands
            ], (
                (
                    f"When executing `st.{api_name}()`, we expect the string "
                    f'"{api_name}" to be in the list of tracked commands.'
                ),
            )

    def test_command_tracking_limits(self):
        """Command tracking limits should be respected.

        Current limits are _MAX_TRACKED_PER_COMMAND (25) per unique command
        and _MAX_TRACKED_COMMANDS (400) in total.
        """
        ctx = get_script_run_ctx()
        assert ctx is not None
        ctx.reset()
        ctx.gather_usage_stats = True

        # Create enough unique command names to exceed _MAX_TRACKED_COMMANDS
        # when each is called _MAX_TRACKED_PER_COMMAND + 1 times.
        # With 20 commands * 25 per command = 500, which exceeds the 400 limit.
        num_unique_commands = 20
        funcs = []
        for i in range(num_unique_commands):

            def test_function() -> str:
                return "foo"

            funcs.append(
                metrics_util.gather_metrics(f"test_function_{i}", test_function)
            )

        for _ in range(metrics_util._MAX_TRACKED_PER_COMMAND + 1):
            for func in funcs:
                func()

        assert len(ctx.tracked_commands) <= metrics_util._MAX_TRACKED_COMMANDS

        # Test that no individual command is tracked more than _MAX_TRACKED_PER_COMMAND
        command_counts = Counter(
            [command.name for command in ctx.tracked_commands]
        ).most_common()
        assert command_counts[0][1] <= metrics_util._MAX_TRACKED_PER_COMMAND


def test_get_arg_keywords_includes_positional_only_params() -> None:
    """Include positional-only and positional-or-keyword names like ``getfullargspec().args``."""

    def func_with_posonly(a: int, b: str, /, c: float, d: bool) -> None:
        pass

    def func_without_posonly(a: int, b: str, c: float, d: bool) -> None:
        pass

    expected = ["a", "b", "c", "d"]
    assert metrics_util._get_arg_keywords(func_with_posonly) == expected
    assert metrics_util._get_arg_keywords(func_without_posonly) == expected


def test_get_arg_keywords_caches_results_and_handles_bound_methods() -> None:
    """Verify caching works and bound methods include 'self' for backwards compatibility."""
    metrics_util._get_arg_keywords_cached.cache_clear()
    try:

        def simple_func(a: int, b: str) -> None:
            pass

        class MyClass:
            def my_method(self, x: int, y: str) -> None:
                pass

        # Test regular function caching
        result1 = metrics_util._get_arg_keywords(simple_func)
        result2 = metrics_util._get_arg_keywords(simple_func)
        assert result1 == ["a", "b"]
        assert result1 == result2
        cache_info = metrics_util._get_arg_keywords_cached.cache_info()
        assert cache_info.hits >= 1, "Cache should have hits for repeated calls"

        # Test bound method includes 'self' (backwards compatibility)
        obj = MyClass()
        bound_result = metrics_util._get_arg_keywords(obj.my_method)
        assert bound_result == ["self", "x", "y"], "Bound methods must include 'self'"

        # Test different bound instances share cache via __func__
        obj2 = MyClass()
        hits_before = metrics_util._get_arg_keywords_cached.cache_info().hits
        metrics_util._get_arg_keywords(obj2.my_method)
        hits_after = metrics_util._get_arg_keywords_cached.cache_info().hits
        assert hits_after > hits_before, (
            "Different instances should share cache via __func__"
        )
    finally:
        metrics_util._get_arg_keywords_cached.cache_clear()


def test_get_arg_keywords_classmethod_returns_cls() -> None:
    """Verify classmethod returns actual first parameter name 'cls', not 'self'."""

    class MyClass:
        @classmethod
        def class_method(cls, x: int) -> None:
            pass

    result = metrics_util._get_arg_keywords(MyClass.class_method)
    assert result == ["cls", "x"]


@pytest.mark.skipif(
    sys.version_info < (3, 14),
    reason="PEP 649 deferred annotation evaluation is only in Python 3.14+",
)
def test_get_arg_keywords_handles_pep649_annotations() -> None:
    """Collect argument names when PEP 649 annotations reference undefined types.

    On Python 3.14+, ``getfullargspec`` may fail on such callables; ``_get_arg_keywords``
    uses string annotations instead. See https://github.com/streamlit/streamlit/issues/14324.
    """

    def base_func(items: object, count: int) -> None:
        pass

    func = create_pep649_function(
        base_func, {"items": "UndefinedType", "count": "int", "return": "None"}
    )

    with pytest.raises((NameError, TypeError)):
        inspect.getfullargspec(func)

    assert metrics_util._get_arg_keywords(func) == ["items", "count"]


@pytest.mark.skipif(
    sys.version_info < (3, 14),
    reason="PEP 649 deferred annotation evaluation is only in Python 3.14+",
)
def test_gather_metrics_decorator_handles_pep649_annotations() -> None:
    """Decorate callables whose annotations break plain ``inspect.signature``.

    On Python 3.14+, undefined deferred annotations can raise ``NameError``; the
    decorator still wraps the callable. See https://github.com/streamlit/streamlit/issues/14324.
    """

    def base_func(items: object) -> str:
        return "result"

    func = create_pep649_function(
        base_func, {"items": "UndefinedType", "return": "str"}
    )

    with pytest.raises(NameError, match="UndefinedType"):
        inspect.signature(func)

    decorated = metrics_util.gather_metrics("test_command", func)
    assert decorated.__name__ == "base_func"
    assert decorated("test_items") == "result"


def test_installation_repr() -> None:
    """``Installation.__repr__`` delegates to ``util.repr_``."""
    inst = object.__new__(metrics_util.Installation)
    inst.installation_id_v3 = "test-v3"
    inst.installation_id_v4 = "test-v4"
    assert (
        repr(inst)
        == "Installation(installation_id_v3='test-v3', installation_id_v4='test-v4')"
    )


class _TypeUsesNameOnly:
    """Marker type; ``hasattr`` is patched to hide ``__qualname__`` in the test."""


def test_get_type_name_falls_back_to_name_without_qualname() -> None:
    """Use ``__name__`` when the type has no ``__qualname__`` (via patched ``hasattr``)."""
    real_hasattr = builtins.hasattr

    def selective_hasattr(obj: object, name: str) -> bool:
        if obj is _TypeUsesNameOnly and name == "__qualname__":
            return False
        return real_hasattr(obj, name)

    with patch("builtins.hasattr", side_effect=selective_hasattr):
        assert metrics_util._get_type_name(_TypeUsesNameOnly()) == (
            f"{_TypeUsesNameOnly.__module__}.{_TypeUsesNameOnly.__name__}"
        )


def test_get_type_name_returns_failed_when_type_introspection_raises() -> None:
    """Return ``failed`` when introspection raises (telemetry must not assume types are well-behaved)."""
    with patch(
        "streamlit.runtime.metrics_util.inspect.isclass",
        side_effect=RuntimeError("broken inspect"),
    ):
        assert metrics_util._get_type_name(object()) == "failed"


@pytest.mark.parametrize(
    "fake_module",
    [
        None,
        MagicMock(__name__=""),
    ],
    ids=["no_module", "empty_module_name"],
)
def test_get_top_level_module_returns_unknown_without_module_name(
    fake_module: object,
) -> None:
    """Return ``unknown`` when ``inspect.getmodule`` is missing or has no ``__name__``."""
    with patch(
        "streamlit.runtime.metrics_util.inspect.getmodule", return_value=fake_module
    ):

        def sample_func() -> None:
            pass

        assert metrics_util._get_top_level_module(sample_func) == "unknown"


def test_get_command_telemetry_maps_create_instance_to_component_name() -> None:
    """``create_instance`` telemetry uses ``component:<name>`` when ``self`` exposes ``name``."""
    self_arg = MagicMock()
    self_arg.name = "my_component"
    cmd = metrics_util._get_command_telemetry(
        CustomComponent.create_instance,
        "create_instance",
        self_arg,
        key="k",
    )
    assert cmd.name == "component:my_component"


def test_gather_metrics_empty_name_logs_warning_and_tracks_as_undefined() -> None:
    """Empty decorator name logs a warning and is normalized to ``undefined`` for tracking."""
    ctx = _mock_script_run_ctx()

    with (
        patch.object(metrics_util._LOGGER, "warning") as mock_warning,
        patch("streamlit.runtime.metrics_util.get_script_run_ctx", return_value=ctx),
        patch.object(metrics_util, "_get_top_level_module", return_value="streamlit"),
    ):

        @metrics_util.gather_metrics("")
        def tracked() -> str:
            return "x"

        assert tracked() == "x"

    mock_warning.assert_called_once_with("gather_metrics: name is empty")
    assert len(ctx.tracked_commands) == 1
    assert ctx.tracked_commands[0].name == "undefined"


def test_gather_metrics_swallows_command_telemetry_errors() -> None:
    """Failures in ``_get_command_telemetry`` are logged and do not break the wrapped call."""
    ctx = _mock_script_run_ctx()

    with (
        patch.object(metrics_util._LOGGER, "debug") as mock_debug,
        patch("streamlit.runtime.metrics_util.get_script_run_ctx", return_value=ctx),
        patch.object(
            metrics_util,
            "_get_command_telemetry",
            side_effect=RuntimeError("telemetry failed"),
        ),
    ):

        @metrics_util.gather_metrics("ok_name")
        def inner() -> int:
            return 42

        assert inner() == 42

    mock_debug.assert_called_once()
    assert mock_debug.call_args[0][0] == "Failed to collect command telemetry"
    assert ctx.tracked_commands == []


def test_gather_metrics_records_time_when_rerun_exception_raised() -> None:
    """``RerunException`` still records elapsed time on the active command telemetry."""
    ctx = _mock_script_run_ctx()

    timer_calls = iter([0.0, 0.25])
    with (
        patch("streamlit.runtime.metrics_util.get_script_run_ctx", return_value=ctx),
        # Patch the global timeit.default_timer because gather_metrics imports it
        # locally inside the function (not at module level).
        patch("timeit.default_timer", side_effect=lambda: next(timer_calls)),
    ):

        @metrics_util.gather_metrics("raises_rerun")
        def raises_rerun() -> None:
            raise RerunException(None)

        with pytest.raises(RerunException):
            raises_rerun()

    assert len(ctx.tracked_commands) == 1
    assert ctx.tracked_commands[0].time == metrics_util.to_microseconds(0.25)


@pytest.mark.parametrize("server_mode", ["tornado", "starlette-app"])
def test_create_page_profile_message_sets_server_mode(server_mode: str) -> None:
    """``server_mode`` is copied from ``config._server_mode`` when it is set."""
    with patch.object(config, "_server_mode", server_mode):
        msg = metrics_util.create_page_profile_message([], 0, 0)
        assert msg.page_profile.server_mode == server_mode


def test_create_page_profile_message_sets_uncaught_exception() -> None:
    """``uncaught_exception`` is forwarded into the page profile proto when provided."""
    exc_text = "ValueError: boom"
    msg = metrics_util.create_page_profile_message(
        [], 0, 0, uncaught_exception=exc_text
    )
    assert msg.page_profile.uncaught_exception == exc_text


def _make_skill_dir(base: Path, harness_dir: str, skill_name: str) -> Path:
    """Create a ``<skill_name>/SKILL.md`` marker under ``base/harness_dir``."""
    skill_dir = base / harness_dir / skill_name
    skill_dir.mkdir(parents=True)
    marker = skill_dir / "SKILL.md"
    marker.write_text(f"---\nname: {skill_name}\n---\n")
    return marker


@pytest.fixture(autouse=True)
def _clear_skills_cache() -> Iterator[None]:
    """Reset the skill-detection cache around each test in this module section."""
    metrics_util._detect_installed_skills_cached.cache_clear()
    metrics_util._detect_installed_agents_cached.cache_clear()
    yield
    metrics_util._detect_installed_skills_cached.cache_clear()
    metrics_util._detect_installed_agents_cached.cache_clear()


@pytest.mark.parametrize("location", ["home", "app", "repo"])
@pytest.mark.parametrize(
    ("harness", "project_dir", "home_dir"),
    [
        ("agents", ".agents/skills", ".agents/skills"),
        ("claude", ".claude/skills", ".claude/skills"),
        ("codex", ".codex/skills", ".codex/skills"),
        ("cortex", ".cortex/skills", ".snowflake/cortex/skills"),
        ("cursor", ".cursor/skills", ".cursor/skills"),
        ("gemini", ".gemini/skills", ".gemini/skills"),
        ("opencode", ".opencode/skills", ".config/opencode/skills"),
    ],
)
@pytest.mark.parametrize(
    "skill",
    ["developing-with-streamlit", "finding-streamlit-skills"],
)
def test_detect_installed_skills_emits_expected_token(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    location: str,
    harness: str,
    project_dir: str,
    home_dir: str,
    skill: str,
) -> None:
    """Each ``location:harness:skill`` combination is detected and emitted as a token."""
    home = tmp_path / "home"
    app = tmp_path / "repo" / "app"
    repo = tmp_path / "repo"
    home.mkdir()
    app.mkdir(parents=True)
    (repo / ".git").mkdir()

    roots = {"home": home, "app": app, "repo": repo}
    harness_dir = home_dir if location == "home" else project_dir
    _make_skill_dir(roots[location], harness_dir, skill)

    monkeypatch.setenv("HOME", str(home))
    tokens = metrics_util._detect_installed_skills(str(app))

    assert f"{location}:{harness}:{skill}" in tokens


def test_detect_installed_skills_empty_when_absent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Returns an empty list when no skills markers exist anywhere."""
    home = tmp_path / "home"
    app = tmp_path / "app"
    home.mkdir()
    app.mkdir()

    monkeypatch.setenv("HOME", str(home))
    assert metrics_util._detect_installed_skills(str(app)) == []


def test_detect_installed_skills_ignores_unrelated_skill_names(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Skills with names outside ``_STREAMLIT_SKILL_NAMES`` must not trigger detection."""
    home = tmp_path / "home"
    home.mkdir()
    _make_skill_dir(home, ".claude/skills", "some-other-skill")

    monkeypatch.setenv("HOME", str(home))
    assert metrics_util._detect_installed_skills(str(tmp_path / "app-missing")) == []


def test_detect_installed_skills_skips_repo_when_same_as_app(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When the app lives directly at the git root, ``repo`` tokens are deduped against ``app``."""
    home = tmp_path / "home"
    app_and_repo = tmp_path / "proj"
    home.mkdir()
    app_and_repo.mkdir()
    (app_and_repo / ".git").mkdir()
    _make_skill_dir(app_and_repo, ".claude/skills", "developing-with-streamlit")

    monkeypatch.setenv("HOME", str(home))
    tokens = metrics_util._detect_installed_skills(str(app_and_repo))

    assert tokens == ["app:claude:developing-with-streamlit"]


def test_detect_installed_skills_walks_up_to_repo_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Skills planted at the git-root ancestor show up under ``repo:``, not ``app:``."""
    home = tmp_path / "home"
    repo = tmp_path / "proj"
    app = repo / "nested" / "app"
    home.mkdir()
    app.mkdir(parents=True)
    (repo / ".git").mkdir()
    _make_skill_dir(repo, ".agents/skills", "finding-streamlit-skills")

    monkeypatch.setenv("HOME", str(home))
    tokens = metrics_util._detect_installed_skills(str(app))

    assert tokens == ["repo:agents:finding-streamlit-skills"]


def test_detect_installed_skills_returns_sorted_deduped_tokens(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Multiple hits across locations are returned sorted and without duplicates."""
    home = tmp_path / "home"
    repo = tmp_path / "proj"
    app = repo / "app"
    home.mkdir()
    app.mkdir(parents=True)
    (repo / ".git").mkdir()
    _make_skill_dir(home, ".cursor/skills", "developing-with-streamlit")
    _make_skill_dir(app, ".agents/skills", "finding-streamlit-skills")
    _make_skill_dir(repo, ".claude/skills", "developing-with-streamlit")

    monkeypatch.setenv("HOME", str(home))
    tokens = metrics_util._detect_installed_skills(str(app))

    assert tokens == [
        "app:agents:finding-streamlit-skills",
        "home:cursor:developing-with-streamlit",
        "repo:claude:developing-with-streamlit",
    ]


def test_detect_installed_skills_finds_project_skills_when_home_harness_absent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Project-level skills are detected even when the user has no harness installed at home.

    Guards against an over-broad short-circuit that would skip app/repo
    harness checks when the corresponding home directory doesn't exist.
    """
    home = tmp_path / "home"
    repo = tmp_path / "proj"
    app = repo / "app"
    home.mkdir()
    app.mkdir(parents=True)
    (repo / ".git").mkdir()
    # Note: no ``~/.claude`` directory is created — the user has never run
    # Claude Code. But the project ships skills under its own .claude dir.
    _make_skill_dir(app, ".claude/skills", "developing-with-streamlit")
    _make_skill_dir(repo, ".claude/skills", "finding-streamlit-skills")

    monkeypatch.setenv("HOME", str(home))
    tokens = metrics_util._detect_installed_skills(str(app))

    assert tokens == [
        "app:claude:developing-with-streamlit",
        "repo:claude:finding-streamlit-skills",
    ]


def test_detect_installed_skills_detects_symlinked_skill_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Symlinked skill directories are detected as if they were real directories."""
    home = tmp_path / "home"
    app = tmp_path / "app"
    home.mkdir()
    app.mkdir()

    # Create a real skill directory elsewhere
    real_skill = tmp_path / "external" / "developing-with-streamlit"
    real_skill.mkdir(parents=True)
    (real_skill / "SKILL.md").write_text("---\nname: developing-with-streamlit\n---\n")

    # Symlink it into the .claude/skills directory
    skills_dir = app / ".claude" / "skills"
    skills_dir.mkdir(parents=True)
    try:
        (skills_dir / "developing-with-streamlit").symlink_to(
            real_skill, target_is_directory=True
        )
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks not supported in this environment")

    monkeypatch.setenv("HOME", str(home))
    tokens = metrics_util._detect_installed_skills(str(app))

    assert tokens == ["app:claude:developing-with-streamlit"]


@pytest.mark.parametrize(
    "detected",
    [[], ["home:claude:developing-with-streamlit"]],
)
def test_create_page_profile_message_sets_installed_skills(
    detected: list[str],
) -> None:
    """``installed_skills`` is populated from the detection helper."""
    with patch(
        "streamlit.runtime.metrics_util._detect_installed_skills",
        return_value=detected,
    ):
        msg = metrics_util.create_page_profile_message([], 0, 0)
    assert list(msg.page_profile.installed_skills) == detected


@pytest.mark.parametrize(
    ("harness", "marker_dir"),
    [
        ("agents", ".agents"),
        ("claude", ".claude"),
        ("codex", ".codex"),
        ("cortex", ".snowflake/cortex"),
        ("cursor", ".cursor"),
        ("gemini", ".gemini"),
        ("opencode", ".config/opencode"),
    ],
)
def test_detect_installed_agents_finds_each_harness(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    harness: str,
    marker_dir: str,
) -> None:
    """Each harness is detected when its home-level marker directory exists."""
    home = tmp_path / "home"
    (home / marker_dir).mkdir(parents=True)

    monkeypatch.setenv("HOME", str(home))
    assert metrics_util._detect_installed_agents() == [harness]


def test_detect_installed_agents_empty_when_no_harnesses(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Returns an empty list when no harness marker directories exist."""
    home = tmp_path / "home"
    home.mkdir()

    monkeypatch.setenv("HOME", str(home))
    assert metrics_util._detect_installed_agents() == []


def test_detect_installed_agents_ignores_plain_snowflake(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """``.snowflake`` without a ``cortex`` subdirectory must not count as cortex."""
    home = tmp_path / "home"
    (home / ".snowflake").mkdir(parents=True)

    monkeypatch.setenv("HOME", str(home))
    assert metrics_util._detect_installed_agents() == []


def test_detect_installed_agents_returns_sorted_deduped_tokens(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Multiple harnesses are returned sorted and without duplicates."""
    home = tmp_path / "home"
    (home / ".cursor").mkdir(parents=True)
    (home / ".claude").mkdir(parents=True)
    (home / ".config/opencode").mkdir(parents=True)

    monkeypatch.setenv("HOME", str(home))
    assert metrics_util._detect_installed_agents() == ["claude", "cursor", "opencode"]


def test_detect_installed_agents_detects_symlinked_harness_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Symlinked harness directories are detected as if they were real directories."""
    home = tmp_path / "home"
    home.mkdir()

    # Create a real .claude directory elsewhere
    real_claude = tmp_path / "external" / ".claude"
    real_claude.mkdir(parents=True)

    # Symlink it into the home directory
    try:
        (home / ".claude").symlink_to(real_claude, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks not supported in this environment")

    monkeypatch.setenv("HOME", str(home))
    assert metrics_util._detect_installed_agents() == ["claude"]


@pytest.mark.parametrize(
    "detected",
    [[], ["claude", "codex"]],
)
def test_create_page_profile_message_sets_installed_agents(
    detected: list[str],
) -> None:
    """``installed_agents`` is populated from the detection helper."""
    with patch(
        "streamlit.runtime.metrics_util._detect_installed_agents",
        return_value=detected,
    ):
        msg = metrics_util.create_page_profile_message([], 0, 0)
    assert list(msg.page_profile.installed_agents) == detected
