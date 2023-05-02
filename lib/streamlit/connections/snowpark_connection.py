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
# `type: ignore` comment below, but that comment will explode if `warn-unused-ignores` is
# turned on when the package is available. Unfortunately, mypy doesn't provide a good
# way to configure this at a per-line level :(
# mypy: no-warn-unused-ignores

import configparser
import os
import threading
from collections import ChainMap
from contextlib import contextmanager
from datetime import timedelta
from typing import TYPE_CHECKING, Any, Dict, Iterator, Optional, Union, cast

import pandas as pd

from streamlit.connections import ExperimentalBaseConnection
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from snowflake.snowpark.session import Session  # type: ignore


_REQUIRED_CONNECTION_PARAMS = {"account"}
_DEFAULT_CONNECTION_FILE = "~/.snowsql/config"


def _load_from_snowsql_config_file(connection_name: str) -> Dict[str, Any]:
    """Loads the dictionary from snowsql config file."""
    snowsql_config_file = os.path.expanduser(_DEFAULT_CONNECTION_FILE)
    if not os.path.exists(snowsql_config_file):
        return {}

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


class SnowparkConnection(ExperimentalBaseConnection["Session"]):
    """A connection to Snowpark using snowflake.snowpark.session.Session. Initialize using
    ``st.experimental_connection("<name>", type="snowpark")``.

    In addition to accessing the Snowpark Session, SnowparkConnection supports direct SQL querying using
    ``query("...")`` and thread safe access using ``with conn.safe_session():``. See methods
    below for more information. SnowparkConnections should always be created using
    ``st.experimental_connection()``, **not** initialized directly.

    .. note::
        We don't expect this iteration of SnowparkConnection to be able to scale
        well in apps with many concurrent users due to the lock contention that will occur
        over the single underlying Session object under high load.
    """

    def __init__(self, connection_name: str, **kwargs) -> None:
        self._lock = threading.RLock()
        super().__init__(connection_name, **kwargs)

    def _connect(self, **kwargs) -> "Session":
        from snowflake.snowpark.context import get_active_session  # type: ignore
        from snowflake.snowpark.exceptions import (  # type: ignore
            SnowparkSessionException,
        )
        from snowflake.snowpark.session import Session

        # If we're in a runtime environment where there's already an active session
        # available, we just use that one. Otherwise, we fall back to attempting to
        # create a new one from whatever credentials we have available.
        try:
            return get_active_session()
        except SnowparkSessionException:
            pass

        conn_params = ChainMap(
            kwargs,
            self._secrets.to_dict(),
            _load_from_snowsql_config_file(self._connection_name),
        )

        if not len(conn_params):
            raise StreamlitAPIException(
                "Missing Snowpark connection configuration. "
                f"Did you forget to set this in `secrets.toml`, `{_DEFAULT_CONNECTION_FILE}`, "
                "or as kwargs to `st.experimental_connection`?"
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
        """Run a read-only SQL query.

        This method implements both query result caching (with caching behavior
        identical to that of using ``@st.cache_data``) as well as simple error handling/retries.

        .. note::
            Queries that are run without a specified ttl are cached indefinitely.

        Parameters
        ----------
        sql : str
            The read-only SQL query to execute.
        ttl : float, int, timedelta or None
            The maximum number of seconds to keep results in the cache, or
            None if cached results should not expire. The default is None.

        Returns
        -------
        pd.DataFrame
            The result of running the query, formatted as a pandas DataFrame.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> conn = st.experimental_connection("snowpark")
        >>> df = conn.query("select * from pet_owners")
        >>> st.dataframe(df)
        """
        from snowflake.snowpark.exceptions import (  # type: ignore
            SnowparkServerException,
        )
        from tenacity import (
            retry,
            retry_if_exception_type,
            stop_after_attempt,
            wait_fixed,
        )

        @retry(
            after=lambda _: self.reset(),
            stop=stop_after_attempt(3),
            reraise=True,
            retry=retry_if_exception_type(SnowparkServerException),
            wait=wait_fixed(1),
        )
        @cache_data(
            show_spinner="Running `snowpark.query(...)`.",
            ttl=ttl,
        )
        def _query(sql: str) -> pd.DataFrame:
            with self._lock:
                return self._instance.sql(sql).to_pandas()

        return _query(sql)

    @property
    def session(self) -> "Session":
        """Access the underlying Snowpark session.

        .. note::
            Snowpark sessions are **not** thread safe. Users of this method are
            responsible for ensuring that access to the session returned by this method is
            done in a thread-safe manner. For most users, we recommend using the thread-safe
            safe_session() method and a ``with`` block.

        Information on how to use Snowpark sessions can be found in the
        [Snowpark documentation](https://docs.snowflake.com/en/developer-guide/snowpark/python/working-with-dataframes).

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> session = st.experimental_connection("snowpark").session
        >>> df = session.table("mytable").limit(10).to_pandas()
        >>> st.dataframe(df)
        """
        return self._instance

    @contextmanager
    def safe_session(self) -> Iterator["Session"]:
        """Grab the underlying Snowpark session in a thread-safe manner.

        As operations on a Snowpark session are not thread safe, we need to take care
        when using a session in the context of a Streamlit app where each script run
        occurs in its own thread. Using the contextmanager pattern to do this ensures
        that access on this connection's underlying Session is done in a thread-safe
        manner.

        Information on how to use Snowpark sessions can be found in the
        `Snowpark documentation <https://docs.snowflake.com/en/developer-guide/snowpark/python/working-with-dataframes>`_.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> conn = st.experimental_connection("snowpark")
        >>> with conn.safe_session() as session:
        ...     df = session.table("mytable").limit(10).to_pandas()
        ...
        >>> st.dataframe(df)
        """
        with self._lock:
            yield self.session
