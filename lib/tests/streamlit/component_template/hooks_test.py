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

from streamlit.component_template.hooks import (
    _find_hook,
    _render_and_run_script,
    run_hook,
)

HOOK_FILE_CONTENT = (
    "from pathlib import Path\n"
    '(Path(".") / "gen-file.txt").write_text("{{ cookiecutter.first_name }}")'
)


class HookTests(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for testing
        tmp_dir = tempfile.TemporaryDirectory()
        tmp_dir_path = Path(tmp_dir.name)
        self.template_directory = tmp_dir_path / "source"
        self.template_directory.mkdir()
        self.target_directory = tmp_dir_path / "target"
        self.target_directory.mkdir()
        self.addCleanup(tmp_dir.cleanup)
        self.template_context = {"cookiecutter": {"first_name": "John"}}

    def test_find_hook_existing_hook(self):
        # Create a temporary hook file
        hook_file = self.template_directory / "hooks" / "post_gen_project.py"
        hook_file.parent.mkdir()
        hook_file.touch()

        found_hook = _find_hook(self.template_directory)

        self.assertEqual(found_hook, hook_file)

    def test_find_hook_no_hook(self):
        found_hook = _find_hook(self.template_directory)

        self.assertIsNone(found_hook)

    def test_render_and_run_script(self):
        # Create a temporary hook file
        hook_file = self.template_directory / "hooks" / "post_gen_project.py"
        hook_file.parent.mkdir()
        hook_file.write_text(HOOK_FILE_CONTENT)

        _render_and_run_script(hook_file, self.target_directory, self.template_context)

        # Verify that _render_and_run_script creates a new file
        generated_file = self.target_directory / "gen-file.txt"
        self.assertTrue(generated_file.exists())
        self.assertEqual(generated_file.read_text(), "John")

    def test_run_hook_existing_hook(self):
        # Create a temporary hook file
        hook_file = self.template_directory / "hooks" / "post_gen_project.py"
        hook_file.parent.mkdir()
        hook_file.write_text(HOOK_FILE_CONTENT)

        run_hook(self.template_directory, self.target_directory, self.template_context)

        # Verify that _render_and_run_script creates a new file
        self.assertTrue((self.target_directory / "gen-file.txt").exists())
