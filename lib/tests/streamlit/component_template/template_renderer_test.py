# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import tempfile
import unittest
from pathlib import Path

from streamlit.component_template import template_renderer
from tests.testutil import list_files_and_directories


class ComponentConfigTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp_dir = tempfile.TemporaryDirectory()
        tmp_dir_path = Path(tmp_dir.name)
        self.source_directory = tmp_dir_path / "source"
        self.source_directory.mkdir()
        self.target_directory = tmp_dir_path / "target"
        self.target_directory.mkdir()
        self.addCleanup(tmp_dir.cleanup)

        self.template_context = {"cookiecutter": {"first_name": "John"}}
        (self.source_directory / "{{ cookiecutter.first_name }}").mkdir()

    def test_empty_template_directory(self):
        template_renderer.render_template(
            self.source_directory,
            self.target_directory,
            template_context=self.template_context,
        )
        self.assertEqual([], list_files_and_directories(self.target_directory))

    def test_plain_file(self):
        (
            self.source_directory / "{{ cookiecutter.first_name }}" / "test-file.txt"
        ).write_text("Test-file")

        template_renderer.render_template(
            self.source_directory,
            self.target_directory,
            template_context=self.template_context,
        )
        self.assertEqual(
            ["test-file.txt"], list_files_and_directories(self.target_directory)
        )

    def test_templated_file(self):
        (
            self.source_directory / "{{ cookiecutter.first_name }}" / "test-file.txt"
        ).write_text("First name: {{ cookiecutter.first_name }}")

        template_renderer.render_template(
            self.source_directory,
            self.target_directory,
            template_context=self.template_context,
        )

        self.assertEqual(
            ["test-file.txt"], list_files_and_directories(self.target_directory)
        )
        self.assertEqual(
            "First name: John", (self.target_directory / "test-file.txt").read_text()
        )

    def test_templated_file_name(self):
        (
            self.source_directory
            / "{{ cookiecutter.first_name }}"
            / "{{ cookiecutter.first_name }}.txt"
        ).write_text("Test-file")

        template_renderer.render_template(
            self.source_directory,
            self.target_directory,
            template_context=self.template_context,
        )

        self.assertEqual(
            ["John.txt"], list_files_and_directories(self.target_directory)
        )

    def test_nested_file(self):
        nested_path = (
            self.source_directory
            / "{{ cookiecutter.first_name }}"
            / "subdir1"
            / "{{ cookiecutter.first_name }}"
        )
        nested_path.mkdir(parents=True)
        (nested_path / "{{ cookiecutter.last_name }}.txt").write_text("Test-file")

        template_renderer.render_template(
            self.source_directory,
            self.target_directory,
            template_context={
                "cookiecutter": {"first_name": "John", "last_name": "Smith"}
            },
        )

        self.assertEqual(
            ["subdir1", "subdir1/John", "subdir1/John/Smith.txt"],
            list_files_and_directories(self.target_directory),
        )
