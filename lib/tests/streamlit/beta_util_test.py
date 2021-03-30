# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import unittest
from unittest.mock import patch

from streamlit.beta_util import function_beta_warning, object_beta_warning


class BetaUtilTest(unittest.TestCase):
    @patch("streamlit.warning")
    def test_function_beta_warning(self, mock_warning):
        def multiply(a, b):
            return a * b

        beta_multiply = function_beta_warning(multiply, "1980-01-01")

        self.assertEqual(beta_multiply(3, 2), 6)
        mock_warning.assert_called_once_with(
            "`st.multiply` has graduated out of beta. On 1980-01-01, the beta_ version will be removed."
            "\n\nBefore then, update your code from `st.beta_multiply` to `st.multiply`."
        )

    @patch("streamlit.warning")
    def test_object_beta_warning(self, mock_warning):
        class Multiplier(dict):
            def multiply(self, a, b):
                return a * b

        beta_multiplier = object_beta_warning(Multiplier(), "multiplier", "1980-01-01")

        expected_warning = (
            "`st.multiplier` has graduated out of beta. On 1980-01-01, the beta_ version will be removed."
            "\n\nBefore then, update your code from `st.beta_multiplier` to `st.multiplier`."
        )

        mock_warning.reset_mock()
        self.assertEqual(beta_multiplier.multiply(3, 2), 6)
        mock_warning.assert_called_once_with(expected_warning)

        # Test that we also override various dunder methods.
        # Some of these end up emitting the warning multiple times.
        mock_warning.reset_mock()
        beta_multiplier["foo"] = "bar"
        mock_warning.assert_called_with(expected_warning)

        mock_warning.reset_mock()
        self.assertEqual(beta_multiplier["foo"], "bar")
        mock_warning.assert_called_with(expected_warning)

        mock_warning.reset_mock()
        self.assertEqual(len(beta_multiplier), 1)
        mock_warning.assert_called_with(expected_warning)

        mock_warning.reset_mock()
        self.assertEqual(list(beta_multiplier), ["foo"])
        mock_warning.assert_called_with(expected_warning)
