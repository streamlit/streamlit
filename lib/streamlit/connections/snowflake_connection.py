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

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

import pandas as pd

from streamlit.connections import BaseConnection
from streamlit.connections.util import load_from_snowsql_config_file, running_in_sis
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from snowflake.connector import DictCursor as Cursor
    from snowflake.connector import SnowflakeConnection as InternalSnowflakeConnection
    from snowflake.snowpark.session import Session


_REQUIRED_CONNECTION_PARAMS = {"account"}


class SnowflakeConnection(BaseConnection["InternalSnowflakeConnection"]):
    """A connection to Snowflake using the Snowflake Python Connector. Initialize using
    ``st.connection("<name>", type="snowflake")``.

    TODO(vdonato): Finish this docstring.
    """

    def _connect(self, **kwargs) -> "InternalSnowflakeConnection":
        import snowflake.connector
        from snowflake.snowpark.context import get_active_session  # type: ignore

        # If we're running in SiS, just call get_active_session() and retrieve the
        # lower-level connection from it.
        if running_in_sis():
            session = get_active_session()

            if hasattr(session, "connection"):
                return session.connection
            return session._conn._conn

        # Otherwise, attempt to create a new connection from whatever credentials we
        # have available.

        st_secrets = self._secrets.to_dict()
        if len(st_secrets):
            # TODO(vdonato): Double-check that we want to merge any secrets we find with
            # the kwargs passed to `st.connection`.
            conn_kwargs = {**st_secrets, **kwargs}
            return snowflake.connector.connect(**conn_kwargs)

        if hasattr(snowflake.connector.connection, "CONFIG_MANAGER"):
            # TODO(vdonato): Double-check that we want to map the "snowflake" connection
            # name in a call to `st.connection` to the "default" connection in the
            # Snowflake config file. This is aligned with the default behavior for the
            # underlying python connector and seems more sane than having a "snowflake"
            # connection in a snowflake-specific config file.
            connection_name = (
                "default"
                if self._connection_name == "snowflake"
                else self._connection_name
            )
            return snowflake.connector.connect(
                connection_name=connection_name,
                **kwargs,
            )

        # If we have a version of the Snowflake Python Connector installed that predates
        # the ConfigManager, look for credentials in  ~/.snowsql/config as a last
        # resort.
        snowsql_config = load_from_snowsql_config_file()
        conn_kwargs = {**snowsql_config, **kwargs}

        for p in _REQUIRED_CONNECTION_PARAMS:
            if p not in conn_params:
                raise StreamlitAPIException(f"Missing Snowflake connection param: {p}")

        return snowflake.connector.connect(**conn_kwargs)

    def query(
        self,
        sql: str,
        *,  # keyword-only arguments:
        ttl: float | int | timedelta | None = None,
        show_spinner: bool | str = "Running `snowflake.query(...)`.",
        params=None,
        **kwargs,
    ) -> pd.DataFrame:
        """Run a read-only SQL query.

        TODO(vdonato): Finish this docstring.
        """
        # TODO(vdonato): Make our error handling more specific if possible. This may be
        # difficult to do given the limited documentation on the different connector
        # error subclasses + how many there are.
        from snowflake.connector import Error as SnowflakeError
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
            retry=retry_if_exception_type(SnowflakeError),
            wait=wait_fixed(1),
        )
        @cache_data(
            show_spinner=show_spinner,
            ttl=ttl,
        )
        def _query(sql: str) -> pd.DataFrame:
            cur = self._instance.cursor()
            cur.execute(sql)
            return cur.fetch_pandas_all()

        return _query(sql)

    def write_pandas(
        self,
        df: pd.DataFrame,
        table_name: str,
        database: str = None,
        schema: str = None,
        chunk_size: int = None,
        **kwargs,
    ) -> (bool, int, int, str):
        """Call snowflake.connector.pandas_tools.write_pandas with this connection.

        This convenience method is simply a thin wrapper around the ``write_pandas``
        function of the same name from ``snowflake.connector.pandas_tools``. For more
        information, see the `Snowflake Python Connector documentation
        <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-api#write_pandas>`_.
        """
        from snowflake.connector.pandas_tools import write_pandas

        return write_pandas(
            conn=self._instance,
            df=df,
            table_name=table_name,
            database=database,
            schema=schema,
            chunk_size=chunk_size,
            **kwargs,
        )

    def cursor(self) -> "Cursor":
        """Return a PEP 249-compliant cursor object.

        For more information, see the `Snowflake Python Connector documentation
        <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-api#object-cursor>`_.
        """
        return conn._instance.cursor()

    @property
    def raw_connection(self) -> "InternalSnowflakeConnection":
        """Access the underlying Snowflake Python connector object.

        Information on how to use the Snowflake Python Connector can be found in the
        `Snowflake Python Connector documentation<https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-example>`_.
        """
        return self._instance

    def session(self) -> "Session":
        """Create a new Snowpark Session from this connection.

        Information on how to use Snowpark sessions can be found in the `Snowpark documentation
        <https://docs.snowflake.com/en/developer-guide/snowpark/python/working-with-dataframes>`_.
        """
        from snowflake.snowpark.session import Session

        return Session.builder.configs({"connection": self._instance}).create()
