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

"""Type tests for st.connection.

Overloads distinguish first-party names and type strings (SQLConnection,
SnowflakeConnection, SnowflakeCallersRightsConnection), an explicit
connection class, and the BaseConnection[Any] fallback.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

if TYPE_CHECKING:
    from datetime import timedelta
    from typing import Any, Literal

    from streamlit.connections import (
        BaseConnection,
        SnowflakeCallersRightsConnection,
        SnowflakeConnection,
        SQLConnection,
    )
    from streamlit.runtime.connection_factory import connection_factory as connection

    class _CustomConnection(BaseConnection[object]):
        def _connect(self, **kwargs: Any) -> object:
            return object()

    # =====================================================================
    # First-party name inference
    # =====================================================================

    # Name "sql", "snowflake", or "snowflake-callers-rights" infers the class.
    assert_type(connection("sql"), SQLConnection)
    assert_type(connection("snowflake"), SnowflakeConnection)
    assert_type(
        connection("snowflake-callers-rights"), SnowflakeCallersRightsConnection
    )

    # A non-literal name cannot be inferred and falls back to BaseConnection.
    custom_name: str = "pets"
    assert_type(connection(custom_name), BaseConnection[Any])

    sql_name: Literal["sql"] = "sql"
    assert_type(connection(sql_name), SQLConnection)

    def first_party_name() -> Literal["sql", "snowflake"]:
        return "sql"

    # A union of first-party name literals matches the fallback `str` overload,
    # so the inferred type is BaseConnection[Any]. mypy does not split the union
    # across the name-only overloads once that `str` overload matches.
    assert_type(connection(first_party_name()), BaseConnection[Any])

    # =====================================================================
    # Explicit first-party type (keyword or positional)
    # =====================================================================

    assert_type(connection("pets", type="sql"), SQLConnection)
    assert_type(connection("pets", "sql"), SQLConnection)
    assert_type(connection("sql", type="sql"), SQLConnection)
    assert_type(connection("sql", type=None), SQLConnection)

    assert_type(connection("warehouse", type="snowflake"), SnowflakeConnection)
    assert_type(connection("warehouse", "snowflake"), SnowflakeConnection)
    assert_type(connection("snowflake", type="snowflake"), SnowflakeConnection)

    assert_type(
        connection("viewer", type="snowflake-callers-rights"),
        SnowflakeCallersRightsConnection,
    )
    assert_type(
        connection("viewer", "snowflake-callers-rights"),
        SnowflakeCallersRightsConnection,
    )
    assert_type(
        connection("snowflake-callers-rights", type="snowflake-callers-rights"),
        SnowflakeCallersRightsConnection,
    )

    # An explicit type wins over a first-party name.
    assert_type(connection("sql", type="snowflake"), SnowflakeConnection)
    assert_type(connection("sql", "snowflake"), SnowflakeConnection)
    assert_type(connection("snowflake", type="sql"), SQLConnection)

    sql_type: Literal["sql"] = "sql"
    assert_type(connection("pets", type=sql_type), SQLConnection)

    def first_party_type() -> Literal["sql", "snowflake"]:
        return "sql"

    # A union of first-party type literals matches the str overload, so the
    # inferred type is BaseConnection[Any].
    assert_type(connection("pets", type=first_party_type()), BaseConnection[Any])

    # A non-literal type string cannot be narrowed.
    dynamic_type: str = "my.custom.Connection"
    assert_type(connection("pets", type=dynamic_type), BaseConnection[Any])

    # A dotted import path is a plain str, so the class cannot be inferred.
    assert_type(
        connection("pets", type="streamlit.connections.SQLConnection"),
        BaseConnection[Any],
    )

    # =====================================================================
    # Explicit connection class
    # =====================================================================

    assert_type(connection("pets", type=SQLConnection), SQLConnection)
    assert_type(connection("pets", SQLConnection), SQLConnection)
    assert_type(connection("warehouse", type=SnowflakeConnection), SnowflakeConnection)
    assert_type(
        connection("viewer", type=SnowflakeCallersRightsConnection),
        SnowflakeCallersRightsConnection,
    )
    assert_type(connection("custom", type=_CustomConnection), _CustomConnection)
    assert_type(connection("custom", _CustomConnection), _CustomConnection)

    # A first-party name plus an explicit class uses the class.
    assert_type(connection("sql", type=SnowflakeConnection), SnowflakeConnection)

    # =====================================================================
    # max_entries, ttl, autocommit, and connection kwargs
    # =====================================================================

    # `max_entries` accepts `int` or `None`.
    assert_type(connection("sql", max_entries=10), SQLConnection)
    assert_type(connection("sql", max_entries=None), SQLConnection)
    assert_type(connection("pets", type="sql", max_entries=4), SQLConnection)
    assert_type(connection("pets", "sql", 4), SQLConnection)

    # `ttl` accepts `float`, `timedelta`, or `None` (`int` is compatible with `float`).
    assert_type(connection("sql", ttl=60.0), SQLConnection)
    assert_type(connection("sql", ttl=60), SQLConnection)
    assert_type(connection("sql", ttl=timedelta(minutes=5)), SQLConnection)
    assert_type(connection("sql", ttl=None), SQLConnection)
    assert_type(
        connection("pets", type="sql", ttl=timedelta(seconds=30)), SQLConnection
    )
    assert_type(connection("pets", "sql", 4, 60.0), SQLConnection)

    # First-party overloads accept autocommit and still return the concrete class.
    assert_type(connection("sql", autocommit=True), SQLConnection)
    assert_type(connection("sql", autocommit=False), SQLConnection)
    assert_type(connection("pets", type="sql", autocommit=True), SQLConnection)

    # Extra connection keywords are accepted and do not change the inferred class.
    assert_type(connection("sql", url="sqlite://"), SQLConnection)
    assert_type(connection("pets", type="sql", dialect="sqlite"), SQLConnection)

    # The `env:` prefix is a runtime name lookup; the type cannot be inferred.
    assert_type(connection("env:MY_SQL_CONN"), BaseConnection[Any])

    # =====================================================================
    # All parameters combined
    # =====================================================================

    assert_type(
        connection(
            "analytics",
            type="sql",
            max_entries=8,
            ttl=timedelta(seconds=30),
            autocommit=True,
            url="sqlite://",
        ),
        SQLConnection,
    )
    assert_type(
        connection(
            "warehouse",
            type=SnowflakeConnection,
            max_entries=None,
            ttl=60.0,
            account="example",
        ),
        SnowflakeConnection,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # `name` is required.
    connection()  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # `name` does not accept an `int`.
    connection(123)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # `name` does not accept `None`.
    connection(None)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # `type` does not accept an `int` (must be a first-party literal, class, or str).
    connection("pets", type=123)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # `type` does not accept a non-connection class.
    connection("pets", type=int)  # type: ignore[type-var]  # ty: ignore[no-matching-overload]

    # A second positional is `type`, not `max_entries`.
    connection("sql", 10)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # `type` cannot be passed both positionally and as a keyword.
    connection("sql", "sql", type="snowflake")  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # `max_entries` does not accept a `str`.
    connection("sql", max_entries="10")  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # `ttl` does not accept a list.
    connection("sql", ttl=[60])  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]

    # `autocommit` is keyword-only (runtime only accepts four positionals).
    connection("sql", "sql", 1, 30.0, True)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]
