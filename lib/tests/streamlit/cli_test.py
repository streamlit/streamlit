# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

"""Unit tests for the streamlit CLI."""

import unittest

import mock

import streamlit
from streamlit import cli


class CliTest(unittest.TestCase):
    def test_running_in_streamlit(self):
        """Test that streamlit._running_in_streamlit is True after
        calling `streamlit run...`, and false otherwise.
        """
        self.assertFalse(streamlit._is_running_with_streamlit)

        with mock.patch('streamlit.cli.bootstrap.run') as p:
            cli._main_run('/not/a/file', None)
            p.assert_called_once()
            self.assertTrue(streamlit._is_running_with_streamlit)
