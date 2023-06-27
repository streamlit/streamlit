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

import os
import typing
from pathlib import Path

import jinja2


def render_template(
    template_directory_path: Path,
    target_directory_path: Path,
    template_context: typing.Dict,
):
    """Render a template directory and copy it to the target directory.

    Parameters
    ----------
    template_directory_path : Path
        The path to the template directory.
    target_directory_path : Path
        The path to the target directory.
    template_context : typing.Dict
        The dictionary containing the template context.

    """
    env = jinja2.Environment(undefined=jinja2.StrictUndefined)
    template_dir = str(template_directory_path)
    target_dir = str(target_directory_path)

    for root, dirs, files in os.walk(template_dir, topdown=True):
        for name in dirs:
            abs_target_dir = prepare_target_path(
                env,
                src_path=os.path.join(root, name),
                template_dir=template_dir,
                target_dir=target_dir,
                template_context=template_context,
            )
            os.mkdir(abs_target_dir)

        for name in files:
            src_path = os.path.join(root, name)
            abs_target_file = prepare_target_path(
                env,
                src_path=src_path,
                template_dir=template_dir,
                target_dir=target_dir,
                template_context=template_context,
            )
            template_content = env.from_string(Path(src_path).read_text()).render(
                template_context
            )
            Path(abs_target_file).write_text(template_content)


def prepare_target_path(
    env: jinja2.Environment,
    src_path: str,
    template_dir: str,
    target_dir: str,
    template_context: typing.Dict,
):
    """Prepare the target path by applying Jinja2 rendering.

    Parameters
    ----------
    env : jinja2.Environment
        The Jinja2 environment.
    src_path : str
        The source path.
    template_dir : str
        The template directory path.
    target_dir : str
        The target directory path.
    template_context : typing.Dict
        The dictionary containing the template context.

    Returns
    -------
    str
        The prepared absolute target path.
    """
    rel_src_dir = os.path.relpath(src_path, template_dir)
    rel_target_dir = env.from_string(rel_src_dir).render(template_context)
    abs_target_dir = os.path.join(target_dir, rel_target_dir)
    return abs_target_dir
