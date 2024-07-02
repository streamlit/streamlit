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

import pytest

from streamlit.elements.lib.options_selector_utils import (
    check_and_convert_to_indices,
    ensure_indexable_and_comparable,
    get_default_indices,
)
from streamlit.errors import StreamlitAPIException
import numpy as np


class TestCheckAndConvertToIndices:
    def test_check_and_convert_to_indices_none_default(self):
        res = check_and_convert_to_indices(["a"], None)
        assert res == None

    def test_check_and_convert_to_indices_single_default(self):
        res = check_and_convert_to_indices(["a", "b"], "a")
        assert res == [0]

    def test_check_and_convert_to_indices_default_is_numpy_array(self):
        res = check_and_convert_to_indices(["a", "b"], np.array(["b"]))
        assert res == [1]

    def test_check_and_convert_to_indices_default_is_tuple(self):
        res = check_and_convert_to_indices(["a", "b"], ("b",))
        assert res == [1]

    def test_check_and_convert_to_indices_default_is_set(self):
        res = check_and_convert_to_indices(
            ["a", "b"],
            set(
                "b",
            ),
        )
        assert res == [1]

    def test_check_and_convert_to_indices_default_not_in_opts(self):
        with pytest.raises(StreamlitAPIException):
            check_and_convert_to_indices(["a", "b"], "c")


class TestTransformOptions:
    def test_transform_options(self):
        options = ["a", "b", "c"]

        indexable_options = ensure_indexable_and_comparable(options)
        formatted_options = [f"transformed_{option}" for option in indexable_options]
        default_indices = get_default_indices(indexable_options, "b")

        assert indexable_options == options
        for option in options:
            assert f"transformed_{option}" in formatted_options

        assert default_indices == [1]

    def test_transform_options_default_format_func(self):
        options = [5, 6, 7]

        indexable_options = ensure_indexable_and_comparable(options)
        formatted_options = [str(option) for option in indexable_options]
        default_indices = get_default_indices(indexable_options, 7)

        assert indexable_options == options
        for option in options:
            assert f"{option}" in formatted_options

        assert default_indices == [2]
