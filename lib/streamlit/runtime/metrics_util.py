# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import contextlib
import inspect
import os
import sys
import threading
import time
import uuid
from collections.abc import Callable, Sized
from functools import wraps
from typing import Any, Final, TypeVar, cast, overload

from streamlit import config, file_util, util
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.PageProfile_pb2 import Argument, Command
from streamlit.runtime.scriptrunner_utils.exceptions import RerunException
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

_LOGGER: Final = get_logger(__name__)

# Limit the number of commands to keep the page profile message small
_MAX_TRACKED_COMMANDS: Final = 200
# Only track a maximum of 25 uses per unique command since some apps use
# commands excessively (e.g. calling add_rows thousands of times in one rerun)
# making the page profile useless.
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
    "streamlit.connections.snowpark_connection.SnowparkConnection": "SnowparkConnection",
    "streamlit.connections.sql_connection.SQLConnection": "SQLConnection",
}

# A list of dependencies to check for attribution
_ATTRIBUTIONS_TO_CHECK: Final = [
    # DB Clients:
    "pymysql",
    "MySQLdb",
    "mysql",
    "pymongo",
    "ibis",
    "boto3",
    "psycopg2",
    "psycopg3",
    "sqlalchemy",
    "elasticsearch",
    "pyodbc",
    "pymssql",
    "cassandra",
    "azure",
    "redis",
    "sqlite3",
    "neo4j",
    "duckdb",
    "opensearchpy",
    "supabase",
    "databricks",
    # Dataframe Libraries:
    "polars",
    "dask",
    "vaex",
    "modin",
    "pyspark",
    "cudf",
    "xarray",
    "ray",
    "geopandas",
    "mars",
    "tables",
    "zarr",
    "datasets",
    "daft",
    # ML & LLM Tools:
    "mistralai",
    "openai",
    "langchain",
    "llama_index",
    "llama_cpp",
    "anthropic",
    "pyllamacpp",
    "cohere",
    "transformers",
    "nomic",
    "diffusers",
    "semantic_kernel",
    "replicate",
    "huggingface_hub",
    "wandb",
    "torch",
    "tensorflow",
    "trubrics",
    "comet_ml",
    "clarifai",
    "reka",
    "hegel",
    "fastchat",
    "assemblyai",
    "openllm",
    "embedchain",
    "haystack",
    "vllm",
    "alpa",
    "jinaai",
    "guidance",
    "litellm",
    "comet_llm",
    "instructor",
    "xgboost",
    "lightgbm",
    "catboost",
    "sklearn",
    "pydantic_ai",
    "datachain",
    "docling",
    "litserve",
    "crawl4ai",
    "baml_client",
    "browser_use",
    "crewai",
    "unsloth",
    "langgraph",
    "dspy",
    "ultralytics",
    "instructor",
    "ragas",
    "swarm",
    "faster_whisper",
    "memori",
    "autogen_agentchat",
    "xai_sdk",
    "agno",
    "langfuse",
    "smolagents",
    "ollama",
    "groq",
    "together",
    "ai21",
    "marvin",
    "outlines",
    "guardrails",
    "promptflow",
    "semantic_router",
    "mem0",
    "aisuite",
    "mlflow",
    "optuna",
    "keras",
    "jax",
    "shap",
    "evidently",
    "great_expectations",
    "bentoml",
    "modal",
    "sagemaker",
    "vertexai",
    "tiktoken",
    "sentence_transformers",
    "spacy",
    "nltk",
    "onnxruntime",
    "llama_api_client",
    # Workflow Tools:
    "prefect",
    "luigi",
    "airflow",
    "dagster",
    "celery",
    # Vector Stores:
    "pgvector",
    "faiss",
    "annoy",
    "pinecone",
    "chromadb",
    "weaviate",
    "qdrant_client",
    "pymilvus",
    "lancedb",
    # Others:
    "snowflake",
    "pydantic",
    "fastapi",
    "starlette",
    "playwright",
    "folium",
    "geopandas",
    "httpx",
    "pyecharts",
    "fastplotlib",
    "pygfx",
    "highcharts_core",
    # Optional streamlit dependencies:
    "seaborn",
    "graphviz",
    "matplotlib",
    "uvloop",
    "orjson",
    "rich",
    "streamlit_extras",
    "streamlit_pydantic",
    "pygwalker",
    "plotly",
    "bokeh",
    "plost",
    "authlib",
    # Document Processing:
    "pypdf",
    "pdfplumber",
    "docx",
    "openpyxl",
    "xlsxwriter",
    # Image/Vision:
    "cv2",
    "mediapipe",
]

_ETC_MACHINE_ID_PATH = "/etc/machine-id"
_DBUS_MACHINE_ID_PATH = "/var/lib/dbus/machine-id"


def _get_machine_id_v3() -> str:
    """Get the machine ID.

    This is a unique identifier for a user for tracking metrics,
    that is broken in different ways in some Linux distros and Docker images.
    - at times just a hash of '', which means many machines map to the same ID
    - at times a hash of the same string, when running in a Docker container
    """

    if os.path.isfile(_ETC_MACHINE_ID_PATH):
        with open(_ETC_MACHINE_ID_PATH) as f:
            machine_id = f.read()

    elif os.path.isfile(_DBUS_MACHINE_ID_PATH):
        with open(_DBUS_MACHINE_ID_PATH) as f:
            machine_id = f.read()

    else:
        machine_id = str(uuid.getnode())

    return machine_id


def _get_machine_id_v4() -> str:
    """Get a random ID that is stable for each machine, generating if needed.

    This is a unique identifier for a user for tracking metrics.
    Instead of relying on a hardware address in the container or host we'll
    generate a UUID and store it in the ~/.streamlit hidden folder.
    """
    # If gatherUsageStats is False skip this whole code.
    # This is just for people who don't want the extra machine_id_v4 file
    # in their file system.
    if not config.get_option("browser.gatherUsageStats"):
        # This value will never be sent to our telemetry. Just including it here
        # to help debug.
        return "no-machine-id-v4"

    filepath = file_util.get_streamlit_file_path("machine_id_v4")
    stable_id = None

    if os.path.exists(filepath):
        with file_util.streamlit_read(filepath) as file:
            stable_id = file.read()

    if not stable_id:
        stable_id = str(uuid.uuid4())
        with file_util.streamlit_write(filepath) as output:
            output.write(stable_id)

    return stable_id


class Installation:
    _instance_lock = threading.Lock()
    _instance: Installation | None = None

    @classmethod
    def instance(cls) -> Installation:
        """Returns the singleton Installation."""
        # We use a double-checked locking optimization to avoid the overhead
        # of acquiring the lock in the common case:
        # https://en.wikipedia.org/wiki/Double-checked_locking
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = Installation()
        return cls._instance

    def __init__(self) -> None:
        self.installation_id_v3 = str(
            uuid.uuid5(uuid.NAMESPACE_DNS, _get_machine_id_v3())
        )

        self.installation_id_v4 = _get_machine_id_v4()

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def installation_id(self) -> str:
        return self.installation_id_v3


def _get_type_name(obj: object) -> str:
    """Get a simplified name for the type of the given object."""
    with contextlib.suppress(Exception):
        obj_type = obj if inspect.isclass(obj) else type(obj)
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


def _get_top_level_module(func: Callable[..., Any]) -> str:
    """Get the top level module for the given function."""
    module = inspect.getmodule(func)
    if module is None or not module.__name__:
        return "unknown"
    return module.__name__.split(".")[0]


def _get_arg_metadata(arg: object) -> str | None:
    """Get metadata information related to the value of the given object."""
    with contextlib.suppress(Exception):
        if isinstance(arg, (bool)):
            return f"val:{arg}"

        if isinstance(arg, Sized):
            return f"len:{len(arg)}"

    return None


def _get_command_telemetry(
    _command_func: Callable[..., Any], _command_name: str, *args: Any, **kwargs: Any
) -> Command:
    """Get telemetry information for the given callable and its arguments."""
    arg_keywords = inspect.getfullargspec(_command_func).args
    self_arg: Any | None = None
    arguments: list[Argument] = []
    is_method = inspect.ismethod(_command_func)
    name = _command_name

    for i, arg in enumerate(args):
        pos = i
        if is_method:
            # If func is a method, ignore the first argument (self)
            i = i + 1  # noqa: PLW2901

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

    top_level_module = _get_top_level_module(_command_func)
    if top_level_module != "streamlit":
        # If the gather_metrics decorator is used outside of streamlit library
        # we enforce a prefix to be added to the tracked command:
        name = f"external:{top_level_module}:{name}"

    if (
        name == "create_instance"
        and self_arg
        and hasattr(self_arg, "name")
        and self_arg.name
    ):
        name = f"component:{self_arg.name}"

    if name == "_bidi_component" and len(args) > 1 and isinstance(args[1], str):
        # Bound DeltaGenerator methods always receive `self` as args[0], so args[1]
        # is the user-supplied component name.
        component_name = args[1]
        name = f"component_v2:{component_name}"

    return Command(name=name, args=arguments)


def to_microseconds(seconds: float) -> int:
    """Convert seconds into microseconds."""
    return int(seconds * 1_000_000)


F = TypeVar("F", bound=Callable[..., Any])


@overload
def gather_metrics(
    name: str,
    func: F,
) -> F: ...


@overload
def gather_metrics(
    name: str,
    func: None = None,
) -> Callable[[F], F]: ...


def gather_metrics(name: str, func: F | None = None) -> Callable[[F], F] | F:
    """Function decorator to add telemetry tracking to commands.

    Parameters
    ----------
    func : callable
    The function to track for telemetry.

    name : str or None
    Overwrite the function name with a custom name that is used for telemetry tracking.

    Example
    -------
    >>> @st.gather_metrics
    ... def my_command(url):
    ...     return url

    >>> @st.gather_metrics(name="custom_name")
    ... def my_command(url):
    ...     return url
    """

    if not name:
        _LOGGER.warning("gather_metrics: name is empty")
        name = "undefined"

    if func is None:
        # Support passing the params via function decorator
        def wrapper(f: F) -> F:
            return gather_metrics(
                name=name,
                func=f,
            )

        return wrapper
    # To make mypy type narrow F | None -> F
    non_optional_func = func

    @wraps(non_optional_func)
    def wrapped_func(*args: Any, **kwargs: Any) -> Any:
        from timeit import default_timer as timer

        exec_start = timer()
        ctx = get_script_run_ctx(suppress_warning=True)

        tracking_activated = (
            ctx is not None
            and ctx.gather_usage_stats
            and not ctx.command_tracking_deactivated
            and len(ctx.tracked_commands)
            < _MAX_TRACKED_COMMANDS  # Prevent too much memory usage
        )

        command_telemetry: Command | None = None
        # This flag is needed to make sure that only the command (the outermost command)
        # that deactivated tracking (via ctx.command_tracking_deactivated) is able to reset it
        # again. This is important to prevent nested commands from reactivating tracking.
        # At this point, we don't know yet if the command will deactivated tracking.
        has_set_command_tracking_deactivated = False

        if ctx and tracking_activated:
            try:
                command_telemetry = _get_command_telemetry(
                    non_optional_func, name, *args, **kwargs
                )

                if (
                    command_telemetry.name not in ctx.tracked_commands_counter
                    or ctx.tracked_commands_counter[command_telemetry.name]
                    < _MAX_TRACKED_PER_COMMAND
                ):
                    ctx.tracked_commands.append(command_telemetry)
                ctx.tracked_commands_counter.update([command_telemetry.name])
                # Deactivate tracking to prevent calls inside already tracked commands
                ctx.command_tracking_deactivated = True
                # The ctx.command_tracking_deactivated flag was set to True,
                # we also need to set has_set_command_tracking_deactivated to True
                # to make sure that this command is able to reset it again.
                has_set_command_tracking_deactivated = True
            except Exception as ex:
                # Always capture all exceptions since we want to make sure that
                # the telemetry never causes any issues.
                _LOGGER.debug("Failed to collect command telemetry", exc_info=ex)
        try:
            result = non_optional_func(*args, **kwargs)
        except RerunException:
            # Duplicated from below, because static analysis tools get confused
            # by deferring the rethrow.
            if tracking_activated and command_telemetry:
                command_telemetry.time = to_microseconds(timer() - exec_start)
            raise
        finally:
            # Activate tracking again if command executes without any exceptions
            # we only want to do that if this command has set the
            # flag to deactivate tracking.
            if ctx and has_set_command_tracking_deactivated:
                ctx.command_tracking_deactivated = False

        if tracking_activated and command_telemetry:
            # Set the execution time to the measured value
            command_telemetry.time = to_microseconds(timer() - exec_start)

        return result

    with contextlib.suppress(AttributeError):
        # Make this a well-behaved decorator by preserving important function
        # attributes.
        wrapped_func.__dict__.update(non_optional_func.__dict__)
        wrapped_func.__signature__ = inspect.signature(non_optional_func)  # type: ignore
    return cast("F", wrapped_func)


def create_page_profile_message(
    commands: list[Command],
    exec_time: int,
    prep_time: int,
    uncaught_exception: str | None = None,
) -> ForwardMsg:
    """Create and return the full PageProfile ForwardMsg."""
    msg = ForwardMsg()
    page_profile = msg.page_profile

    page_profile.commands.extend(commands)
    page_profile.exec_time = exec_time
    page_profile.prep_time = prep_time

    page_profile.headless = config.get_option("server.headless")

    # Collect all config options that have been manually set
    config_options: set[str] = set()
    if config._config_options:
        for option_name in config._config_options:
            if not config.is_manually_set(option_name):
                # We only care about manually defined options
                continue

            config_option = config._config_options[option_name]
            config_options.add(
                f"{option_name}:default" if config_option.is_default else option_name
            )

    page_profile.config.extend(config_options)

    # Check the predefined set of modules for attribution
    attributions: set[str] = {
        attribution
        for attribution in _ATTRIBUTIONS_TO_CHECK
        if attribution in sys.modules
    }

    page_profile.os = str(sys.platform)
    page_profile.timezone = str(time.tzname)
    page_profile.attributions.extend(attributions)

    if uncaught_exception:
        page_profile.uncaught_exception = uncaught_exception

    if ctx := get_script_run_ctx():
        page_profile.is_fragment_run = bool(ctx.fragment_ids_this_run)

    return msg
