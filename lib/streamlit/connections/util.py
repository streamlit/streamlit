# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

# NOTE: We won't always be able to import from snowflake.connector.connection so need the
# `type: ignore` comment below, but that comment will explode if `warn-unused-ignores` is
# turned on when the package is available. Unfortunately, mypy doesn't provide a good
# way to configure this at a per-line level :(
# mypy: no-warn-unused-ignores

from __future__ import annotations

import os
from typing import Any, Collection, cast

SNOWSQL_CONNECTION_FILE = "~/.snowsql/config"


def extract_from_dict(
    keys: Collection[str], source_dict: dict[str, Any]
) -> dict[str, Any]:
    """Extract the specified keys from source_dict and return them in a new dict.

    Parameters
    ----------
    keys : Collection[str]
        The keys to extract from source_dict.
    source_dict : Dict[str, Any]
        The dict to extract keys from. Note that this function mutates source_dict.

    Returns
    -------
    Dict[str, Any]
        A new dict containing the keys/values extracted from source_dict.
    """
    d = {}

    for k in keys:
        if k in source_dict:
            d[k] = source_dict.pop(k)

    return d


def load_from_snowsql_config_file(connection_name: str) -> dict[str, Any]:
    """Loads the dictionary from snowsql config file."""
    snowsql_config_file = os.path.expanduser(SNOWSQL_CONNECTION_FILE)
    if not os.path.exists(snowsql_config_file):
        return {}

    # Lazy-load config parser for better import / startup performance
    import configparser

    config = configparser.ConfigParser(inline_comment_prefixes="#")
    config.read(snowsql_config_file)

    if f"connections.{connection_name}" in config:
        raw_conn_params = config[f"connections.{connection_name}"]
    elif "connections" in config:
        raw_conn_params = config["connections"]
    else:
        return {}

    conn_params = {
        k.replace("name", ""): v.strip('"') for k, v in raw_conn_params.items()
    }

    if "db" in conn_params:
        conn_params["database"] = conn_params["db"]
        del conn_params["db"]

    return conn_params


def running_in_sis() -> bool:
    """Return whether this app is running in SiS."""
    try:
        from snowflake.snowpark._internal.utils import (  # type: ignore[import]  # isort: skip
            is_in_stored_procedure,
        )

        return cast(bool, is_in_stored_procedure())
    except ModuleNotFoundError:
        return False
