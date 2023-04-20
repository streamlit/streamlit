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

import importlib
import os
import re
from datetime import timedelta
from typing import Any, Dict, Type, TypeVar, overload

from typing_extensions import Final, Literal

from streamlit.connections import (
    ExperimentalBaseConnection,
    SnowparkConnection,
    SQLConnection,
)
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_resource
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.secrets import secrets_singleton

# NOTE: Adding support for a new first party connection requires:
#   1. Adding the new connection name and class to this dict.
#   2. Writing two new @overloads for connection_factory (one for the case where the
#      only the connection name is specified and another when both name and type are).
#   3. Updating test_get_first_party_connection_helper in connection_factory_test.py.
FIRST_PARTY_CONNECTIONS = {
    "snowpark": SnowparkConnection,
    "sql": SQLConnection,
}
MODULE_EXTRACTION_REGEX = re.compile(r"No module named \'(.+)\'")
MODULES_TO_PYPI_PACKAGES: Final[Dict[str, str]] = {
    "MySQLdb": "mysqlclient",
    "psycopg2": "psycopg2-binary",
    "sqlalchemy": "sqlalchemy",
    "snowflake": "snowflake-snowpark-python",
    "snowflake.snowpark": "snowflake-snowpark-python",
}

# The ExperimentalBaseConnection bound is parameterized to `Any` below as subclasses of
# ExperimentalBaseConnection are responsible for binding the type parameter of
# ExperimentalBaseConnection to a concrete type, but the type it gets bound to isn't
# important to us here.
ConnectionClass = TypeVar("ConnectionClass", bound=ExperimentalBaseConnection[Any])


@gather_metrics("experimental_connection")
def _create_connection(
    name: str,
    connection_class: Type[ConnectionClass],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs,
) -> ConnectionClass:
    """Create an instance of connection_class with the given name and kwargs.

    The weird implementation of this function with the @cache_resource annotated
    function defined internally is done to:
      * Always @gather_metrics on the call even if the return value is a cached one.
      * Allow the user to specify ttl and max_entries when calling st.experimental_connection.
    """

    @cache_resource(
        max_entries=max_entries,
        show_spinner="Running `st.experimental_connection(...)`.",
        ttl=ttl,
    )
    def __create_connection(
        name: str, connection_class: Type[ConnectionClass], **kwargs
    ) -> ConnectionClass:
        return connection_class(connection_name=name, **kwargs)

    if not issubclass(connection_class, ExperimentalBaseConnection):
        raise StreamlitAPIException(
            f"{connection_class} is not a subclass of ExperimentalBaseConnection!"
        )

    return __create_connection(name, connection_class, **kwargs)


def _get_first_party_connection(connection_class: str):
    if connection_class in FIRST_PARTY_CONNECTIONS:
        return FIRST_PARTY_CONNECTIONS[connection_class]

    raise StreamlitAPIException(
        f"Invalid connection '{connection_class}'. "
        f"Supported connection classes: {FIRST_PARTY_CONNECTIONS}"
    )


@overload
def connection_factory(
    name: Literal["sql"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    autocommit: bool = False,
    **kwargs,
) -> SQLConnection:
    pass


@overload
def connection_factory(
    name: str,
    type: Literal["sql"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    autocommit: bool = False,
    **kwargs,
) -> SQLConnection:
    pass


@overload
def connection_factory(
    name: Literal["snowpark"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs,
) -> SnowparkConnection:
    pass


@overload
def connection_factory(
    name: str,
    type: Literal["snowpark"],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs,
) -> SnowparkConnection:
    pass


@overload
def connection_factory(
    name: str,
    type: Type[ConnectionClass],
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs,
) -> ConnectionClass:
    pass


@overload
def connection_factory(
    name: str,
    type: str | None = None,
    max_entries: int | None = None,
    ttl: float | timedelta | None = None,
    **kwargs,
) -> ExperimentalBaseConnection[Any]:
    pass


def connection_factory(
    name,
    type=None,
    max_entries=None,
    ttl=None,
    **kwargs,
):
    """Create a new connection or return an existing one.

    Config options, credentials, secrets, etc. for connections are sourced from various
    sources:
      * Any connection-specific configuration files.
      * An app's `secrets.toml` files.
      * The kwargs passed to this function.

    Parameters
    ----------
    name : str
        The connection name, used for secrets lookup in `[connections.<name>]`.
        Type will be inferred from passing `"sql"` or `"snowpark"`.
    type : str or connection class
        The type of connection to create. It can be a keyword (`"sql"` or `"snowpark"`),
        a path to an importable class, or an imported class reference. All classes
        must extend `st.connections.ExperimentalBaseConnection` and implement the
        `_connect()` method.
    max_entries : int or None
            The maximum number of connections to keep in the cache, or None
            for an unbounded cache. (When a new entry is added to a full cache,
            the oldest cached entry will be removed.) The default is None.
    ttl : float or timedelta or None
        The maximum number of seconds to keep results in the cache, or
        None if cached results should not expire. The default is None.
    **kwargs : Additional connection specific kwargs, that are passed to the Connection's
        `_connect()` method. Learn more from the specific Connection's documentation.

    Returns
    -------
    Connection object
        An initialized Connection object of the specified type.

    Examples
    --------
    The easiest way to create a first-party (SQL or Snowpark) connection is to use their
    default names and define corresponding sections in your config.toml file.

    >>> import streamlit as st
    >>> conn = st.connection("sql")  # Config section defined in [connections.sql] in secrets.toml.

    Creating a SQLConnection with a custom name requires you to explicitly specify the
    type. If type is not passed in as a kwarg, we try to infer it from the contents of
    your secrets.toml.

    >>> import streamlit as st
    >>> conn1 = st.connection("my_sql_connection", type="sql")  # Config section defined in [connections.my_sql_connection].
    >>> conn2 = st.connection("my_other_sql_connection")  # Type is inferred from [connections.my_other_sql_connection].

    Passing the full module path to the connection class that you want to use can be
    useful, especially when working with a custom connection:

    >>> import streamlit as st
    >>> conn = st.connection("my_sql_connection", type="streamlit.connections.SQLConnection")

    Finally, you can even pass the connection class to use directly to this function.

    >>> import streamlit as st
    >>> from streamlit.connections import SQLConnection
    >>> conn = st.connection("my_sql_connection", type=SQLConnection)
    """
    USE_ENV_PREFIX = "env:"

    if name.startswith(USE_ENV_PREFIX):
        # It'd be nice to use str.removeprefix() here, but we won't be able to do that
        # until the minimium Python version we support is 3.9.
        envvar_name = name[len(USE_ENV_PREFIX) :]
        name = os.environ[envvar_name]

    if type is None:
        if name in FIRST_PARTY_CONNECTIONS:
            # We allow users to simply write `st.experimental_connection("sql")`
            # instead of `st.experimental_connection("sql", type="sql")`.
            type = _get_first_party_connection(name)
        else:
            # The user didn't specify a type, so we try to pull it out from their
            # secrets.toml file. NOTE: we're okay with any of the dict lookups below
            # exploding with a KeyError since, if type isn't explicitly specified here,
            # it must be the case that it's defined in secrets.toml and should raise an
            # Exception otherwise.
            secrets_singleton.load_if_toml_exists()
            type = secrets_singleton["connections"][name]["type"]

    # type is a nice kwarg name for the st.experimental_connection user but is annoying
    # to work with since it conflicts with the builtin function name and thus gets
    # syntax highlighted.
    connection_class = type

    if isinstance(connection_class, str):
        # We assume that a connection_class specified via string is either the fully
        # qualified name of a class (its module and exported classname) or the string
        # literal shorthand for one of our first party connections. In the former case,
        # connection_class will always contain a "." in its name.
        if "." in connection_class:
            parts = connection_class.split(".")
            classname = parts.pop()
            connection_module = importlib.import_module(".".join(parts))
            connection_class = getattr(connection_module, classname)
        else:
            connection_class = _get_first_party_connection(connection_class)

    # At this point, connection_class should be of type Type[ConnectionClass].
    try:
        return _create_connection(
            name, connection_class, max_entries=max_entries, ttl=ttl, **kwargs
        )
    except ModuleNotFoundError as e:
        err_string = str(e)
        missing_module = re.search(MODULE_EXTRACTION_REGEX, err_string)

        extra_info = "You may be missing a dependency required to use this connection."
        if missing_module:
            pypi_package = MODULES_TO_PYPI_PACKAGES.get(missing_module.group(1))
            if pypi_package:
                extra_info = f"You need to install the '{pypi_package}' package to use this connection."

        raise ModuleNotFoundError(f"{str(e)}. {extra_info}")
