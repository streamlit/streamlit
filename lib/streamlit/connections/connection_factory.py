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

from typing import Any, Type, TypeVar, overload

from typing_extensions import Literal

from streamlit.connections.base_connection import BaseConnection
from streamlit.connections.file_connection import File
from streamlit.connections.snowpark_connection import Snowpark
from streamlit.connections.sql_connection import SQL
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_resource
from streamlit.runtime.metrics_util import gather_metrics

# The BaseConnection bound should be parameterized to `Any` below as subclasses of
# BaseConnection are responsible for binding the type parameter of BaseConnection to a
# concrete type, but the type it was bound to isn't important to us here.
ConnectionClass = TypeVar("ConnectionClass", bound=BaseConnection[Any])


# NOTE: Adding support for a new first party connection requires:
#   1. Adding the new connection name and class to this function.
#   2. Writing a new @overload signature mapping the connection's name to its class.
# TODO(vdonato): Some way to test that optional dependencies required by a connection
# don't cause `ModuleNotFoundError`s until the connection is actually instantiated.
def _get_first_party_connection(connection_name: str):
    FIRST_PARTY_CONNECTIONS = {"snowpark", "sql", "file"}

    if connection_name == "sql":
        return SQL
    elif connection_name == "snowpark":
        return Snowpark
    elif connection_name == "file":
        return File

    raise StreamlitAPIException(
        f"Invalid connection {connection_name}. Supported connection classes: {FIRST_PARTY_CONNECTIONS}"
    )


def _validate(conn: ConnectionClass) -> bool:
    return conn.is_connected()


@overload
def connection(
    connection_class: Literal["sql"], name: str = "default", **kwargs
) -> "SQL":
    ...


@overload
def connection(
    connection_class: Literal["snowpark"], name: str = "default", **kwargs
) -> "Snowpark":
    ...


@overload
def connection(
    connection_class: Literal["file"], name: str = "default", **kwargs
) -> "File":
    ...


@overload
def connection(
    connection_class: Type[ConnectionClass], name: str = "default", **kwargs
) -> ConnectionClass:
    ...


# TODO(vdonato): Write a docstring for this function.
# TODO(vdonato): Maybe support st.connection.sql() syntax as an alias for
#                st.connection("sql") if we decide we want to do that.
@gather_metrics("connection")
@cache_resource(validate=_validate)
def connection(connection_class, name="default", **kwargs):
    if type(connection_class) == str:
        connection_class = _get_first_party_connection(connection_class)

    try:
        return connection_class(
            connection_name=name,
            **kwargs,
        )
    except ModuleNotFoundError as e:
        # TODO(vdonato): Finalize what we want this error message to be. We just add
        # some generic text for now to demonstrate that we can add to the default
        # error message.
        raise ModuleNotFoundError(
            f"{str(e)}. You may need to install this package to use this connection."
        )
