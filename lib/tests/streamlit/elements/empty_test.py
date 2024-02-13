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

import streamlit as st
from streamlit.proto.Empty_pb2 import Empty as EmptyProto
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StEmptyAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_st_empty(self):
        """Test st.empty."""
        st.empty()

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.empty, EmptyProto())


class StSkeletonAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_st_skeleton_noargs(self):
        """Test st.skeleton."""
        st.skeleton()

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.skeleton, SkeletonProto())

    def test_st_skeleton_args(self):
        """Test st.skeleton with arguments."""
        st.skeleton(height=5, width=0.2)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.skeleton, SkeletonProto(height=5, width=0.2))

    def test_st_skeleton_exceptions(self):
        """Test st.skeleton validation exceptions."""

        expected_msg = "Skeleton height must be a positive integer."
        for test_height in (0, -1):
            with self.assertRaises(ValueError, msg=expected_msg):
                st.skeleton(height=test_height)

        expected_msg = "Skeleton width must be a value 0 < width <= 1."
        for test_width in (0, -1, 1.5):
            with self.assertRaises(ValueError, msg=expected_msg):
                st.skeleton(width=test_width)

        expected_msg = (
            "Cannot set Skeleton.height to 1.5: 1.5 has type <class 'float'>, "
            "but expected one of: (<class 'int'>,)",
        )
        with self.assertRaises(TypeError, msg=expected_msg):
            st.skeleton(height=1.5)
