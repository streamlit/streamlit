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
import json
import os
import subprocess
from pathlib import Path

import click

from streamlit.component_template import hooks, node, template_config, template_renderer

TEMPLATE_URL = "https://github.com/streamlit/component-template/archive/refs/heads/cookiecutter.zip"
TEMPLATE_DIRECTORY = "cookiecutter"


def project_create(template_path: Path, no_interactive: bool):
    config_path = template_path / "cookiecutter.json"
    if not os.path.exists(config_path):
        raise click.BadParameter(f"The template does not contain a configuration file.")
    try:
        raw_config = json.loads(config_path.read_text())
    except IOError:
        raise click.BadParameter(f"Failed to read configuration file.")
    except json.JSONDecodeError:
        raise click.BadParameter(f"Failed to parse configuration file.")

    user_config = template_config.prepare_config(raw_config, no_interactive)

    node.check_node_requirements(raw_config)

    print("Generating project using template")
    template_context = {"cookiecutter": user_config}
    target_directory_path = Path(".")
    template_renderer.render_template(
        template_directory_path=template_path,
        target_directory_path=target_directory_path,
        template_context=template_context,
    )
    hooks.run_hook(
        template_directory_path=template_path,
        target_directory_path=target_directory_path,
        template_context=template_context,
    )

    print("Installing node dependencies")
    fronted_directory = next(target_directory_path.glob("**/package.json")).parent
    subprocess.run(["npm", "install"], cwd=fronted_directory, check=True)

    print("A new project has been created in the current directory")
    print("")
    package_dir = next(target_directory_path.glob("*/"))
    print("To starts development, open two terminal and run commands:")
    print("  Terminal 1: npm run start")
    print(f"  Terminal 2: streamlit run {package_dir}/__init__.py")
