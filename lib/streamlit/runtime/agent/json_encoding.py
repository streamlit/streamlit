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

"""JSON encodings for values that leave the app through the agent API.

Widget values and element props are arbitrary Python objects. This module pins
their JSON form. An object without an encoding becomes ``str(value)``, so one
odd cell does not fail the whole description.
"""

from __future__ import annotations

import datetime as dt
import decimal
import enum
import math
from typing import Any


def _is_pandas_missing(value: Any) -> bool:
    """True for the pandas missing scalars ``pd.NA`` and ``pd.NaT``."""
    type_name = type(value).__name__
    if type_name not in {"NAType", "NaTType"}:
        return False

    import pandas as pd

    return value is pd.NA or value is pd.NaT


def to_json_value(value: Any) -> Any:
    """Convert a Python value into its JSON representation.

    Anything without a defined encoding degrades to ``str`` rather than
    failing the whole snapshot: a single odd cell should not cost an agent the
    rest of the app.
    """
    if value is None or isinstance(value, (str, bool, int)):
        return value

    if isinstance(value, float):
        # JSON has no NaN or Infinity. Report them as null rather than emitting
        # invalid JSON or a string a client would have to sniff for.
        return value if math.isfinite(value) else None

    if isinstance(value, bytes):
        # Report the length. Base64 would spend the reader's context on bytes
        # the author did not write as text.
        return {"bytes": len(value)}

    if isinstance(value, enum.Enum):
        return to_json_value(value.value)

    if isinstance(value, decimal.Decimal):
        # Strings, because a float round-trip loses the precision that made
        # someone choose Decimal. Non-finite values are null, same as float
        # NaN and infinity: JSON has no other form for them.
        if not value.is_finite():
            return None
        return str(value)

    # pd.NaT subclasses datetime, so this identity check has to run before
    # isoformat(). pd.NA is not a float and would otherwise become "<NA>".
    # Identity only: pd.isna on an array returns an array and the truth test
    # raises.
    if _is_pandas_missing(value):
        return None

    # ISO 8601, which is also what the public API accepts back.
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, dt.timedelta):
        return value.total_seconds()

    if isinstance(value, dict):
        return {str(key): to_json_value(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set, frozenset)):
        return [to_json_value(item) for item in value]

    # numpy scalars and arrays.
    if hasattr(value, "tolist"):
        try:
            return to_json_value(value.tolist())
        except Exception:
            return str(value)

    # Protobuf repeated fields and other sequences that are not lists and do
    # not expose ``tolist``. Anything that cannot be listed is reported as text.
    try:
        items = list(value)
    except Exception:
        return str(value)
    return [to_json_value(item) for item in items]
