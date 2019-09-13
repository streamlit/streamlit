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

"""Unit tests for the cli."""

import unittest
from unittest.mock import MagicMock, Mock, patch
from click.testing import CliRunner

import requests
import requests_mock

from streamlit import cli


class CliTest(unittest.TestCase):
    """Unit tests for the cli."""

    def setUp(self):
        cli.name = "test"
        self.runner = CliRunner()

    def test_run_no_arguments(self):
        """streamlit run should fail if run with no arguments"""
        result = self.runner.invoke(cli, ["run"])
        self.assertNotEqual(0, result.exit_code)

    def test_run_existing_file_argument(self):
        """streamlit run succeeds if an existing file is passed"""
        # Mocking _main_run
        cli._main_run = MagicMock()

        with patch("validators.url", return_value=False):
            with patch("os.path.exists", return_value=True):
                result = self.runner.invoke(cli, ["run", "file_name"])
        self.assertEqual(0, result.exit_code)

    def test_run_non_existing_file_argument(self):
        """streamlit run should fail if a non existing file is passed"""
        # Mocking _main_run
        cli._main_run = MagicMock()

        with patch("validators.url", return_value=False):
            with patch("os.path.exists", return_value=False):
                result = self.runner.invoke(cli, ["run", "file_name"])
        self.assertNotEqual(0, result.exit_code)
        self.assertTrue("File does not exist" in result.output)

    def test_run_valid_url(self):
        """streamlit run succeeds if an existing url is passed"""
        # Mocking _main_run
        cli._main_run = MagicMock()

        with patch("validators.url", return_value=True):
            with requests_mock.mock() as m:
                m.get("http://url", content=b"content")
                with patch("tempfile.NamedTemporaryFile"):
                    result = self.runner.invoke(cli, ["run", "http://url"])

        self.assertEqual(0, result.exit_code)

    def test_run_non_existing_url(self):
        """streamlit run should fail if a non existing but valid
         url is passed
         """
        # Mocking _main_run
        cli._main_run = MagicMock()

        with patch("validators.url", return_value=True):
            with requests_mock.mock() as m:
                m.get("http://url", exc=requests.exceptions.RequestException)
                with patch("tempfile.NamedTemporaryFile"):
                    result = self.runner.invoke(cli, ["run", "http://url"])

        self.assertNotEqual(0, result.exit_code)
        self.assertTrue("Unable to fetch" in result.output)
