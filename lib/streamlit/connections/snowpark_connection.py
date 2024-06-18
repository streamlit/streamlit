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

# NOTE: We won't always be able to import from snowflake.snowpark.session so need the
# `type: ignore` comment below, but that comment will explode if `warn-unused-ignores` is
# turned on when the package is available. Unfortunately, mypy doesn't provide a good
# way to configure this at a per-line level :(
# mypy: no-warn-unused-ignores

from __future__ import annotations

import threading
from collections import ChainMap
from contextlib import contextmanager
from typing import TYPE_CHECKING, Iterator, cast

from streamlit.connections import BaseConnection
from streamlit.connections.util import (
    SNOWSQL_CONNECTION_FILE,
    load_from_snowsql_config_file,
    running_in_sis,
)
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

if TYPE_CHECKING:
    from datetime import timedelta

    from pandas import DataFrame
    from snowflake.snowpark.session import Session  # type:ignore[import]


_REQUIRED_CONNECTION_PARAMS = {"account"}


class SnowparkConnection(BaseConnection["Session"]):
    """A connection to Snowpark using snowflake.snowpark.session.Session. Initialize using
    ``st.connection("<name>", type="snowpark")``.

    In addition to providing access to the Snowpark Session, SnowparkConnection supports
    direct SQL querying using ``query("...")`` and thread safe access using
    ``with conn.safe_session():``. See methods below for more information.
    SnowparkConnections should always be created using ``st.connection()``, **not**
    initialized directly.

    .. note::
        We don't expect this iteration of SnowparkConnection to be able to scale
        well in apps with many concurrent users due to the lock contention that will occur
        over the single underlying Session object under high load.
    """

    def __init__(self, connection_name: str, **kwargs) -> None:
        self._lock = threading.RLock()
        super().__init__(connection_name, **kwargs)

    def _connect(self, **kwargs) -> Session:
        from snowflake.snowpark.context import get_active_session  # type:ignore[import]
        from snowflake.snowpark.session import Session

        # If we're running in SiS, just call get_active_session(). Otherwise, attempt to
        # create a new session from whatever credentials we have available.
        if running_in_sis():
            return get_active_session()

        conn_params = ChainMap(
            kwargs,
            self._secrets.to_dict(),
            load_from_snowsql_config_file(self._connection_name),
        )

        if not len(conn_params):
            raise StreamlitAPIException(
                "Missing Snowpark connection configuration. "
                f"Did you forget to set this in `secrets.toml`, `{SNOWSQL_CONNECTION_FILE}`, "
                "or as kwargs to `st.connection`?"
            )

        for p in _REQUIRED_CONNECTION_PARAMS:
            if p not in conn_params:
                raise StreamlitAPIException(f"Missing Snowpark connection param: {p}")

        return cast(Session, Session.builder.configs(conn_params).create())

    def query(
        self,
        sql: str,
        ttl: float | int | timedelta | None = None,
    ) -> DataFrame:
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
        pandas.DataFrame
            The result of running the query, formatted as a pandas DataFrame.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> conn = st.connection("snowpark")
        >>> df = conn.query("select * from pet_owners")
        >>> st.dataframe(df)
        """
        from snowflake.snowpark.exceptions import (  # type:ignore[import]
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
        def _query(sql: str) -> DataFrame:
            with self._lock:
                return self._instance.sql(sql).to_pandas()

        # We modify our helper function's `__qualname__` here to work around default
        # `@st.cache_data` behavior. Otherwise, `.query()` being called with different
        # `ttl` values will reset the cache with each call, and the query caches won't
        # be scoped by connection.
        ttl_str = str(  # Avoid adding extra `.` characters to `__qualname__`
            ttl
        ).replace(".", "_")
        _query.__qualname__ = f"{_query.__qualname__}_{self._connection_name}_{ttl_str}"
        _query = cache_data(
            show_spinner="Running `snowpark.query(...)`.",
            ttl=ttl,
        )(_query)

        return _query(sql)

    @property
    def session(self) -> Session:
        """Access the underlying Snowpark session.

        .. note::
            Snowpark sessions are **not** thread safe. Users of this method are
            responsible for ensuring that access to the session returned by this method is
            done in a thread-safe manner. For most users, we recommend using the thread-safe
            safe_session() method and a ``with`` block.

        Information on how to use Snowpark sessions can be found in the `Snowpark documentation
        <https://docs.snowflake.com/en/developer-guide/snowpark/python/working-with-dataframes>`_.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> session = st.connection("snowpark").session
        >>> df = session.table("mytable").limit(10).to_pandas()
        >>> st.dataframe(df)
        """
        return self._instance

    @contextmanager
    def safe_session(self) -> Iterator[Session]:
        """Grab the underlying Snowpark session in a thread-safe manner.

        As operations on a Snowpark session are not thread safe, we need to take care
        when using a session in the context of a Streamlit app where each script run
        occurs in its own thread. Using the contextmanager pattern to do this ensures
        that access on this connection's underlying Session is done in a thread-safe
        manner.

        Information on how to use Snowpark sessions can be found in the `Snowpark documentation
        <https://docs.snowflake.com/en/developer-guide/snowpark/python/working-with-dataframes>`_.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> conn = st.connection("snowpark")
        >>> with conn.safe_session() as session:
        ...     df = session.table("mytable").limit(10).to_pandas()
        ...
        >>> st.dataframe(df)
        """
        with self._lock:
            yield self.session
