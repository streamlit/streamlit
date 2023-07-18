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

import subprocess
import sys
import tempfile
import typing
from pathlib import Path

import jinja2

HOOKS_DIRECTORY = "hooks"

# For now, we only support one hook type because we don't need the others.
HOOK_FILE = "post_gen_project.py"


def _find_hook(template_directory_path: Path):
    """
    Find the hook file in the given template directory.

    Parameters
    ----------
    template_directory_path:
        The directory containing the template.

    Returns
    -------
        The path to the hook file if found, None otherwise.
    """
    current_hook_file = template_directory_path / HOOKS_DIRECTORY / HOOK_FILE
    if not current_hook_file.exists():
        return None
    return current_hook_file


def _render_and_run_script(
    current_hook_file: Path,
    target_directory_path: Path,
    template_context: typing.Dict[str, typing.Any],
):
    """
    Render and run the hook script.

    Parameters
    ----------
    current_hook_file:
        The path to the hook script file.
    target_directory_path:
        The target directory where the script will be run.
    template_context:
        The context for rendering the hook script.
    """
    hook_file_content = current_hook_file.read_text()
    env = jinja2.Environment(undefined=jinja2.StrictUndefined)
    rendered_hook_content = env.from_string(hook_file_content).render(template_context)
    with tempfile.TemporaryDirectory() as tmp_dir:
        rendered_hook_file = Path(tmp_dir) / HOOK_FILE
        rendered_hook_file.write_text(rendered_hook_content)
        subprocess.run(
            [sys.executable, str(rendered_hook_file)], cwd=str(target_directory_path)
        )


def run_hook(
    template_directory_path: Path,
    target_directory_path: Path,
    template_context: typing.Dict[str, typing.Any],
):
    """
    Run the hook script if it exists in the template directory.

    Parameters
    ----------
    template_directory_path:
        The directory containing the template.
    target_directory_path:
        The target directory where the script will be run.
    template_context:
        The context for rendering the hook script.
    """
    current_hook_file = _find_hook(template_directory_path)
    if not current_hook_file:
        return

    _render_and_run_script(current_hook_file, target_directory_path, template_context)
