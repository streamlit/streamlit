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

from typing_extensions import Final

from streamlit.connections.base_connection import BaseConnection
from streamlit.runtime.caching import cache_resource
from streamlit.runtime.metrics_util import gather_metrics

MODULE_EXTRACTION_REGEX = re.compile(r"No module named \'(.+)\'")
MODULES_TO_PYPI_PACKAGES: Final[Dict[str, str]] = {
    "sqlalchemy": "sqlalchemy",
    "snowflake.snowpark": "snowflake-snowpark-python",
}

# The BaseConnection bound is parameterized to `Any` below as subclasses of
# BaseConnection are responsible for binding the type parameter of BaseConnection to a
# concrete type, but the type it gets bound to isn't important to us here.
ConnectionClass = TypeVar("ConnectionClass", bound=BaseConnection[Any])


# NOTE: The order of the decorators below is important: @gather_metrics must be above
# @cache_resource so that it is called even if the return value of _create_connection
# is cached.
@gather_metrics("experimental_connection")
@cache_resource
def _create_connection(
    connection_class: Type[ConnectionClass], name: str = "default", **kwargs
) -> ConnectionClass:
    """Create an instance of connection_class with the given name and kwargs.

    This function is useful because it allows us to @gather_metrics at a point where
    connection_class must be a concrete type. The public-facing connection API allows
    the user to specify the connection class to use as a string literal for convenience.
    """
    return connection_class(
        connection_name=name,
        **kwargs,
    )


@overload  # type: ignore
def connection_factory(
    connection_class: Type[ConnectionClass], name: str = "default", **kwargs
) -> ConnectionClass:
    pass


def connection_factory(connection_class, name="default", **kwargs):
    """TODO(vdonato): Write a docstring (maybe with the help of the documentation team).

    The docstring should describe:
      * Using st.connection with one of our first party connections by passing a string
        literal as the connection_class.
      * Plugging your own ConnectionClass into st.experimental_connection.
    """
    try:
        return _create_connection(connection_class, name=name, **kwargs)
    except ModuleNotFoundError as e:
        err_string = str(e)
        missing_module = re.search(MODULE_EXTRACTION_REGEX, err_string)

        # TODO(vdonato): Finalize these error messages.
        extra_info = "You may be missing a dependency required to use this connection."
        if missing_module:
            pypi_package = MODULES_TO_PYPI_PACKAGES.get(missing_module.group(1))
            if pypi_package:
                extra_info = f"You need to install the '{pypi_package}' package to use this connection."

        raise ModuleNotFoundError(f"{str(e)}. {extra_info}")
