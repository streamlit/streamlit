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

# NOTE: We won't always be able to import from snowflake.{connector, snowpark}.* so need
# the `type: ignore` comment below, but that comment will explode if `warn-unused-ignores`
# is turned on when the package is available. Unfortunately, mypy doesn't provide a good
# way to configure this at a per-line level :(
# mypy: no-warn-unused-ignores

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any, Final, Literal, cast

from streamlit import logger
from streamlit.connections import BaseConnection
from streamlit.connections.util import running_in_sis
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_data

_LOGGER: Final = logger.get_logger(__name__)

if TYPE_CHECKING:
    from datetime import timedelta

    from pandas import DataFrame
    from snowflake.connector.cursor import SnowflakeCursor  # type:ignore[import]
    from snowflake.snowpark.session import Session  # type:ignore[import]

    from snowflake.connector import (  # type:ignore[import] # isort: skip
        SnowflakeConnection as InternalSnowflakeConnection,
    )

# the ANSI-compliant SQL code for "connection was not established"
# (see docs: https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-api#id6)
SQLSTATE_CONNECTION_WAS_NOT_ESTABLISHED: Final = "08001"

# The location on disk where Snowpark Container Services will mount service connection tokens.
SNOWPARK_CONNECTION_TOKEN_FILE = "/snowflake/session/token"  # noqa: S105 (not a password)

# The header where Snowpark Container Services will put per-user connection tokens.
SNOWPARK_USER_TOKEN_HEADER_NAME = "Sf-Context-Current-User-Token"  # noqa: S105 (not a password)


class BaseSnowflakeConnection(BaseConnection["InternalSnowflakeConnection"]):
    """Base class for Snowflake connections.

    This base class provides the common methods and properties for Snowflake
    connections. See the docstrings for each of these methods for more
    information. The docstring for ``SnowflakeConnection`` provides an overall
    description of the Snowflake connection types.
    """

    def query(
        self,
        sql: str,
        *,  # keyword-only arguments:
        ttl: float | int | timedelta | None = None,
        show_spinner: bool | str = "Running `snowflake.query(...)`.",
        params: Any = None,
        **kwargs: Any,
    ) -> DataFrame:
        """Run a read-only SQL query.

        This method implements query result caching and simple error
        handling/retries. The caching behavior is identical to that of using
        ``@st.cache_data``.

        .. note::
            Queries that are run without a specified ``ttl`` are cached
            indefinitely.

        Parameters
        ----------
        sql : str
            The read-only SQL query to execute.
        ttl : float, int, timedelta or None
            The maximum number of seconds to keep results in the cache. If this
            is ``None`` (default), cached results do not expire with time.
        show_spinner : boolean or string
            Whether to enable the spinner. When a cached query is executed, no
            spinner is displayed because the result is immediately available.
            When a new query is executed, the default is to show a spinner with
            the message "Running ``snowflake.query(...)``."

            If this is ``False``, no spinner displays while executing the
            query. If this is a string, the string will be used as the message
            for the spinner.
        params : list, tuple, dict or None
            List of parameters to pass to the Snowflake Connector for Python
            ``Cursor.execute()`` method. This connector supports binding data
            to a SQL statement using qmark bindings. For more information and
            examples, see the `Snowflake Connector for Python documentation
            <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-example#using-qmark-or-numeric-binding>`_.
            This defaults to ``None``.

        Returns
        -------
        pandas.DataFrame
            The result of running the query, formatted as a pandas DataFrame.

        Example
        -------

        >>> import streamlit as st
        >>>
        >>> conn = st.connection("snowflake")
        >>> df = conn.query("SELECT * FROM my_table")
        >>> st.dataframe(df)

        """
        from tenacity import retry, retry_if_exception, stop_after_attempt, wait_fixed

        @retry(
            after=lambda _: self.reset(),
            stop=stop_after_attempt(3),
            reraise=True,
            # We don't have to implement retries ourself for most error types as the
            # `snowflake-connector-python` library already implements retries for
            # retryable HTTP errors.
            retry=retry_if_exception(
                lambda e: hasattr(e, "sqlstate")
                and e.sqlstate == SQLSTATE_CONNECTION_WAS_NOT_ESTABLISHED
            ),
            wait=wait_fixed(1),
        )
        # `params` must be an explicit parameter (not captured from closure) so that
        # `@st.cache_data` includes it in the cache key.
        def _query(sql: str, params: Any = None) -> DataFrame:
            cur = self._instance.cursor()
            cur.execute(sql, params=params, **kwargs)
            return cur.fetch_pandas_all()  # type: ignore

        # We modify our helper function's `__qualname__` here to work around default
        # `@st.cache_data` behavior. Otherwise, `.query()` being called with different
        # `ttl` values will reset the cache with each call, and the query caches won't
        # be scoped by connection.
        ttl_str = str(  # Avoid adding extra `.` characters to `__qualname__`
            ttl
        ).replace(".", "_")
        _query.__qualname__ = f"{_query.__qualname__}_{self._connection_name}_{ttl_str}"
        _query = cache_data(
            show_spinner=show_spinner,
            ttl=ttl,
        )(_query)

        return _query(sql, params)

    def write_pandas(
        self,
        df: DataFrame,
        table_name: str,
        database: str | None = None,
        schema: str | None = None,
        chunk_size: int | None = None,
        **kwargs: Any,
    ) -> tuple[bool, int, int]:
        """Write a ``pandas.DataFrame`` to a table in a Snowflake database.

        This convenience method is a thin wrapper around
        ``snowflake.connector.pandas_tools.write_pandas()`` using the
        underlying connection. The ``conn`` parameter is passed automatically.
        For more information and additional keyword arguments, see the
        `Snowflake Connector for Python documentation
        <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-api#write_pandas>`_.

        Parameters
        ----------
        df: pandas.DataFrame
            The ``pandas.DataFrame`` object containing the data to be copied
            into the table.
        table_name: str
            Name of the table where the data should be copied to.
        database: str
            Name of the database containing the table. By default, the function
            writes to the database that is currently in use in the session.

            .. Note::
                If you specify this parameter, you must also specify the schema
                parameter.

        schema: str
            Name of the schema containing the table. By default, the function
            writes to the table in the schema that is currently in use in the
            session.
        chunk_size: int
            Number of elements to insert at a time. By default, the function
            inserts all elements in one chunk.
        **kwargs: Any
            Additional keyword arguments for
            ``snowflake.connector.pandas_tools.write_pandas()``.

        Returns
        -------
        tuple[bool, int, int]
            A tuple containing three values:

            1. A boolean value that is ``True`` if the write was successful.
            2. An integer giving the number of chunks of data that were copied.
            3. An integer giving the number of rows that were inserted.

        Example
        -------
        The following example uses the database and schema currently in use in
        the session and copies the data into a table named "my_table."

        >>> import streamlit as st
        >>> import pandas as pd
        >>>
        >>> df = pd.DataFrame(
        ...     {"Name": ["Mary", "John", "Robert"], "Pet": ["dog", "cat", "bird"]}
        ... )
        >>> conn = st.connection("snowflake")
        >>> conn.write_pandas(df, "my_table")

        """
        from snowflake.connector.pandas_tools import write_pandas  # type:ignore[import]

        success, nchunks, nrows, _ = write_pandas(
            conn=self._instance,
            df=df,
            table_name=table_name,
            database=database,
            schema=schema,
            chunk_size=chunk_size,
            **kwargs,
        )

        return (success, nchunks, nrows)

    def cursor(self) -> SnowflakeCursor:
        """Create a new cursor object from this connection.

        Snowflake Connector cursors implement the Python Database API v2.0
        specification (PEP-249). For more information, see the
        `Snowflake Connector for Python documentation
        <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-api#object-cursor>`_.

        Returns
        -------
        snowflake.connector.cursor.SnowflakeCursor
            A cursor object for the connection.

        Example
        -------
        The following example uses a cursor to insert multiple rows into a
        table. The ``qmark`` parameter style is specified as an optional
        keyword argument. Alternatively, the parameter style can be declared in
        your connection configuration file. For more information, see the
        `Snowflake Connector for Python documentation
        <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-example#using-qmark-or-numeric-binding>`_.

        >>> import streamlit as st
        >>>
        >>> conn = st.connection("snowflake", "paramstyle"="qmark")
        >>> rows_to_insert = [("Mary", "dog"), ("John", "cat"), ("Robert", "bird")]
        >>> conn.cursor().executemany(
        ...     "INSERT INTO mytable (name, pet) VALUES (?, ?)", rows_to_insert
        ... )

        """
        return self._instance.cursor()

    @property
    def raw_connection(self) -> InternalSnowflakeConnection:
        """Access the underlying connection object from the Snowflake\
        Connector for Python.

        For information on how to use the Snowflake Connector for Python, see
        the `Snowflake Connector for Python documentation
        <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-example>`_.

        Returns
        -------
        snowflake.connector.connection.SnowflakeConnection
            The connection object.

        Example
        -------
        The following example uses a cursor to submit an asynchronous query,
        saves the query ID, then periodically checks the query status through
        the connection before retrieving the results.

        >>> import streamlit as st
        >>> import time
        >>>
        >>> conn = st.connection("snowflake")
        >>> cur = conn.cursor()
        >>> cur.execute_async("SELECT * FROM my_table")
        >>> query_id = cur.sfqid
        >>> while True:
        ...     status = conn.raw_connection.get_query_status(query_id)
        ...     if conn.raw_connection.is_still_running(status):
        ...         time.sleep(1)
        ...     else:
        ...         break
        >>> cur.get_results_from_sfqid(query_id)
        >>> df = cur.fetchall()

        """
        return self._instance

    def session(self) -> Session:
        """Create a new Snowpark session from this connection.

        For information on how to use Snowpark sessions, see the
        `Snowpark developer guide
        <https://docs.snowflake.com/en/developer-guide/snowpark/python/working-with-dataframes>`_
        and `Snowpark API Reference
        <https://docs.snowflake.com/en/developer-guide/snowpark/reference/python/latest/snowpark/session>`_.

        Returns
        -------
        snowflake.snowpark.Session
            A new Snowpark session for this connection.

        Example
        -------
        The following example creates a new Snowpark session and uses it to run
        a query.

        >>> import streamlit as st
        >>>
        >>> conn = st.connection("snowflake")
        >>> session = conn.session()
        >>> df = session.sql("SELECT * FROM my_table").collect()

        """
        from snowflake.snowpark.context import get_active_session  # type:ignore[import]
        from snowflake.snowpark.session import Session  # type:ignore[import]

        if running_in_sis():
            return get_active_session()

        return cast(
            "Session", Session.builder.configs({"connection": self._instance}).create()
        )

    def close(self) -> None:
        """Closes the underlying Snowflake connection."""
        if self._raw_instance is not None:
            self._raw_instance.close()
            self._raw_instance = None


class SnowflakeConnection(BaseSnowflakeConnection):
    """A connection to Snowflake using the Snowflake Connector for Python.

    For standard connections, create an instance of this using
    ``st.connection("snowflake")`` or
    ``st.connection("<name>", type="snowflake")``. Connection parameters for a
    SnowflakeConnection can be specified using ``secrets.toml`` and/or
    ``**kwargs``. Connection parameters are passed to
    |snowflake.connector.connect()|_.

    When an app is running in Streamlit in Snowflake,
    ``st.connection("snowflake")`` connects automatically using the app owner's
    role without further configuration. ``**kwargs`` are ignored in this
    case. Use ``secrets.toml`` and ``**kwargs`` to configure your connection
    for local development.

    When an app is running in Snowpark Container Services and has caller's rights
    enabled, ``st.connection("snowflake-callers-rights")`` connects automatically
    using the current user's identity tokens. This is a session-scoped connection
    to ensure that the identity stays tied to the active user. Unlike with
    ``"snowflake"`` connections, it will use the Snowpark Container Services
    connection settings even when other ``**kwargs`` are provided.

    The Snowflake connection includes several convenience methods. For example, you
    can directly execute a SQL query with ``.query()`` or access the underlying
    Snowflake Connector object with ``.raw_connection``.

    .. |snowflake.connector.connect()| replace:: ``snowflake.connector.connect()``
    .. _snowflake.connector.connect(): https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-api#label-snowflake-connector-methods-connect

    .. Important::
        - `snowflake-snowpark-python <https://pypi.org/project/snowflake-snowpark-python/>`_
          must be installed in your environment to use this connection. You can
          install it as an extra with Streamlit:

          .. code-block:: shell

             pip install streamlit[snowflake]

        - Account identifiers must be of the form ``<orgname>-<account_name>``
          where ``<orgname>`` is the name of your Snowflake organization and
          ``<account_name>`` is the unique name of your account within your
          organization. This is dash-separated, not dot-separated like when used
          in SQL queries. For more information, see `Account identifiers
          <https://docs.snowflake.com/en/user-guide/admin-account-identifier>`_.

        - Caller's rights connections rely on credentials provided when a user first
          connects to a Streamlit app. These credentials are only valid for about
          two minutes. Therefore, caller's rights connections must be created at
          the top of an app or else the connection may fail.

        - To develop locally with a caller's rights connection, use an
          environment variable to logically switch between a ``"snowflake"``
          connection locally and a ``"snowflake-callers-rights"`` connection in
          Snowpark Container Services.

    Examples
    --------
    **Example 1: Configuration with Streamlit secrets**

    You can configure your Snowflake connection using Streamlit's
    `Secrets management <https://docs.streamlit.io/develop/concepts/connections/secrets-management>`_.
    For example, if you have MFA enabled on your account, you can connect using
    `key-pair authentication <https://docs.snowflake.com/en/user-guide/key-pair-auth>`_.

    .. code-block:: toml
        :filename: ~/.snowflake/connections.toml

        [connections.snowflake]
        account = "xxx-xxx"
        user = "xxx"
        private_key_file = "/xxx/xxx/xxx.p8"
        role = "xxx"
        warehouse = "xxx"
        database = "xxx"
        schema = "xxx"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        conn = st.connection("snowflake")
        df = conn.query("SELECT * FROM my_table")

    **Example 2: Configuration with keyword arguments and external authentication**

    You can configure your Snowflake connection with keyword arguments. The
    keyword arguments are merged with (and take precedence over) the values in
    ``secrets.toml``. However, if you name your connection ``"snowflake"`` and
    don't have a ``[connections.snowflake]`` dictionary in your
    ``secrets.toml`` file, Streamlit will ignore any keyword arguments and use
    the default Snowflake connection as described in Example 5 and Example 6.
    To configure your connection using only keyword arguments, declare a name
    for the connection other than ``"snowflake"``.

    For example, if your Snowflake account supports SSO, you can set up a quick
    local connection for development using `browser-based SSO
    <https://docs.snowflake.com/en/user-guide/admin-security-fed-auth-use#how-browser-based-sso-works>`_.
    Because there is nothing configured in ``secrets.toml``, the name is an
    empty string and the type is set to ``"snowflake"``. This prevents
    Streamlit from ignoring the keyword arguments and using a default
    Snowflake connection.

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        conn = st.connection(
            "",
            type="snowflake",
            account="xxx-xxx",
            user="xxx",
            authenticator="externalbrowser",
        )
        df = conn.query("SELECT * FROM my_table")

    **Example 3: Named connection with Snowflake's connection configuration file**

    Snowflake's Python Connector supports a `connection configuration file
    <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect#connecting-using-the-connections-toml-file>`_,
    which is well integrated with Streamlit's ``SnowflakeConnection``. If you
    already have one or more connections configured, all you need to do is pass
    the name of the connection to use.

    .. code-block:: toml
        :filename: ~/.snowflake/connections.toml

        [my_connection]
        account = "xxx-xxx"
        user = "xxx"
        password = "xxx"
        warehouse = "xxx"
        database = "xxx"
        schema = "xxx"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        conn = st.connection("my_connection", type="snowflake")
        df = conn.query("SELECT * FROM my_table")

    **Example 4: Named connection with Streamlit secrets and Snowflake's connection configuration file**

    If you have a Snowflake configuration file with a connection named
    ``my_connection`` as in Example 3, you can pass the connection name through
    ``secrets.toml``.

    .. code-block:: toml
        :filename: .streamlit/secrets.toml

        [connections.snowflake]
        connection_name = "my_connection"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        conn = st.connection("snowflake")
        df = conn.query("SELECT * FROM my_table")

    **Example 5: Default connection with an environment variable**

    If you don't have a ``[connections.snowflake]`` dictionary in your
    ``secrets.toml`` file and use ``st.connection("snowflake")``, Streamlit
    will use the default connection for the `Snowflake Python Connector
    <https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect#setting-a-default-connection>`_.

    If you have a Snowflake configuration file with a connection named
    ``my_connection`` as in Example 3, you can set an environment variable to
    declare it as the default Snowflake connection.

    .. code-block:: toml
        :filename: .streamlit/secrets.toml

        SNOWFLAKE_DEFAULT_CONNECTION_NAME = "my_connection"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        conn = st.connection("snowflake")
        df = conn.query("SELECT * FROM my_table")

    **Example 6: Default connection in Snowflake's connection configuration file**

    If you have a Snowflake configuration file that defines your ``default``
    connection, Streamlit will automatically use it if no other connection is
    declared.

    .. code-block:: toml
        :filename: ~/.snowflake/connections.toml

        [default]
        account = "xxx-xxx"
        user = "xxx"
        password = "xxx"
        warehouse = "xxx"
        database = "xxx"
        schema = "xxx"

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        conn = st.connection("snowflake")
        df = conn.query("SELECT * FROM my_table")

    **Example 7: Caller's rights connection when running in Snowpark Container Services**

    You can use ``"snowflake-callers-rights"`` type connections in any
    environment running on Snowpark Container Services, including Streamlit in
    Snowflake on containers and any self-managed caller's rights Service.

    This will use the Snowpark-provided account, host, database, and schema to connect.
    Additionally, it will set ``client_session_keep_alive`` to ``True``. These values
    may be overridden with ``**kwargs`` in ``st.connection``. For a complete list
    of keyword arguments, see the documentation for |snowflake.connector.connect()|_.

    .. |snowflake.connector.connect()| replace:: ``snowflake.connector.connect()``
    .. _snowflake.connector.connect(): https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-api#label-snowflake-connector-methods-connect

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        conn = st.connection("snowflake-callers-rights")
        df = conn.query("SELECT * FROM my_table")

    If you want to develop locally with a caller's rights connection, use an
    environment variable to logically switch between a ``"snowflake"``
    connection locally and a ``"snowflake-callers-rights"`` connection in
    Snowpark Container Services.

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        conn = (
            st.connection("snowflake")
            if "LOCAL_DEVELOPMENT" in st.secrets and st.secrets["LOCAL_DEVELOPMENT"]
            else st.connection("snowflake-callers-rights")
        )
        df = conn.query("SELECT * FROM my_table")
    """

    def _connect(self, **kwargs: Any) -> InternalSnowflakeConnection:
        import snowflake.connector  # type:ignore[import]
        from snowflake.connector import Error as SnowflakeError  # type:ignore[import]

        # If we're running in SiS-on-warehouses, just call get_active_session() and
        # retrieve the lower-level connection from it.
        if running_in_sis():
            from snowflake.snowpark.context import (  # type:ignore[import]  # isort: skip
                get_active_session,
            )

            session = get_active_session()

            if hasattr(session, "connection"):
                return session.connection
            # session.connection is only a valid attr in more recent versions of
            # snowflake-connector-python, so we fall back to grabbing
            # session._conn._conn if `.connection` is unavailable.
            return session._conn._conn

        # We require qmark-style parameters everywhere for consistency across different
        # environments where SnowflakeConnections may be used.
        snowflake.connector.paramstyle = "qmark"

        # Otherwise, attempt to create a new connection from whatever credentials we
        # have available.
        st_secrets = self._secrets.to_dict()
        try:
            if len(st_secrets):
                _LOGGER.info(
                    "Connect to Snowflake using the Streamlit secret defined under "
                    "[connections.snowflake]."
                )
                conn_kwargs = {**st_secrets, **kwargs}
                return snowflake.connector.connect(**conn_kwargs)

            # Use the default configuration as defined in https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect#setting-a-default-connection
            if self._connection_name == "snowflake":
                _LOGGER.info(
                    "Connect to Snowflake using the default configuration as defined "
                    "in https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect#setting-a-default-connection"
                )
                return snowflake.connector.connect()

            return snowflake.connector.connect(**kwargs)
        except SnowflakeError:
            if not len(st_secrets) and not kwargs:
                raise StreamlitAPIException(
                    "Missing Snowflake connection configuration. "
                    "Did you forget to set this in `secrets.toml`, a Snowflake configuration file, "
                    "or as kwargs to `st.connection`? "
                    "See the [SnowflakeConnection configuration documentation]"
                    "(https://docs.streamlit.io/st.connections.snowflakeconnection-configuration) "
                    "for more details and examples."
                )
            raise


class SnowflakeCallersRightsConnection(SnowflakeConnection):
    """A caller's rights connection to Snowflake using the Snowflake Connector for Python.

    This will only work when running on Snowpark Container Services or another
    compatible platform.

    See ``BaseSnowflakeConnection`` for complete docs.
    """

    @classmethod
    def scope(cls) -> Literal["session"]:
        """Returns ``"session"``.

        Caller's rights Snowflake connections rely on per-session connection tokens and
        therefore must be session-scoped.
        """
        return "session"

    @classmethod
    def _read_token_file(cls) -> str:
        """Returns the contents of the Snowpark token file on disk."""
        with open(SNOWPARK_CONNECTION_TOKEN_FILE, encoding="utf-8") as token_file:
            return token_file.read()

    @classmethod
    def _get_connection_params(cls) -> dict[str, str | bool]:
        """Returns caller's rights connection parameters for the current session.

        Raises
        ------
            StreamlitAPIException: if any Snowpark environment variables or connection
            tokens are missing; or if this is called outside of a session context.
        """
        # Local import needed to avoid cycles.
        from streamlit import context as st_context

        # See Snowflake docs:
        # https://docs.snowflake.com/en/developer-guide/snowpark-container-services/additional-considerations-services-jobs#configuring-caller-s-rights-for-your-service

        # Base parameters, common to all connections.
        params: dict[str, str | bool] = {
            "authenticator": "oauth",
            # OCSP checks do not work in Snowflake containers.
            "ocsp_fail_open": True,
            # We want to keep this alive, as the user token will expire fairly quickly
            # - so we can't create a new session on expiration.
            "client_session_keep_alive": True,
        }
        for param_name, env_var_name in (
            ("account", "SNOWFLAKE_ACCOUNT"),
            ("host", "SNOWFLAKE_HOST"),
            ("database", "SNOWFLAKE_DATABASE"),
            ("schema", "SNOWFLAKE_SCHEMA"),
        ):
            value = os.getenv(env_var_name)
            if value is None:
                raise StreamlitAPIException(
                    f"Environment variable `{env_var_name}` not found. Is this app "
                    "running in a Snowflake container environment?"
                )
            params[param_name] = value

        # Validate the token file exists, and read it.
        if not os.path.exists(SNOWPARK_CONNECTION_TOKEN_FILE):
            raise StreamlitAPIException(
                f"Token file `{SNOWPARK_CONNECTION_TOKEN_FILE}` not found. Is this app "
                "running in a Snowflake container environment?"
            )
        login_token = cls._read_token_file()

        # Validate the token header exists, and read it.
        if SNOWPARK_USER_TOKEN_HEADER_NAME not in st_context.headers:
            raise StreamlitAPIException(
                "Token header not found. Is this app running with caller's "
                "rights enabled, and is this connection being created in an app "
                "execution thread?"
            )
        user_token = st_context.headers[SNOWPARK_USER_TOKEN_HEADER_NAME]

        # Build the actual caller's rights token.
        params["token"] = f"{login_token}.{user_token}"

        return params

    def _connect(self, **kwargs: Any) -> InternalSnowflakeConnection:
        import snowflake.connector  # type:ignore[import]

        # We require qmark-style parameters everywhere for consistency across different
        # environments where SnowflakeConnections may be used.
        snowflake.connector.paramstyle = "qmark"

        params = self._get_connection_params()

        # Connect with the params we generated, overriding with user-specified params.
        return snowflake.connector.connect(**{**params, **kwargs})
