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

from __future__ import annotations

import pytest

from streamlit.elements.lib.js_number import JSNumber, JSNumberBoundsException


def test_validate_int_bounds_default_value_name() -> None:
    """Test validate_int_bounds uses 'value' when value_name is None."""
    with pytest.raises(JSNumberBoundsException, match="value"):
        JSNumber.validate_int_bounds(JSNumber.MAX_SAFE_INTEGER + 1, value_name=None)


def test_validate_float_bounds_default_value_name() -> None:
    """Test validate_float_bounds uses 'value' when value_name is None."""
    with pytest.raises(JSNumberBoundsException, match="value"):
        JSNumber.validate_float_bounds(JSNumber.MAX_VALUE * 2, value_name=None)


def test_validate_float_bounds_non_numeric_type() -> None:
    """Test validate_float_bounds raises for non-numeric type."""
    with pytest.raises(JSNumberBoundsException, match="is not a float"):
        JSNumber.validate_float_bounds("not_a_number", value_name="test_val")  # type: ignore[arg-type]
