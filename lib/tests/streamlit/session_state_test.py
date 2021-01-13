# Copyright 2018-2020 Streamlit Inc.
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

import pytest
import unittest
from unittest.mock import patch, Mock
from streamlit.report_session import ReportSession
from streamlit.session_state import SessionState, get_session_state, get_current_session


class SessionStateTest(unittest.TestCase):
    def test_SessionState_initialization(self):
        """Tests the Session State class sets the default values"""
        state = SessionState(foo=1, bar="string")

        self.assertEqual(state.foo, 1)
        self.assertEqual(state.bar, "string")
