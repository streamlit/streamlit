# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import unittest

import pytest

from streamlit.elements.iframe import marshall
from streamlit.errors import StreamlitAPIException
from streamlit.proto.IFrame_pb2 import IFrame as IFrameProto


class IFrameTest(unittest.TestCase):
    def test_marshall_with_valid_tab_index_values(self):
        """Test that valid tab_index values are correctly marshalled."""
        test_cases = [None, -1, 0, 1, 100]

        for tab_index in test_cases:
            proto = IFrameProto()
            marshall(proto, src="https://example.com", tab_index=tab_index)

            if tab_index is not None:
                assert proto.tab_index == tab_index

    def test_marshall_with_invalid_tab_index_type(self):
        """Test that invalid tab_index types raise StreamlitAPIException."""
        invalid_values = ["0", 1.5, True, [], {}]

        for invalid_value in invalid_values:
            proto = IFrameProto()
            with pytest.raises(StreamlitAPIException):
                marshall(proto, src="https://example.com", tab_index=invalid_value)

    def test_marshall_with_invalid_tab_index_value(self):
        """Test that invalid tab_index values raise StreamlitAPIException."""
        invalid_values = [-2, -100]

        for invalid_value in invalid_values:
            proto = IFrameProto()
            with pytest.raises(StreamlitAPIException):
                marshall(proto, src="https://example.com", tab_index=invalid_value)
