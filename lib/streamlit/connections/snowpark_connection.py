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

import configparser
import os
import threading
from contextlib import contextmanager
from datetime import timedelta
from typing import TYPE_CHECKING, Dict, Iterator, Optional, Union, cast

import pandas as pd

from streamlit.connections import BaseConnection
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from snowflake.snowpark.session import Session


REQUIRED_CONNECTION_PARAMS = {"account", "user"}
_DEFAULT_CONNECTION_FILE = "~/.snowsql/config"


def _load_from_snowsql_config_file() -> Dict:
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


class Snowpark(BaseConnection["Session"]):
    _default_connection_name = "snowpark"

    def __init__(self, connection_name: str = "default", **kwargs) -> None:
        self._lock = threading.RLock()
        self._closed = True

        # Grab the before calling BaseConnection.__init__() so that we can guarantee
        # thread safety when the parent class' constructor initializes our connection.
        with self._lock:
            super().__init__(connection_name, **kwargs)

    # TODO(vdonato): Teach the .connect() method how to automagically connect in a SiS
    # runtime environment.
    def connect(self, **kwargs) -> "Session":
        from snowflake.snowpark.session import Session

        self._closed = False
        conn_params = self.get_secrets()

        if not conn_params:
            conn_params = _load_from_snowsql_config_file()

        for p in REQUIRED_CONNECTION_PARAMS:
            if p not in conn_params:
                raise StreamlitAPIException(f"Missing Snowpark connection param: {p}")

        return cast(Session, Session.builder.configs(conn_params).create())

    def disconnect(self) -> None:
        with self._lock:
            self.instance.close()
            self._closed = True

    def is_connected(self) -> bool:
        # NOTE: Sessions communicate with Snowpark in a RESTful manner, meaning that we
        # can't know for sure whether a connection has timed out without using it to
        # attempt to send a request. Thus, we simply keep track of whether the user
        # has called .disconnect() for now.
        #
        # In the future, we may decide that we do want to send that test query each
        # time this method is called, but in doing so, we will be adding a small amount
        # of additional load to each script run.
        with self._lock:
            return not self._closed

    @staticmethod
    def _read_sql(sql: str, _instance: "Session") -> pd.DataFrame:
        return _instance.sql(sql).to_pandas()

    def read_sql(
        self,
        sql: str,
        ttl: Optional[Union[float, int, timedelta]] = None,
    ) -> pd.DataFrame:
        # TODO(vdonato): Fix the type error below.
        return cache_data(self._read_sql, ttl=ttl)(sql, self.instance)  # type: ignore

    @contextmanager
    def session(self) -> Iterator["Session"]:
        with self._lock:
            yield self.instance
