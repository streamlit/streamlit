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

"""A script which is run when the Streamlit package is executed."""

from __future__ import annotations

import os
import sys
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final, TypeVar

# We cannot lazy-load click here because its used via decorators.
import click

from streamlit import config as _config
from streamlit.runtime import caching
from streamlit.runtime.credentials import Credentials, check_credentials
from streamlit.web import bootstrap
from streamlit.web.cache_storage_manager_config import (
    create_default_cache_storage_manager,
)

if TYPE_CHECKING:
    from streamlit.config_option import ConfigOption

ACCEPTED_FILE_EXTENSIONS: Final = ("py", "py3")

LOG_LEVELS: Final = ("error", "warning", "info", "debug")


def _convert_config_option_to_click_option(
    config_option: ConfigOption,
) -> dict[str, Any]:
    """Composes given config option options as options for click lib."""
    option = f"--{config_option.key}"
    param = config_option.key.replace(".", "_")
    description = config_option.description
    if config_option.deprecated:
        if description is None:
            description = ""
        description += (
            f"\n {config_option.deprecation_text} - {config_option.expiration_date}"
        )

    return {
        "param": param,
        "description": description,
        "type": config_option.type,
        "option": option,
        "envvar": config_option.env_var,
        "multiple": config_option.multiple,
    }


def _make_sensitive_option_callback(
    config_option: ConfigOption,
) -> Callable[[click.Context, click.Parameter, Any], None]:
    def callback(_ctx: click.Context, _param: click.Parameter, cli_value: Any) -> None:
        if cli_value is None:
            return
        raise SystemExit(
            f"Setting {config_option.key!r} option using the CLI flag is not allowed. "
            f"Set this option in the configuration file or environment "
            f"variable: {config_option.env_var!r}"
        )

    return callback


F = TypeVar("F", bound=Callable[..., Any])


def configurator_options(func: F) -> F:
    """Decorator that adds config param keys to click dynamically."""
    for _, value in reversed(_config._config_options_template.items()):
        parsed_parameter = _convert_config_option_to_click_option(value)
        if value.sensitive:
            # Display a warning if the user tries to set sensitive
            # options using the CLI and exit with non-zero code.
            click_option_kwargs = {
                "expose_value": False,
                "hidden": True,
                "is_eager": True,
                "callback": _make_sensitive_option_callback(value),
            }
        else:
            click_option_kwargs = {
                "show_envvar": True,
                "envvar": parsed_parameter["envvar"],
            }
        config_option = click.option(
            parsed_parameter["option"],
            parsed_parameter["param"],
            help=parsed_parameter["description"],
            type=parsed_parameter["type"],
            multiple=parsed_parameter["multiple"],
            **click_option_kwargs,  # type: ignore
        )
        func = config_option(func)
    return func


def _download_remote(main_script_path: str, url_path: str) -> None:
    """Fetch remote file at url_path to main_script_path."""
    import requests
    from requests.exceptions import RequestException

    with open(main_script_path, "wb") as fp:
        try:
            resp = requests.get(url_path, timeout=30)
            resp.raise_for_status()
            fp.write(resp.content)
        except RequestException as e:
            raise click.BadParameter(f"Unable to fetch {url_path}.\n{e}")


@click.group(context_settings={"auto_envvar_prefix": "STREAMLIT"})
@click.option("--log_level", show_default=True, type=click.Choice(LOG_LEVELS))
@click.version_option(prog_name="Streamlit")
def main(log_level: str = "info") -> None:
    """Try out a demo with:

        $ streamlit hello

    Or use the line below to run your own script:

        $ streamlit run your_script.py
    """  # noqa: D400

    if log_level:
        from streamlit.logger import get_logger

        logger: Final = get_logger(__name__)
        logger.warning(
            "Setting the log level using the --log_level flag is unsupported."
            "\nUse the --logger.level flag (after your streamlit command) instead."
        )


@main.command("help")
def help() -> None:  # noqa: A001
    """Print this help message."""
    # We use _get_command_line_as_string to run some error checks but don't do
    # anything with its return value.
    _get_command_line_as_string()

    # Pretend user typed 'streamlit --help' instead of 'streamlit help'.
    sys.argv[1] = "--help"
    main(prog_name="streamlit")


@main.command("version")
def main_version() -> None:
    """Print Streamlit's version number."""
    # Pretend user typed 'streamlit --version' instead of 'streamlit version'
    import sys

    # We use _get_command_line_as_string to run some error checks but don't do
    # anything with its return value.
    _get_command_line_as_string()

    sys.argv[1] = "--version"
    main()


@main.command("docs")
def main_docs() -> None:
    """Show help in browser."""
    click.echo("Showing help page in browser...")
    from streamlit import cli_util

    cli_util.open_browser("https://docs.streamlit.io")


@main.command("hello")
@configurator_options
def main_hello(**kwargs: Any) -> None:
    """Runs the Hello World script."""
    from streamlit.hello import streamlit_app

    filename = streamlit_app.__file__
    _main_run(filename, flag_options=kwargs)


@main.command("run")
@configurator_options
@click.argument("target", default="streamlit_app.py", envvar="STREAMLIT_RUN_TARGET")
@click.argument("args", nargs=-1)
def main_run(target: str, args: list[str] | None = None, **kwargs: Any) -> None:
    """Run a Python script, piping stderr to Streamlit.

    If omitted, the target script will be assumed to be "streamlit_app.py".

    Otherwise, the target script should be one of the following:
    - The path to a local Python file.
    - The path to a local folder where "streamlit_app.py" can be found.
    - A URL pointing to a Python file. In this case Streamlit will download the
      file to a temporary file and run it.

    To pass command-line arguments to the script, add " -- " before them. For example:

        $ streamlit run my_app.py -- --my_arg1=123 my_arg2
                                   ↑
                                   Your CLI args start after this.
    """
    from streamlit import url_util

    if url_util.is_url(target):
        from streamlit.temporary_directory import TemporaryDirectory

        with TemporaryDirectory() as temp_dir:
            from urllib.parse import urlparse

            url_subpath = urlparse(target).path

            _check_extension_or_raise(url_subpath)

            main_script_path = os.path.join(
                temp_dir, url_subpath.strip("/").rsplit("/", 1)[-1]
            )
            # if this is a GitHub/Gist blob url, convert to a raw URL first.
            url = url_util.process_gitblob_url(target)
            _download_remote(main_script_path, url)
            _main_run(main_script_path, args, flag_options=kwargs)

    else:
        path = Path(target)

        if path.is_dir():
            path /= "streamlit_app.py"

        path_str = str(path)
        _check_extension_or_raise(path_str)

        if not path.exists():
            raise click.BadParameter(f"File does not exist: {path}")

        _main_run(path_str, args, flag_options=kwargs)


def _check_extension_or_raise(path_str: str) -> None:
    _, extension = os.path.splitext(path_str)

    if extension[1:] not in ACCEPTED_FILE_EXTENSIONS:
        if extension[1:] == "":
            raise click.BadArgumentUsage(
                "Streamlit requires raw Python (.py) files, but the provided file has no extension.\n"
                "For more information, please see https://docs.streamlit.io"
            )
        raise click.BadArgumentUsage(
            f"Streamlit requires raw Python (.py) files, not {extension}.\n"
            "For more information, please see https://docs.streamlit.io"
        )


def _get_command_line_as_string() -> str | None:
    import subprocess  # noqa: S404

    parent = click.get_current_context().parent
    if parent is None:
        return None

    if "streamlit.cli" in parent.command_path:
        raise RuntimeError(
            "Running streamlit via `python -m streamlit.cli <command>` is"
            " unsupported. Please use `python -m streamlit <command>` instead."
        )

    cmd_line_as_list = [parent.command_path]
    cmd_line_as_list.extend(sys.argv[1:])
    return subprocess.list2cmdline(cmd_line_as_list)


def _main_run(
    file: str,
    args: list[str] | None = None,
    flag_options: dict[str, Any] | None = None,
) -> None:
    # Set the main script path to use it for config & secret files
    # While its a bit suboptimal, we need to store this into a module-level
    # variable before we load the config options via `load_config_options`
    main_script_path = os.path.abspath(file)
    _config._main_script_path = main_script_path

    bootstrap.load_config_options(flag_options=flag_options or {})
    if args is None:
        args = []

    if flag_options is None:
        flag_options = {}

    check_credentials()

    # Check if the script contains an ASGI app instance (st.App, FastAPI, Starlette).
    # This intentionally supports non-Streamlit ASGI frameworks to enable `streamlit run`
    # as a unified entry point for projects that combine Streamlit with other frameworks.
    from streamlit.web.server.app_discovery import discover_asgi_app

    discovery_result = discover_asgi_app(Path(main_script_path))

    if discovery_result.is_asgi_app:
        # Run as ASGI app with uvicorn
        bootstrap.run_asgi_app(
            main_script_path,
            discovery_result.import_string,  # type: ignore[arg-type]
            args,
            flag_options,
        )
    else:
        # Run as traditional Streamlit app
        is_hello = _get_command_line_as_string() == "streamlit hello"
        bootstrap.run(main_script_path, is_hello, args, flag_options)


# SUBCOMMAND cache


@main.group("cache")
def cache() -> None:
    """Manage the Streamlit cache."""


@cache.command("clear")
def cache_clear() -> None:
    """Clear st.cache_data and st.cache_resource caches."""

    # in this `streamlit cache clear` cli command we cannot use the
    # `cache_storage_manager from runtime (since runtime is not initialized)
    # so we create a new cache_storage_manager instance that used in runtime,
    # and call clear_all() method for it.
    # This will not remove the in-memory cache.
    cache_storage_manager = create_default_cache_storage_manager()
    cache_storage_manager.clear_all()
    caching.cache_resource.clear()


# SUBCOMMAND config


@main.group("config")
def config() -> None:
    """Manage Streamlit's config settings."""


@config.command("show")
@configurator_options
def config_show(**kwargs: Any) -> None:
    """Show all of Streamlit's config settings."""

    bootstrap.load_config_options(flag_options=kwargs)

    _config.show_config()


# SUBCOMMAND activate


@main.group("activate", invoke_without_command=True)
@click.pass_context
def activate(ctx: click.Context) -> None:
    """Activate Streamlit by entering your email."""
    if not ctx.invoked_subcommand:
        Credentials.get_current().activate()


@activate.command("reset")
def activate_reset() -> None:
    """Reset Activation Credentials."""
    Credentials.get_current().reset()


# SUBCOMMAND test


@main.group("test", hidden=True)
def test() -> None:
    """Internal-only commands used for testing.

    These commands are not included in the output of `streamlit help`.
    """


@test.command("prog_name")
def test_prog_name() -> None:
    """Assert that the program name is set to `streamlit test`.

    This is used by our cli-smoke-tests to verify that the program name is set
    to `streamlit ...` whether the streamlit binary is invoked directly or via
    `python -m streamlit ...`.
    """
    # We use _get_command_line_as_string to run some error checks but don't do
    # anything with its return value.
    _get_command_line_as_string()

    parent = click.get_current_context().parent

    if parent is None:
        raise AssertionError("parent is None")

    if parent.command_path != "streamlit test":
        raise AssertionError(
            f"Parent command path is {parent.command_path} not streamlit test."
        )


@main.command("init")
@click.argument("directory", required=False)
def main_init(directory: str | None = None) -> None:
    """Initialize a new Streamlit project.

    If DIRECTORY is specified, create it and initialize the project there.
    Otherwise use the current directory.
    """
    from pathlib import Path

    project_dir = Path(directory) if directory else Path.cwd()

    try:
        project_dir.mkdir(exist_ok=True, parents=True)
    except OSError as e:
        raise click.ClickException(f"Failed to create directory: {e}")

    # Create requirements.txt
    (project_dir / "requirements.txt").write_text("streamlit\n", encoding="utf-8")

    # Create streamlit_app.py
    (project_dir / "streamlit_app.py").write_text(
        """import streamlit as st

st.title("🎈 My new app")
st.write(
    "Let's start building! For help and inspiration, head over to [docs.streamlit.io](https://docs.streamlit.io/)."
)
""",
        encoding="utf-8",
    )

    rel_path_str = str(directory) if directory else "."

    click.secho("✨ Created new Streamlit app in ", nl=False)
    click.secho(f"{rel_path_str}", fg="blue")
    click.echo("🚀 Run it with: ", nl=False)
    click.secho(f"streamlit run {rel_path_str}/streamlit_app.py", fg="blue")

    if click.confirm("❓ Run the app now?", default=True):
        app_path = project_dir / "streamlit_app.py"
        click.echo("\nStarting Streamlit...")
        _main_run(str(app_path))


if __name__ == "__main__":
    main()
