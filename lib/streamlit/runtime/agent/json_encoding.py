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

Widget values and dataframe cells are arbitrary Python objects, so the wire
form has to be pinned. These are the prototype's choices; the spec lists
settling them as a prerequisite for shipping v1.
"""

from __future__ import annotations

import datetime
import decimal
import enum
import math
from typing import Any

# ISO 8601, which is what the public API accepts back.
_DATE_FORMAT = "date"


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
        # Bytes are never app-authored meaning; report the size instead of
        # base64-inflating a model's context.
        return {"bytes": len(value)}

    if isinstance(value, enum.Enum):
        return to_json_value(value.value)

    if isinstance(value, decimal.Decimal):
        # Strings, because a float round-trip loses the precision that made
        # someone choose Decimal.
        return str(value)

    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    if isinstance(value, datetime.time):
        return value.isoformat()
    if isinstance(value, datetime.timedelta):
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

    # Protobuf repeated fields, pandas Index, and other sequences. Several of
    # these are not list subclasses and do not expose ``__iter__`` as an
    # attribute, so ask ``iter()`` rather than checking for one.
    try:
        items = list(value)
    except TypeError:
        return str(value)
    except Exception:
        return str(value)
    return [to_json_value(item) for item in items]
