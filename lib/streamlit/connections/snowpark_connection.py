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

import threading
from contextlib import contextmanager
from typing import TYPE_CHECKING, Iterator, cast

from streamlit.connections import BaseConnection
from streamlit.errors import StreamlitAPIException

if TYPE_CHECKING:
    from snowflake.snowpark.session import Session


REQUIRED_CONNECTION_PARAMS = {"account", "user", "password"}


class Snowpark(BaseConnection["Session"]):
    _default_connection_name = "snowpark"

    def __init__(self, connection_name: str = "default", **kwargs) -> None:
        self._lock = threading.RLock()
        self._closed = True

        # Grab the before calling BaseConnection.__init__() so that we can guarantee
        # thread safety when the parent class' constructor initializes our connection.
        with self._lock:
            super().__init__(connection_name, **kwargs)

    # TODO(vdonato): Teach the .connect() method how to automagically connect in a SiS
    # runtime environment.
    def connect(self, **kwargs) -> "Session":
        from snowflake.snowpark.session import Session

        self._closed = False
        conn_params = self.get_secrets()

        for p in REQUIRED_CONNECTION_PARAMS:
            if p not in conn_params:
                raise StreamlitAPIException(f"Missing Snowpark connection param: {p}")

        return cast(Session, Session.builder.configs(conn_params).create())

    def disconnect(self) -> None:
        with self._lock:
            self.instance.close()
            self._closed = True

    def is_connected(self) -> bool:
        # NOTE: Sessions communicate with Snowpark in a RESTful manner, meaning that we
        # can't know for sure whether a connection has timed out without using it to
        # attempt to send a request. Thus, we simply keep track of whether the user
        # has called .disconnect() for now.
        #
        # In the future, we may decide that we do want to send that test query each
        # time this method is called, but in doing so, we will be adding a small amount
        # of additional load to each script run.
        with self._lock:
            return not self._closed

    @contextmanager
    def session(self) -> Iterator["Session"]:
        with self._lock:
            yield self.instance
