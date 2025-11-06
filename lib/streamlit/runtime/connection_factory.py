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

import os
import re
from typing import TYPE_CHECKING, Any, Final, Literal, TypeVar, overload

from streamlit.connections import (
    BaseConnection,
    SnowflakeConnection,
    SnowparkConnection,
    SQLConnection,
)
from streamlit.deprecation_util import deprecate_obj_name
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_resource
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.secrets import secrets_singleton

if TYPE_CHECKING:
    from datetime import timedelta

# NOTE: Adding support for a new first party connection requires:
#   1. Adding the new connection name and class to this dict.
#   2. Writing two new @overloads for connection_factory (one for the case where the
#      only the connection name is specified and another when both name and type are).
#   3. Updating test_get_first_party_connection_helper in connection_factory_test.py.
_FIRST_PARTY_CONNECTIONS: Final[dict[str, type[BaseConnection[Any]]]] = {
    "snowflake": SnowflakeConnection,
    "snowpark": SnowparkConnection,
    "sql": SQLConnection,
}
_MODULE_EXTRACTION_REGEX = re.compile(r"No module named \'(.+)\'")
_MODULES_TO_PYPI_PACKAGES: Final[dict[str, str]] = {
    "MySQLdb": "mysqlclient",
    "psycopg2": "psycopg2-binary",
    "sqlalchemy": "sqlalchemy",
    "snowflake": "snowflake-connector-python",
    "snowflake.connector": "snowflake-connector-python",
    "snowflake.snowpark": "snowflake-snowpark-python",
}
_USE_ENV_PREFIX: Final = "env:"

# The BaseConnection bound is parameterized to `Any` below as subclasses of
# BaseConnection are responsible for binding the type parameter of BaseConnection to a
# concrete type, but the type it gets bound to isn't important to us here.
ConnectionClass = TypeVar("ConnectionClass", bound=BaseConnection[Any])


@gather_metrics("connection")
def _create_connection(
    name: str,
    connection_class: type[ConnectionClass],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs: Any,
) -> ConnectionClass:
    """Create an instance of connection_class with the given name and kwargs.

    The weird implementation of this function with the @cache_resource annotated
    function defined internally is done to:
      - Always @gather_metrics on the call even if the return value is a cached one.
      - Allow the user to specify ttl and max_entries when calling st.connection.
    """

    def __create_connection(
        name: str, connection_class: type[ConnectionClass], **kwargs: Any
    ) -> ConnectionClass:
        return connection_class(connection_name=name, **kwargs)

    if not issubclass(connection_class, BaseConnection):
        raise StreamlitAPIException(
            f"{connection_class} is not a subclass of BaseConnection!"
        )

    # We modify our helper function's `__qualname__` here to work around default
    # `@st.cache_resource` behavior. Otherwise, `st.connection` being called with
    # different `ttl` or `max_entries` values will reset the cache with each call.
    ttl_str = str(ttl).replace(  # Avoid adding extra `.` characters to `__qualname__`
        ".", "_"
    )
    __create_connection.__qualname__ = (
        f"{__create_connection.__qualname__}_{ttl_str}_{max_entries}"
    )
    __create_connection = cache_resource(
        max_entries=max_entries,
        show_spinner="Running `st.connection(...)`.",
        ttl=ttl,
    )(__create_connection)

    return __create_connection(name, connection_class, **kwargs)


def _get_first_party_connection(connection_class: str) -> type[BaseConnection[Any]]:
    if connection_class in _FIRST_PARTY_CONNECTIONS:
        return _FIRST_PARTY_CONNECTIONS[connection_class]

    raise StreamlitAPIException(
        f"Invalid connection '{connection_class}'. "
        f"Supported connection classes: {_FIRST_PARTY_CONNECTIONS}"
    )


@overload
def connection_factory(
    name: Literal["sql"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    autocommit: bool = False,
    **kwargs: Any,
) -> SQLConnection:
    pass


@overload
def connection_factory(
    name: str,
    type: Literal["sql"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    autocommit: bool = False,
    **kwargs: Any,
) -> SQLConnection:
    pass


@overload
def connection_factory(
    name: Literal["snowflake"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    autocommit: bool = False,
    **kwargs: Any,
) -> SnowflakeConnection:
    pass


@overload
def connection_factory(
    name: str,
    type: Literal["snowflake"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    autocommit: bool = False,
    **kwargs: Any,
) -> SnowflakeConnection:
    pass


@overload
def connection_factory(
    name: Literal["snowpark"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs: Any,
) -> SnowparkConnection:
    pass


@overload
def connection_factory(
    name: str,
    type: Literal["snowpark"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs: Any,
) -> SnowparkConnection:
    pass


@overload
def connection_factory(
    name: str,
    type: type[ConnectionClass],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs: Any,
) -> ConnectionClass:
    pass


@overload
def connection_factory(
    name: str,
    type: str | None = None,
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs: Any,
) -> BaseConnection[Any]:
    pass


def connection_factory(  # type: ignore
    name,
    type=None,
    max_entries=None,
    ttl=None,
    **kwargs,
):
    """Create a new connection to a data store or API, or return an existing one.

    Configuration options, credentials, and secrets for connections are
    combined from the following sources:

    - The keyword arguments passed to this command.
    - The app's ``secrets.toml`` files.
    - Any connection-specific configuration files.

    The connection returned from ``st.connection`` is internally cached with
    ``st.cache_resource`` and is therefore shared between sessions.

    Parameters
    ----------
    name : str
        The connection name used for secrets lookup in ``secrets.toml``.
        Streamlit uses secrets under ``[connections.<name>]`` for the
        connection. ``type`` will be inferred if ``name`` is one of the
        following: ``"snowflake"``, ``"snowpark"``, or ``"sql"``.

    type : str, connection class, or None
        The type of connection to create. This can be one of the following:

        - ``None`` (default): Streamlit will infer the connection type from
          ``name``. If the type is not inferable from ``name``, the type must
          be specified in ``secrets.toml`` instead.
        - ``"snowflake"``: Streamlit will initialize a connection with
          |SnowflakeConnection|_.
        - ``"snowpark"``: Streamlit will initialize a connection with
          |SnowparkConnection|_. This is deprecated.
        - ``"sql"``: Streamlit will initialize a connection with
          |SQLConnection|_.
        - A string path to an importable class: This must be a dot-separated
          module path ending in the importable class. Streamlit will import the
          class and initialize a connection with it. The class must extend
          ``st.connections.BaseConnection``.
        - An imported class reference: Streamlit will initialize a connection
          with the referenced class, which must extend
          ``st.connections.BaseConnection``.

        .. |SnowflakeConnection| replace:: ``SnowflakeConnection``
        .. _SnowflakeConnection: https://docs.streamlit.io/develop/api-reference/connections/st.connections.snowflakeconnection
        .. |SnowparkConnection| replace:: ``SnowparkConnection``
        .. _SnowparkConnection: https://docs.streamlit.io/develop/api-reference/connections/st.connections.snowparkconnection
        .. |SQLConnection| replace:: ``SQLConnection``
        .. _SQLConnection: https://docs.streamlit.io/develop/api-reference/connections/st.connections.sqlconnection

    max_entries : int or None
        The maximum number of connections to keep in the cache.
        If this is ``None`` (default), the cache is unbounded. Otherwise, when
        a new entry is added to a full cache, the oldest cached entry is
        removed.
    ttl : float, timedelta, or None
        The maximum number of seconds to keep results in the cache.
        If this is ``None`` (default), cached results do not expire with time.
    **kwargs : any
        Connection-specific keyword arguments that are passed to the
        connection's ``._connect()`` method. ``**kwargs`` are typically
        combined with (and take precedence over) key-value pairs in
        ``secrets.toml``. To learn more, see the specific connection's
        documentation.

    Returns
    -------
    Subclass of BaseConnection
        An initialized connection object of the specified ``type``.

    Examples
    --------
    **Example 1: Inferred connection type**

    The easiest way to create a first-party (SQL, Snowflake, or Snowpark) connection is
    to use their default names and define corresponding sections in your ``secrets.toml``
    file. The following example creates a ``"sql"``-type connection.

    ``.streamlit/secrets.toml``:

    >>> [connections.sql]
    >>> dialect = "xxx"
    >>> host = "xxx"
    >>> username = "xxx"
    >>> password = "xxx"

    Your app code:

    >>> import streamlit as st
    >>> conn = st.connection("sql")

    **Example 2: Named connections**

    Creating a connection with a custom name requires you to explicitly
    specify the type. If ``type`` is not passed as a keyword argument, it must
    be set in the appropriate section of ``secrets.toml``. The following
    example creates two ``"sql"``-type connections, each with their own
    custom name. The first defines ``type`` in the ``st.connection`` command;
    the second defines ``type`` in ``secrets.toml``.

    ``.streamlit/secrets.toml``:

    >>> [connections.first_connection]
    >>> dialect = "xxx"
    >>> host = "xxx"
    >>> username = "xxx"
    >>> password = "xxx"
    >>>
    >>> [connections.second_connection]
    >>> type = "sql"
    >>> dialect = "yyy"
    >>> host = "yyy"
    >>> username = "yyy"
    >>> password = "yyy"

    Your app code:

    >>> import streamlit as st
    >>> conn1 = st.connection("first_connection", type="sql")
    >>> conn2 = st.connection("second_connection")

    **Example 3: Using a path to the connection class**

    Passing the full module path to the connection class can be useful,
    especially when working with a custom connection. Although this is not the
    typical way to create first party connections, the following example
    creates the same type of connection as one with ``type="sql"``. Note that
    ``type`` is a string path.

    ``.streamlit/secrets.toml``:

    >>> [connections.my_sql_connection]
    >>> url = "xxx+xxx://xxx:xxx@xxx:xxx/xxx"

    Your app code:

    >>> import streamlit as st
    >>> conn = st.connection(
    ...     "my_sql_connection", type="streamlit.connections.SQLConnection"
    ... )

    **Example 4: Importing the connection class**

    You can pass the connection class directly to the ``st.connection``
    command. Doing so allows static type checking tools such as ``mypy`` to
    infer the exact return type of ``st.connection``. The following example
    creates the same connection as in Example 3.

    ``.streamlit/secrets.toml``:

    >>> [connections.my_sql_connection]
    >>> url = "xxx+xxx://xxx:xxx@xxx:xxx/xxx"

    Your app code:

    >>> import streamlit as st
    >>> from streamlit.connections import SQLConnection
    >>> conn = st.connection("my_sql_connection", type=SQLConnection)

    """

    if name.startswith(_USE_ENV_PREFIX):
        envvar_name = name.removeprefix(_USE_ENV_PREFIX)
        name = os.environ[envvar_name]

    # type is a nice kwarg name for the st.connection user but is annoying to work with
    # since it conflicts with the builtin function name and thus gets syntax
    # highlighted.
    connection_class = type

    if connection_class is None:
        if name in _FIRST_PARTY_CONNECTIONS:
            # We allow users to simply write `st.connection("sql")` instead of
            # `st.connection("sql", type="sql")`.
            connection_class = _get_first_party_connection(name)
        else:
            # The user didn't specify a type, so we try to pull it out from their
            # secrets.toml file. NOTE: we're okay with any of the dict lookups below
            # exploding with a KeyError since, if type isn't explicitly specified here,
            # it must be the case that it's defined in secrets.toml and should raise an
            # Exception otherwise.
            secrets_singleton.load_if_toml_exists()
            connection_class = secrets_singleton["connections"][name]["type"]

    if isinstance(connection_class, str):
        # We assume that a connection_class specified via string is either the fully
        # qualified name of a class (its module and exported classname) or the string
        # literal shorthand for one of our first party connections. In the former case,
        # connection_class will always contain a "." in its name.
        if "." in connection_class:
            parts = connection_class.split(".")
            classname = parts.pop()

            import importlib

            connection_module = importlib.import_module(".".join(parts))
            connection_class = getattr(connection_module, classname)
        else:
            connection_class = _get_first_party_connection(connection_class)

    # At this point, connection_class should be of type Type[ConnectionClass].
    try:
        conn = _create_connection(
            name, connection_class, max_entries=max_entries, ttl=ttl, **kwargs
        )
        if isinstance(conn, SnowparkConnection):
            conn = deprecate_obj_name(
                conn,
                'connection("snowpark")',
                'connection("snowflake")',
                "2024-04-01",
            )
        return conn
    except ModuleNotFoundError as e:
        err_string = str(e)
        missing_module = re.search(_MODULE_EXTRACTION_REGEX, err_string)

        extra_info = "You may be missing a dependency required to use this connection."
        if missing_module:
            pypi_package = _MODULES_TO_PYPI_PACKAGES.get(missing_module.group(1))
            if pypi_package:
                extra_info = f"You need to install the '{pypi_package}' package to use this connection."

        raise ModuleNotFoundError(f"{e}. {extra_info}")
