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

from typing import TYPE_CHECKING, Any, Type, TypeVar, overload

from typing_extensions import Literal

from streamlit.connections.base_connection import BaseConnection
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cache_resource
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.connections.sql_connection import SQL

# The BaseConnection bound should be parameterized to `Any` below as subclasses of
# BaseConnection are responsible for binding the type parameter of BaseConnection to a
# concrete type, but the type it was bound to isn't important to us here.
ConnectionClass = TypeVar("ConnectionClass", bound=BaseConnection[Any])


# NOTE: Adding support for a new first party connection requires:
#   1. Adding the new connection name and class to this function.
#   2. Writing a new @overload signature mapping the connection's name to its class.
#
# Additionally, contributors should take care to avoid importing the new connection
# outside of `if TYPE_CHECKING` and `if connection_name == <new_connection>` blocks.
# This is because connection class implementations will frequently import packages that
# are not hard dependencies of Streamlit, so we want to avoid throwing ImportErrors
# when the user doesn't have these packages installed unless they're actually trying to
# use the associated connection.
def _get_first_party_connection(connection_name: str):
    FIRST_PARTY_CONNECTIONS = {"sql"}

    if connection_name == "sql":
        from streamlit.connections.sql_connection import SQL

        return SQL

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

    return connection_class(
        connection_name=name,
        **kwargs,
    )
