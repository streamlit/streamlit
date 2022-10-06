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
import inspect
import os
import sys
import threading
import time
import uuid
from collections.abc import Sized
from functools import wraps
from timeit import default_timer as timer
from typing import Any, Callable, List, Optional, Set, TypeVar, Union, cast

from typing_extensions import Final

from streamlit import config, util
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.PageProfile_pb2 import Argument, Command

LOGGER = get_logger(__name__)

# Limit the number of commands to keep the page profile message small
# since Segment allows only a maximum of 32kb per event.
_MAX_TRACKED_COMMANDS: Final = 200
# Only track a maximum of 25 uses per unique command
_MAX_TRACKED_PER_COMMAND: Final = 25
# A mapping to convert from the actual name to preferred/shorter representations
_OBJECT_NAME_MAPPING: Final = {
    "streamlit.delta_generator.DeltaGenerator": "DG",
    "pandas.core.frame.DataFrame": "DataFrame",
    "plotly.graph_objs._figure.Figure": "PlotlyFigure",
    "bokeh.plotting.figure.Figure": "BokehFigure",
    "matplotlib.figure.Figure": "MatplotlibFigure",
    "pandas.io.formats.style.Styler": "PandasStyler",
    "pandas.core.indexes.base.Index": "PandasIndex",
    "pandas.core.series.Series": "PandasSeries",
}
_CALLABLE_NAME_MAPPING: Final = {
    "_transparent_write": "magic",
    "MemoAPI.__call__": "experimental_memo",
    "SingletonAPI.__call__": "experimental_singleton",
    "SingletonAPI.clear": "clear_singleton",
    "MemoAPI.clear": "clear_memo",
    "SingletonCache.write_result": "_cache_singleton_object",
    "MemoCache.write_result": "_cache_memo_object",
    "SessionStateProxy.__setattr__": "session_state.__setattr__",
    "SessionStateProxy.__setitem__": "session_state.__setitem__",
    "_write_to_cache": "_cache_object",
}
# A list of dependencies to check for attribution
_ATTRIBUTIONS_TO_CHECK: Final = ["snowflake"]

_ETC_MACHINE_ID_PATH = "/etc/machine-id"
_DBUS_MACHINE_ID_PATH = "/var/lib/dbus/machine-id"


def _get_machine_id_v3() -> str:
    """Get the machine ID

    This is a unique identifier for a user for tracking metrics in Segment,
    that is broken in different ways in some Linux distros and Docker images.
    - at times just a hash of '', which means many machines map to the same ID
    - at times a hash of the same string, when running in a Docker container
    """

    machine_id = str(uuid.getnode())
    if os.path.isfile(_ETC_MACHINE_ID_PATH):
        with open(_ETC_MACHINE_ID_PATH, "r") as f:
            machine_id = f.read()

    elif os.path.isfile(_DBUS_MACHINE_ID_PATH):
        with open(_DBUS_MACHINE_ID_PATH, "r") as f:
            machine_id = f.read()

    return machine_id


class Installation:
    _instance_lock = threading.Lock()
    _instance = None  # type: Optional[Installation]

    @classmethod
    def instance(cls) -> "Installation":
        """Returns the singleton Installation"""
        # We use a double-checked locking optimization to avoid the overhead
        # of acquiring the lock in the common case:
        # https://en.wikipedia.org/wiki/Double-checked_locking
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = Installation()
        return cls._instance

    def __init__(self):
        self.installation_id_v3 = str(
            uuid.uuid5(uuid.NAMESPACE_DNS, _get_machine_id_v3())
        )

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def installation_id(self):
        return self.installation_id_v3


def _get_type_name(obj: object) -> str:
    with contextlib.suppress(Exception):
        obj_type = type(obj)
        type_name = "unknown"
        if hasattr(obj_type, "__qualname__"):
            type_name = obj_type.__qualname__
        elif hasattr(obj_type, "__name__"):
            type_name = obj_type.__name__

        if obj_type.__module__ != "builtins":
            # Add the full module path
            type_name = f"{obj_type.__module__}.{type_name}"

        if type_name in _OBJECT_NAME_MAPPING:
            type_name = _OBJECT_NAME_MAPPING[type_name]
        return type_name
    return "failed"


def _get_callable_name(callable: Callable[..., Any]) -> str:
    with contextlib.suppress(Exception):
        name = "unknown"
        if inspect.isclass(callable):
            name = callable.__class__.__name__
        elif hasattr(callable, "__qualname__"):
            name = callable.__qualname__
        elif hasattr(callable, "__name__"):
            name = callable.__name__
        if name in _CALLABLE_NAME_MAPPING:
            name = _CALLABLE_NAME_MAPPING[name]
        elif "." in name:
            # Only return actual function name
            name = name.split(".")[-1]
        return name
    return "failed"


def _get_arg_metadata(arg: object) -> Optional[str]:
    with contextlib.suppress(Exception):
        if isinstance(arg, (bool)):
            return f"val:{arg}"

        if isinstance(arg, Sized):
            return f"len:{len(arg)}"

    return None


def _get_command_telemetry(callable: Callable[..., Any], *args, **kwargs) -> Command:
    arg_keywords = inspect.getfullargspec(callable).args
    self_arg: Optional[Any] = None
    arguments: List[Argument] = []
    is_method = inspect.ismethod(callable)

    for i, arg in enumerate(args):
        pos = i
        if is_method:
            # If the callable is a method, ignore the first argument (self)
            i = i + 1

        keyword = arg_keywords[i] if len(arg_keywords) > i else f"{i}"
        if keyword == "self":
            self_arg = arg
            continue
        argument = Argument(k=keyword, t=_get_type_name(arg), p=pos)

        arg_metadata = _get_arg_metadata(arg)
        if arg_metadata:
            argument.m = arg_metadata
        arguments.append(argument)
    for kwarg, kwarg_value in kwargs.items():
        argument = Argument(k=kwarg, t=_get_type_name(kwarg_value))

        arg_metadata = _get_arg_metadata(kwarg_value)
        if arg_metadata:
            argument.m = arg_metadata
        arguments.append(argument)
    name = _get_callable_name(callable)
    if (
        name == "create_instance"
        and self_arg
        and hasattr(self_arg, "name")
        and self_arg.name
    ):
        name = f"component:{self_arg.name}"
    return Command(name=name, args=arguments)


def to_microseconds(seconds):
    return int(seconds * 1000000)


F = TypeVar("F", bound=Callable[..., Any])


def gather_metrics(callable: F) -> F:
    @wraps(callable)
    def wrap(*args, **kwargs):
        exec_start = timer()
        from streamlit.runtime.scriptrunner import get_script_run_ctx

        ctx_import_time = timer()
        ctx = get_script_run_ctx()
        ctx_get_time = timer()

        tracking_activated = (
            ctx is not None
            and ctx.gather_usage_stats
            and not ctx.command_tracking_deactivated
            and len(ctx.tracked_commands)
            < _MAX_TRACKED_COMMANDS  # Prevent too much memory usage
        )
        command_telemetry: Union[Command, None] = None

        if ctx and tracking_activated:
            # Deactivate tracking to prevent calls inside already tracked commands
            ctx.command_tracking_deactivated = True
            try:
                command_telemetry = _get_command_telemetry(callable, *args, **kwargs)

                if (
                    command_telemetry.name not in ctx.tracked_commands_counter
                    or ctx.tracked_commands_counter[command_telemetry.name]
                    < _MAX_TRACKED_PER_COMMAND
                ):
                    ctx.tracked_commands.append(command_telemetry)
                    get_command_telemetry_time = timer()
                    counter_time = timer()

                    print(
                        f"{command_telemetry.name}: Time required for metrics gathering {to_microseconds(timer() - exec_start)},{to_microseconds(ctx_import_time-exec_start)},{to_microseconds(ctx_get_time-ctx_import_time)},{to_microseconds(get_command_telemetry_time-ctx_get_time)},{to_microseconds(counter_time-get_command_telemetry_time)}",
                        flush=True,
                    )
                ctx.tracked_commands_counter.update([command_telemetry.name])
            except Exception as ex:
                # Always capture all exceptions since we want to make sure that
                # the telemetry never causes any issues.
                LOGGER.debug("Failed to collect command telemetry", exc_info=ex)

        result = callable(*args, **kwargs)

        # Activate tracking again
        if ctx:
            ctx.command_tracking_deactivated = False

        if tracking_activated and command_telemetry:
            # Set the execution time to the measured value
            command_telemetry.time = to_microseconds(timer() - exec_start)
        return result

    with contextlib.suppress(AttributeError):
        # Make this a well-behaved decorator by preserving important function
        # attributes.
        wrap.__dict__.update(callable.__dict__)
        wrap.__signature__ = inspect.signature(callable)  # type: ignore
    return cast(F, wrap)


def create_page_profile_message(
    commands: List[Command],
    exec_time: int,
    prep_time: int,
    uncaught_exception: Optional[str] = None,
) -> ForwardMsg:
    """Create and return an PageProfile ForwardMsg."""

    msg = ForwardMsg()
    msg.page_profile.commands.extend(commands)
    msg.page_profile.exec_time = exec_time
    msg.page_profile.prep_time = prep_time

    with contextlib.suppress(Exception):
        msg.page_profile.headless = config.get_option("server.headless")

    # Collect all config options that have been manually set
    config_options: Set[str] = set()
    if config._config_options:
        for option_name in config._config_options.keys():
            if not config.is_manually_set(option_name):
                # We only care about manually defined options
                continue

            config_option = config._config_options[option_name]
            if config_option.is_default:
                option_name = f"{option_name}:default"
            config_options.add(option_name)

    msg.page_profile.config.extend(config_options)

    # Check the predefined set of modules for attribution
    attributions: Set[str] = {
        attribution
        for attribution in _ATTRIBUTIONS_TO_CHECK
        if attribution in sys.modules
    }

    msg.page_profile.os = str(sys.platform)
    msg.page_profile.timezone = str(time.tzname)
    msg.page_profile.attributions.extend(attributions)

    if uncaught_exception:
        msg.page_profile.uncaught_exception = uncaught_exception

    return msg
