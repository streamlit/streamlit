# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_UPDATE_NAME_SCRIPT = _REPO_ROOT / "scripts" / "update_name.py"

_DEFAULT_LIB_PYPROJECT = """\
[project]
name = "streamlit"

[project.optional-dependencies]
all = [
  "streamlit[auth,charts,snowflake,sql,pdf,performance]",
]
"""


def _prepare_repo(
    tmp_path: Path,
    *,
    root_pyproject: str,
    lib_pyproject: str = _DEFAULT_LIB_PYPROJECT,
) -> Path:
    """Create a minimal repo tree for the rename script and return its path.

    The tree mirrors the parts of the real repo that ``update_name.py`` touches:
    the root ``pyproject.toml``, ``lib/pyproject.toml``, and
    ``lib/streamlit/version.py``.
    """
    script_file = tmp_path / "scripts" / "update_name.py"
    script_file.parent.mkdir()
    shutil.copyfile(_UPDATE_NAME_SCRIPT, script_file)

    (tmp_path / "pyproject.toml").write_text(root_pyproject, encoding="utf-8")

    streamlit_dir = tmp_path / "lib" / "streamlit"
    streamlit_dir.mkdir(parents=True)
    (tmp_path / "lib" / "pyproject.toml").write_text(lib_pyproject, encoding="utf-8")
    (streamlit_dir / "version.py").write_text(
        'STREAMLIT_VERSION_STRING = _version("streamlit")\n',
        encoding="utf-8",
    )

    return script_file


def test_update_name_updates_all_package_references(tmp_path: Path) -> None:
    """The nightly rename updates package anchors and all self-references."""
    # The integration group intentionally omits the trailing comma to exercise
    # the optional-comma branch of the substitution regex.
    script_file = _prepare_repo(
        tmp_path,
        root_pyproject="""\
[project]
dependencies = ["streamlit"]

[tool.uv.sources]
streamlit = { path = "lib", editable = true }

[dependency-groups]
test = [
  "streamlit[auth,charts,pdf,performance]",
]
integration = [
  "streamlit[snowflake]"
]
# Keep comments mentioning "streamlit[all]" unchanged.
""",
    )

    subprocess.run(
        [sys.executable, str(script_file), "streamlit-nightly"],
        check=True,
    )

    assert (
        (tmp_path / "pyproject.toml").read_text(encoding="utf-8")
        == """\
[project]
dependencies = ["streamlit-nightly"]

[tool.uv.sources]
streamlit-nightly = { path = "lib", editable = true }

[dependency-groups]
test = [
  "streamlit-nightly[auth,charts,pdf,performance]",
]
integration = [
  "streamlit-nightly[snowflake]"
]
# Keep comments mentioning "streamlit[all]" unchanged.
"""
    )
    assert (
        (tmp_path / "lib" / "pyproject.toml").read_text(encoding="utf-8")
        == """\
[project]
name = "streamlit-nightly"

[project.optional-dependencies]
all = [
  "streamlit-nightly[auth,charts,snowflake,sql,pdf,performance]",
]
"""
    )
    assert (tmp_path / "lib" / "streamlit" / "version.py").read_text(
        encoding="utf-8"
    ) == 'STREAMLIT_VERSION_STRING = _version("streamlit-nightly")\n'


def test_update_name_fails_on_unrenamable_self_reference(tmp_path: Path) -> None:
    """A self-reference the rename regex can't match aborts the script.

    Guards against silently shipping a stale reference to the old package name
    when a self-reference is written in a form (e.g. with a version constraint)
    that the substitution regex does not cover.
    """
    script_file = _prepare_repo(
        tmp_path,
        root_pyproject="""\
[project]
dependencies = ["streamlit"]

[tool.uv.sources]
streamlit = { path = "lib", editable = true }

[dependency-groups]
test = [
  "streamlit[auth,charts,pdf,performance]",
  "streamlit[snowflake]>=1.0.0",
]
""",
    )

    result = subprocess.run(
        [sys.executable, str(script_file), "streamlit-nightly"],
        capture_output=True,
        check=False,
    )

    assert result.returncode != 0
    assert b"self-reference" in result.stderr


def test_update_name_renames_actual_repo_files(tmp_path: Path) -> None:
    """Renaming the real repo files leaves no stale ``streamlit[...]`` references.

    Runs the script against copies of the actual ``pyproject.toml`` and
    ``lib/pyproject.toml`` so drift in their real formatting is caught here
    rather than only surfacing in the nightly build.
    """
    script_file = tmp_path / "scripts" / "update_name.py"
    script_file.parent.mkdir()
    shutil.copyfile(_UPDATE_NAME_SCRIPT, script_file)

    streamlit_dir = tmp_path / "lib" / "streamlit"
    streamlit_dir.mkdir(parents=True)
    shutil.copyfile(_REPO_ROOT / "pyproject.toml", tmp_path / "pyproject.toml")
    shutil.copyfile(
        _REPO_ROOT / "lib" / "pyproject.toml", tmp_path / "lib" / "pyproject.toml"
    )
    shutil.copyfile(
        _REPO_ROOT / "lib" / "streamlit" / "version.py", streamlit_dir / "version.py"
    )

    subprocess.run(
        [sys.executable, str(script_file), "streamlit-nightly"],
        check=True,
    )

    root_text = (tmp_path / "pyproject.toml").read_text(encoding="utf-8")
    lib_text = (tmp_path / "lib" / "pyproject.toml").read_text(encoding="utf-8")
    assert '"streamlit[' not in root_text
    assert '"streamlit[' not in lib_text
    assert '"streamlit-nightly[' in root_text
    assert '"streamlit-nightly[' in lib_text
