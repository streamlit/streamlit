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

# NOTE: We won't always be able to import from snowflake.snowpark.session so need the
# `type:ignore` comment below, but that comment will explode if `warn-unused-ignores` is
# turned on when the package is available. Unfortunately, mypy doesn't provide a good
# way to configure this at a per-line level :(
# mypy: no-warn-unused-ignores

import configparser
import os
import threading
from contextlib import contextmanager
from datetime import timedelta
from typing import TYPE_CHECKING, Any, Dict, Iterator, Optional, Union, cast

import pandas as pd

from streamlit.connections import ExperimentalBaseConnection
from streamlit.connections.util import merge_dicts
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from snowflake.snowpark.session import Session  # type: ignore


_REQUIRED_CONNECTION_PARAMS = {"account", "user", "password"}
_DEFAULT_CONNECTION_FILE = "~/.snowsql/config"


def _load_from_snowsql_config_file() -> Dict[str, Any]:
    """Loads the dictionary from snowsql config file."""
    snowsql_config_file = os.path.expanduser(_DEFAULT_CONNECTION_FILE)
    if not os.path.exists(snowsql_config_file):
        return {}

    config = configparser.ConfigParser(inline_comment_prefixes="#")
    config.read(snowsql_config_file)

    conn_params = config["connections"]
    conn_params = {k.replace("name", ""): v.strip('"') for k, v in conn_params.items()}
    if "db" in conn_params:
        conn_params["database"] = conn_params["db"]
        del conn_params["db"]
    return conn_params


class Snowpark(ExperimentalBaseConnection["Session"]):
    def __init__(self, connection_name: str, **kwargs) -> None:
        self._lock = threading.RLock()

        # Grab the lock before calling ExperimentalBaseConnection.__init__() so that we
        # can guarantee thread safety when the parent class' constructor initializes our
        # connection.
        with self._lock:
            super().__init__(connection_name, **kwargs)

    # TODO(vdonato): Teach the .connect() method how to automagically connect in a SiS
    # runtime environment.
    def _connect(self, **kwargs) -> "Session":
        from snowflake.snowpark.session import Session

        conn_params = merge_dicts(
            [
                _load_from_snowsql_config_file(),
                self._secrets.to_dict(),
                kwargs,
            ]
        )

        for p in _REQUIRED_CONNECTION_PARAMS:
            if p not in conn_params:
                raise StreamlitAPIException(f"Missing Snowpark connection param: {p}")

        return cast(Session, Session.builder.configs(conn_params).create())

    def query(
        self,
        sql: str,
        ttl: Optional[Union[float, int, timedelta]] = None,
    ) -> pd.DataFrame:
        from tenacity import retry, stop_after_attempt, wait_fixed

        @retry(
            after=lambda _: self.reset(),
            stop=stop_after_attempt(3),
            reraise=True,
            wait=wait_fixed(1),
        )
        @cache_data(ttl=ttl)
        def _query(sql: str) -> pd.DataFrame:
            with self._lock:
                return self._instance.sql(sql).to_pandas()

        return _query(sql)

    @contextmanager
    def session(self) -> Iterator["Session"]:
        with self._lock:
            yield self._instance
