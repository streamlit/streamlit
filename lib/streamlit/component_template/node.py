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

import shutil
import subprocess
import typing

import packaging.version


def _version_str_to_obj(version_str) -> packaging.version.Version:
    return packaging.version.Version(version_str)


def check_node_requirements(template_config: typing.Dict):
    """Checks if the installed Node.js version meets the template's Node.js requirements.

    Parameters
    ----------
    template_config : typing.Dict
        The configuration dictionary of the template.

    Raises
    ------
    RuntimeError
        If the installed Node.js version is outside the supported boundaries.

    """
    local_node_version = _get_installed_node_version()
    min_node_version, max_node_version = _get_supported_node_boundaries(template_config)
    if min_node_version:
        if local_node_version < min_node_version:
            raise RuntimeError(
                f"Node version too old. Current version: {local_node_version}. Max supported version: {min_node_version}."
            )
    if max_node_version:
        if local_node_version > max_node_version:
            raise RuntimeError(
                f"Node version too newer. Current version: {local_node_version}. Max supported version: {max_node_version}."
            )


def _get_supported_node_boundaries(
    template_config: typing.Dict,
) -> typing.Tuple[
    typing.Optional[packaging.version.Version],
    typing.Optional[packaging.version.Version],
]:
    """Retrieve the minimum and maximum supported Node.js versions from the template configuration.

    Parameters
    ----------
    template_config : typing.Dict
        The configuration dictionary of the template.

    Returns
    -------
    Tuple[Optional[packaging.version.Version], Optional[packaging.version.Version]]
        A tuple containing the minimum and maximum supported Node.js versions.

    """
    requirements = template_config.get("__requirements__")
    if not requirements:
        return None, None
    node_requirements = requirements.get("node")
    if not node_requirements:
        return None, None
    min_node_version = node_requirements.get("min")
    max_node_version = node_requirements.get("max")
    min_node_version_obj = (
        _version_str_to_obj(min_node_version) if min_node_version else None
    )
    max_node_version_obj = (
        _version_str_to_obj(max_node_version) if max_node_version else None
    )
    return min_node_version_obj, max_node_version_obj


def _get_installed_node_version() -> packaging.version.Version:
    """Return the node version installed on the device.

    Returns
    -------
    str
        The version string specified in setup.py.

    """
    local_node_version = (
        subprocess.check_output(["node", "--version"]).strip().decode().lstrip("v")
    )
    return _version_str_to_obj(local_node_version)


def is_node_installed():
    """Checks if node is installed on the device."""
    return shutil.which("node") is None
