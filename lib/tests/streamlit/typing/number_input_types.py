# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import TYPE_CHECKING, Union

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are incorrect.
# Note: Due to https://mypy.readthedocs.io/en/latest/duck_type_compatibility.html, mypy will not detect
# an <int> value being assigned to a <float> variable. There's nothing we can do about this, apparently.
if TYPE_CHECKING:
    from streamlit.elements.widgets.number_input import NumberInputMixin

    number_input = NumberInputMixin().number_input

    # Check positional argument types
    assert_type(number_input("foo", 5), int)
    assert_type(number_input("foo", 5, 5), int)
    assert_type(number_input("foo", 5, 5, 5), int)
    assert_type(number_input("foo", 5, 5, 5, 1), int)
    assert_type(number_input("foo"), float)
    assert_type(number_input("foo", 5.0), float)
    assert_type(number_input("foo", 5.0, 6.0), float)
    assert_type(number_input("foo", 5.0, 6.0, 5.5), float)
    assert_type(number_input("foo", 5.0, 6.0, 5.5, 0.01), float)
    # The next tests would indicate we will return a float instead of raising an error, because mypy considers
    # int to be a subclass of float. This is unavoidable, and not a real issue because we don't expect people
    # who care about type checking their code to use more than one positional numerical argument anyways.
    # number_input("foo", 5, 5.0)
    # number_input("foo", 5.0, 5.0, 5)
    # number_input("foo", 5.0, 5.0, 5.0, 1)

    # Check keyword argument types
    assert_type(number_input("foo", min_value=1), int)
    assert_type(number_input("foo", max_value=1), int)
    assert_type(number_input("foo", value=1), int)
    assert_type(number_input("foo", step=1), int)
    assert_type(number_input("foo", step=1, value=5), int)
    assert_type(number_input("foo", step=1, value="min"), int)
    assert_type(number_input("foo", max_value=1, value=0), int)
    assert_type(number_input("foo", max_value=1, value="min"), int)
    assert_type(number_input("foo", min_value=1, value=2), int)
    assert_type(number_input("foo", min_value=1, value="min"), int)
    assert_type(number_input("foo", min_value=1.0), float)
    assert_type(number_input("foo", max_value=1.0), float)
    assert_type(number_input("foo", value=1.0), float)
    assert_type(number_input("foo", step=1.0), float)
    assert_type(number_input("foo", step=1.0, value=5.0), float)
    assert_type(number_input("foo", step=1.0, value="min"), float)
    assert_type(number_input("foo", max_value=1.0, value=0.0), float)
    assert_type(number_input("foo", max_value=1.0, value="min"), float)
    assert_type(number_input("foo", min_value=1.0, value=2.0), float)
    assert_type(number_input("foo", min_value=1.0, value="min"), float)
    # The next tests would indicate we will return a float instead of raising an error,
    # because mypy considers int to be a subclass of float. This is unavoidable.
    # number_input("foo", min_value=1, max_value=5.0)
    # number_input("foo", step=1, min_value=5.0)
    # number_input("foo", value="min", step=1, max_value=5.0)

    # Check value=none
    assert_type(number_input("foo", step=5, value=None), Union[int, None])
    assert_type(number_input("foo", min_value=5, value=None), Union[int, None])
    assert_type(number_input("foo", max_value=5, value=None), Union[int, None])
    assert_type(number_input("foo", value=None), Union[float, None])
    # Same deal about mixing and matching ints and floats applies here too.
    # number_input("foo", max_value=5, value=None, step=5.0)

    # Check "min" value
    assert_type(number_input("foo", value="min"), float)
