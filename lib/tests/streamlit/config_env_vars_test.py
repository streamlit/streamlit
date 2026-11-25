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

"""Tests for reading non-sensitive config options from environment variables."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import click
import pytest

from streamlit import config


def _env_var(key: str) -> str:
    return config._config_options_template[key].env_var


@pytest.fixture(autouse=True)
def isolated_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """Parse config from defaults only, ignoring config files on the machine."""
    monkeypatch.setattr(config, "_config_options", None)
    monkeypatch.setattr(config, "get_config_files", lambda *_args, **_kwargs: [])
    for option in config._config_options_template.values():
        monkeypatch.delenv(option.env_var, raising=False)


def _click_value(key: str, raw_value: str) -> Any:
    """Return what `streamlit run` computes for an env var, using a Click option."""
    option = config._config_options_template[key]
    captured: dict[str, Any] = {}

    def callback(opt: Any) -> None:
        captured["value"] = opt

    command = click.Command(
        "test",
        params=[
            click.Option(
                ["--" + key, "opt"],
                type=option.type,
                multiple=option.multiple,
                envvar=option.env_var,
                show_envvar=True,
            )
        ],
        callback=callback,
    )
    with patch.dict("os.environ", {option.env_var: raw_value}):
        command.main(args=[], standalone_mode=False)
    return captured["value"]


@pytest.mark.parametrize(
    ("key", "raw_value", "expected"),
    [
        ("server.maxUploadSize", "300", 300),
        ("server.runOnSave", "true", True),
        ("server.enableXsrfProtection", "false", False),
        ("server.enableXsrfProtection", "0", False),
        ("server.fileWatcherType", "none", "none"),
        ("server.folderWatchList", "/a /b", ("/a", "/b")),
    ],
)
def test_env_var_is_converted_to_the_option_type(
    monkeypatch: pytest.MonkeyPatch, key: str, raw_value: str, expected: Any
) -> None:
    """Non-sensitive env vars are converted to the type the option declares."""
    monkeypatch.setenv(_env_var(key), raw_value)

    config.get_config_options(force_reparse=True)

    assert config.get_option(key) == expected
    assert config.get_where_defined(key) == config._DEFINED_BY_ENV_VAR


@pytest.mark.parametrize(
    ("key", "raw_value"),
    [
        ("server.maxUploadSize", "300"),
        ("server.runOnSave", "yes"),
        ("server.enableXsrfProtection", "off"),
        ("server.fileWatcherType", "poll"),
        ("server.folderWatchList", "/a  /b"),
    ],
)
def test_env_var_value_matches_streamlit_run(
    monkeypatch: pytest.MonkeyPatch, key: str, raw_value: str
) -> None:
    """The value read without the CLI equals the value `streamlit run` computes."""
    monkeypatch.setenv(_env_var(key), raw_value)

    config.get_config_options(force_reparse=True)

    assert config.get_option(key) == _click_value(key, raw_value)


def test_empty_env_var_is_treated_as_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """An empty env var leaves the default, as it does for `streamlit run`."""
    monkeypatch.setenv(_env_var("server.maxUploadSize"), "")

    config.get_config_options(force_reparse=True)

    assert config.get_option("server.maxUploadSize") == 200
    assert (
        config.get_where_defined("server.maxUploadSize") != config._DEFINED_BY_ENV_VAR
    )


def test_flag_overrides_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    """Flags and `App.run(config=...)` overrides win over env vars."""
    monkeypatch.setenv(_env_var("server.maxUploadSize"), "300")

    config.get_config_options(
        force_reparse=True, options_from_flags={"server.maxUploadSize": 900}
    )

    assert config.get_option("server.maxUploadSize") == 900
    assert config.get_where_defined("server.maxUploadSize") == config._DEFINED_BY_FLAG


def test_env_var_overrides_config_file(monkeypatch: pytest.MonkeyPatch) -> None:
    """Env vars take precedence over values from config.toml."""
    monkeypatch.setenv(_env_var("server.maxUploadSize"), "300")
    config.get_config_options(force_reparse=True)
    config._update_config_with_toml(
        "[server]\nmaxUploadSize = 700", "<test definition>"
    )
    assert config.get_option("server.maxUploadSize") == 700

    config.get_config_options(force_reparse=True)

    assert config.get_option("server.maxUploadSize") == 300


def test_invalid_env_var_is_logged_and_ignored(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A bad value does not break config loading and keeps the default."""
    monkeypatch.setenv(_env_var("server.maxUploadSize"), "abc")

    with patch.object(config, "_LOGGER") as logger:
        config.get_config_options(force_reparse=True)

    assert config.get_option("server.maxUploadSize") == 200
    logger.error.assert_called_once()
    message = logger.error.call_args.args[1]
    assert "STREAMLIT_SERVER_MAX_UPLOAD_SIZE" in message
    assert "'abc' is not a valid integer" in message


def test_invalid_env_var_overridden_by_flag_is_not_logged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An env var that a flag overrides is never converted, like in Click."""
    monkeypatch.setenv(_env_var("server.maxUploadSize"), "abc")

    with patch.object(config, "_LOGGER") as logger:
        config.get_config_options(
            force_reparse=True, options_from_flags={"server.maxUploadSize": 900}
        )

    logger.error.assert_not_called()
    assert config.get_option("server.maxUploadSize") == 900


def test_sensitive_env_var_stays_a_raw_string(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sensitive options keep their value as the raw environment string."""
    monkeypatch.setenv(_env_var("server.cookieSecret"), "12345")

    config.get_config_options(force_reparse=True)

    assert config.get_option("server.cookieSecret") == "12345"


@pytest.mark.parametrize(
    ("key", "raw_value"),
    [
        ("server.maxUploadSize", "abc"),
        ("server.runOnSave", "maybe"),
    ],
)
def test_validate_env_vars_raises_the_streamlit_run_error(
    monkeypatch: pytest.MonkeyPatch, key: str, raw_value: str
) -> None:
    """Validation raises the same message Click shows for `streamlit run`."""
    monkeypatch.setenv(_env_var(key), raw_value)

    with pytest.raises(click.BadParameter) as validate_error:
        config._validate_env_vars()
    with pytest.raises(click.BadParameter) as click_error:
        _click_value(key, raw_value)

    expected = click_error.value.format_message()
    assert validate_error.value.format_message() == expected
    assert f"env var: '{_env_var(key)}'" in expected


def test_validate_env_vars_accepts_valid_and_unset_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Validation passes for valid, empty, and sensitive values."""
    monkeypatch.setenv(_env_var("server.maxUploadSize"), "300")
    monkeypatch.setenv(_env_var("server.runOnSave"), "")
    monkeypatch.setenv(_env_var("server.cookieSecret"), "not-validated")

    config._validate_env_vars()


def test_validate_env_vars_skips_overridden_options(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Options set by an override or a loaded flag are not validated."""
    monkeypatch.setenv(_env_var("server.maxUploadSize"), "abc")
    monkeypatch.setenv(_env_var("server.runOnSave"), "maybe")

    config._validate_env_vars(
        overridden_keys={"server.maxUploadSize", "server.runOnSave"}
    )

    config.get_config_options(
        force_reparse=True,
        options_from_flags={"server.maxUploadSize": 900, "server.runOnSave": True},
    )
    config._validate_env_vars()
