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

import re
from typing import Any, Dict, Type, TypeVar, overload

from typing_extensions import Final, Literal

from streamlit.connections.base_connection import BaseConnection
from streamlit.connections.file_connection import FileSystem
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
    FIRST_PARTY_CONNECTIONS = {"snowpark", "sql", "files", "s3", "gcs"}

    if connection_name == "sql":
        return SQL
    elif connection_name == "snowpark":
        return Snowpark
    elif connection_name == "files":
        return FileSystem
    elif connection_name == "s3":
        return FileSystem
    elif connection_name == "gcs":
        return FileSystem

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
    connection_class: Literal["files"], name: str = "default", **kwargs
) -> "FileSystem":
    ...


@overload
def connection(
    connection_class: Literal["s3"], name: str = "default", **kwargs
) -> "FileSystem":
    ...


@overload
def connection(
    connection_class: Literal["gcs"], name: str = "default", **kwargs
) -> "FileSystem":
    ...


@overload
def connection(
    connection_class: Type[ConnectionClass], name: str = "default", **kwargs
) -> ConnectionClass:
    ...


MODULE_EXTRACTION_REGEX = re.compile(r"No module named \'(.+)\'")
MODULES_TO_PYPI_PACKAGES: Final[Dict[str, str]] = {
    "fsspec": "fsspec",
    "sqlalchemy": "sqlalchemy",
    "snowflake.snowpark": "snowflake-snowpark-python",
}


# TODO(vdonato): Write a docstring for this function.
# TODO(vdonato): Maybe support st.connection.sql() syntax as an alias for
#                st.connection("sql") if we decide we want to do that.
@gather_metrics("connection")
@cache_resource(validate=_validate)
def connection(connection_class, name="default", **kwargs):
    if type(connection_class) == str:
        if connection_class == "s3":
            kwargs["protocol"] = kwargs.get("protocol", "s3")
            if name == "default":
                name = "s3"
        if connection_class == "gcs":
            kwargs["protocol"] = kwargs.get("protocol", "gcs")
            if name == "default":
                name = "gcs"
        connection_class = _get_first_party_connection(connection_class)

    try:
        return connection_class(
            connection_name=name,
            **kwargs,
        )
    except ModuleNotFoundError as e:
        err_string = str(e)
        missing_module = re.search(MODULE_EXTRACTION_REGEX, err_string)

        extra_info = "You may be missing a dependency required to use this connection."
        if missing_module:
            pypi_package = MODULES_TO_PYPI_PACKAGES.get(missing_module.group(1))
            if pypi_package:
                extra_info = f"You need to install the '{pypi_package}' package to use this connection."

        # TODO(vdonato): Finalize this error message.
        raise ModuleNotFoundError(f"{str(e)}. {extra_info}")
