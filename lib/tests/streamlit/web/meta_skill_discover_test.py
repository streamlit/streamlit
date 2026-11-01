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

"""Tests for the meta-skill's standalone ``scripts/discover.py``.

The script runs on users' machines without Streamlit, so these tests must not
import Streamlit either: the Windows and macOS CI jobs run this file with only
pytest installed. Set ``DISCOVER_TEST_PYTHON`` to launch the script with another
interpreter, such as an old system Python.
"""

from __future__ import annotations

import ast
import importlib.util
import os
import subprocess
import sys
import time
import venv
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest

if TYPE_CHECKING:
    from collections.abc import Iterator
    from types import ModuleType

_DISCOVER_PY = (
    Path(__file__).resolve().parents[3]
    / "streamlit"
    / ".agents"
    / "meta-skill"
    / "developing-with-streamlit"
    / "scripts"
    / "discover.py"
)
_LAUNCHER = os.environ.get("DISCOVER_TEST_PYTHON") or sys.executable
_SKILL_PARTS = (".agents", "skills", "developing-with-streamlit", "SKILL.md")
_IS_WINDOWS = os.name == "nt"
# Variables that point discover.py at environments on the real machine, or
# that would hide whether it disables bytecode writes itself.
_LOOKUP_ENV_VARS = (
    "VIRTUAL_ENV",
    "CONDA_PREFIX",
    "CONDA_EXE",
    "WORKON_HOME",
    "UV_PROJECT_ENVIRONMENT",
    "PYTHONDONTWRITEBYTECODE",
    "PYTHONPYCACHEPREFIX",
)


@pytest.fixture(scope="module")
def discover() -> Iterator[ModuleType]:
    """Load discover.py as a module, without writing its bytecode into the skill."""
    spec = importlib.util.spec_from_file_location("meta_skill_discover", _DISCOVER_PY)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Dataclasses look up their module in sys.modules while being created.
    sys.modules[spec.name] = module
    dont_write_bytecode = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(module)
        yield module
    finally:
        sys.dont_write_bytecode = dont_write_bytecode
        sys.modules.pop(spec.name, None)


def _site_packages(env_root: Path) -> Path:
    if _IS_WINDOWS:
        return env_root / "Lib" / "site-packages"
    version = f"python{sys.version_info.major}.{sys.version_info.minor}"
    return env_root / "lib" / version / "site-packages"


def _make_venv(env_root: Path) -> Path:
    """Create a real virtual environment without pip and return its interpreter."""
    venv.EnvBuilder(with_pip=False, symlinks=not _IS_WINDOWS).create(env_root)
    return env_root / ("Scripts/python.exe" if _IS_WINDOWS else "bin/python")


def _plant_streamlit(
    env_root: Path, *, skill: bool = True, version: str | None = None
) -> Path:
    """Create a fake Streamlit package in an environment and return its SKILL.md."""
    site_packages = _site_packages(env_root)
    package = site_packages / "streamlit"
    package.mkdir(parents=True)
    # Discovery must locate the package without importing it.
    (package / "__init__.py").write_text(
        "raise RuntimeError('discover.py imported streamlit')\n", encoding="utf-8"
    )
    skill_md = package.joinpath(*_SKILL_PARTS)
    if skill:
        skill_md.parent.mkdir(parents=True)
        skill_md.write_text("# bundled skill\n", encoding="utf-8")
    if version is not None:
        dist_info = site_packages / f"streamlit-{version}.dist-info"
        dist_info.mkdir()
        (dist_info / "METADATA").write_text(
            f"Metadata-Version: 2.1\nName: streamlit\nVersion: {version}\n",
            encoding="utf-8",
        )
    return skill_md


def _env_without_interpreter(env_root: Path) -> Path:
    """Create an environment folder whose interpreter is missing."""
    env_root.mkdir(parents=True)
    (env_root / "pyvenv.cfg").write_text("home = /missing\n", encoding="utf-8")
    return env_root


def _isolate_lookups(monkeypatch: pytest.MonkeyPatch, home: Path) -> None:
    """Keep the real machine's environments out of an in-process lookup."""
    for variable in _LOOKUP_ENV_VARS:
        monkeypatch.delenv(variable, raising=False)
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("USERPROFILE", str(home))


def _run_discover(
    *args: str, cwd: Path, env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    """Run discover.py like an agent would, without an activated environment."""
    child_env = {
        key: value
        for key, value in os.environ.items()
        if key not in {*_LOOKUP_ENV_VARS, "CLAUDE_PROJECT_DIR"}
    }
    child_env.update(env or {})
    return subprocess.run(
        [_LAUNCHER, str(_DISCOVER_PY), *args],
        cwd=cwd,
        env=child_env,
        capture_output=True,
        encoding="utf-8",
        timeout=120,
        check=False,
    )


def test_script_parses_as_python_3_8() -> None:
    """The syntax works on Python 3.8, the oldest interpreter that may run it."""
    source = _DISCOVER_PY.read_text(encoding="utf-8")
    ast.parse(source, filename=str(_DISCOVER_PY), feature_version=(3, 8))


def test_project_venv_wins_over_virtual_env(tmp_path: Path) -> None:
    """A real project interpreter is probed, and it beats an activated foreign env."""
    project = tmp_path / "my app"
    _make_venv(project / ".venv")
    project_skill = _plant_streamlit(project / ".venv")
    other_env = _env_without_interpreter(tmp_path / "agent-env")
    _plant_streamlit(other_env)

    result = _run_discover(
        "--project-dir", str(project), cwd=tmp_path, env={"VIRTUAL_ENV": str(other_env)}
    )

    assert result.returncode == 0, result.stderr
    assert len(result.stdout.splitlines()) == 1
    assert os.path.samefile(result.stdout.strip(), project_skill)
    assert result.stderr == ""


def test_probing_writes_nothing(tmp_path: Path) -> None:
    """Startup hooks of a probed environment leave no bytecode caches behind."""
    env_root = tmp_path / "project" / ".venv"
    _make_venv(env_root)
    _plant_streamlit(env_root)
    site_packages = _site_packages(env_root)
    (site_packages / "startup_hook.py").write_text("", encoding="utf-8")
    (site_packages / "startup_hook.pth").write_text("import startup_hook\n", "utf-8")

    result = _run_discover("--project-dir", str(env_root.parent), cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert list(site_packages.rglob("__pycache__")) == []


def test_search_continues_past_environment_without_streamlit(tmp_path: Path) -> None:
    """An environment without Streamlit does not end the search."""
    project = tmp_path / "project"
    _make_venv(project / ".venv")
    active_env = tmp_path / "active"
    _make_venv(active_env)
    active_skill = _plant_streamlit(active_env)

    result = _run_discover(
        "--project-dir",
        str(project),
        cwd=tmp_path,
        env={"VIRTUAL_ENV": str(active_env)},
    )

    assert result.returncode == 0, result.stderr
    assert os.path.samefile(result.stdout.strip(), active_skill)


def test_old_streamlit_in_project_is_reported_with_project_advice(
    tmp_path: Path,
) -> None:
    """The first Streamlit found decides; an old one is not skipped for a newer one."""
    project = tmp_path / "project"
    project.mkdir()
    (project / "uv.lock").write_text("", encoding="utf-8")
    _make_venv(project / ".venv")
    _plant_streamlit(project / ".venv", skill=False, version="1.50.0")

    result = _run_discover("--project-dir", str(project), cwd=project)

    assert result.returncode == 2
    assert result.stdout == ""
    assert "Streamlit 1.50.0 is installed but predates bundled skills" in result.stderr
    assert "Why: The skill ships inside the Streamlit package" in result.stderr
    assert 'uv add "streamlit>=1.57"' in result.stderr
    assert "Only if the user asked for it or agrees" in result.stderr
    assert "https://docs.streamlit.io/llms-full.txt" in result.stderr


def test_broken_interpreter_falls_back_to_site_packages(tmp_path: Path) -> None:
    """A venv whose interpreter is gone still yields its bundled skill, with a note."""
    project = tmp_path / "project"
    skill = _plant_streamlit(_env_without_interpreter(project / ".venv"))

    result = _run_discover("--project-dir", str(project), cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert os.path.samefile(result.stdout.strip(), skill)
    assert result.stderr.startswith("NOTE: .venv")
    assert "has no Python executable" in result.stderr


def test_broken_interpreter_with_old_streamlit_is_not_given_pip_advice(
    tmp_path: Path,
) -> None:
    """Installing with another Python would not fix a venv that cannot run."""
    project = tmp_path / "project"
    _plant_streamlit(_env_without_interpreter(project / ".venv"), skill=False)

    result = _run_discover("--project-dir", str(project), cwd=tmp_path)

    assert result.returncode == 2
    assert "repair or recreate it with Streamlit 1.57 or newer" in result.stderr
    assert "pip install" not in result.stderr


def test_restructured_skills_folder_lists_the_bundled_skills(tmp_path: Path) -> None:
    """Without the expected sub-path, exit 4 lists the skills that do exist."""
    project = tmp_path / "project"
    env_root = _env_without_interpreter(project / ".venv")
    _plant_streamlit(env_root, skill=False)
    skills = _site_packages(env_root) / "streamlit" / ".agents" / "skills"
    (skills / "other").mkdir(parents=True)
    (skills / "other" / "SKILL.md").write_text("# other skill\n", encoding="utf-8")

    result = _run_discover("--project-dir", str(project), cwd=tmp_path)

    assert result.returncode == 4
    assert result.stdout == ""
    assert "has no developing-with-streamlit/SKILL.md" in result.stderr
    assert os.path.join("other", "SKILL.md") in result.stderr


def test_site_packages_with_the_skill_is_preferred(
    discover: ModuleType, tmp_path: Path
) -> None:
    """In a venv upgraded in place, the site-packages that has the skill wins."""
    old = tmp_path / "lib" / "python3.9" / "site-packages" / "streamlit"
    new = tmp_path / "lib" / "python3.12" / "site-packages" / "streamlit"
    old.mkdir(parents=True)
    (old / "__init__.py").write_text("", "utf-8")
    new.joinpath(*_SKILL_PARTS).parent.mkdir(parents=True)
    (new / "__init__.py").write_text("", "utf-8")
    new.joinpath(*_SKILL_PARTS).write_text("", "utf-8")

    assert discover._site_packages_streamlit(tmp_path) == new


@pytest.mark.parametrize(
    ("args", "shown"),
    [
        pytest.param(
            ["--project-dir", "${CLAUDE_PROJECT_DIR}"], "'${CLAUDE_", id="unexpanded"
        ),
        # Windows PowerShell 5.1 drops an empty "" argument.
        pytest.param(["--project-dir"], "''", id="no-value"),
    ],
)
def test_unusable_project_dir_falls_back_to_cwd(
    tmp_path: Path, args: list[str], shown: str
) -> None:
    """An unexpanded or missing --project-dir value warns and searches the cwd."""
    skill = _plant_streamlit(_env_without_interpreter(tmp_path / ".venv"))

    result = _run_discover(*args, cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert os.path.samefile(result.stdout.strip(), skill)
    assert f"WARNING: --project-dir {shown}" in result.stderr


def test_valid_project_dir_works_without_a_cwd(
    discover: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A valid --project-dir is used even when the agent's cwd was deleted."""
    expected = tmp_path.resolve()

    def deleted_cwd() -> Path:
        raise FileNotFoundError("the cwd was deleted")

    monkeypatch.setattr(discover.Path, "cwd", deleted_cwd)

    assert discover._resolve_project_dir(str(tmp_path)) == expected


@pytest.mark.parametrize(
    ("local_path", "pythonpath"),
    [
        pytest.param("streamlit.py", True, id="module-on-pythonpath"),
        # `python -c` would put the cwd first on sys.path; `--probe` does not.
        pytest.param("streamlit/__init__.py", False, id="package-in-cwd"),
    ],
)
def test_local_streamlit_is_not_mistaken_for_the_package(
    tmp_path: Path, local_path: str, pythonpath: bool
) -> None:
    """A project's own `streamlit` module or folder is not the installed package."""
    project = tmp_path / "project"
    python = _make_venv(project / ".venv")
    (project / local_path).parent.mkdir(parents=True, exist_ok=True)
    (project / local_path).write_text("", encoding="utf-8")
    env = {"PYTHONPATH": str(project)} if pythonpath else {}

    result = _run_discover(
        "--project-dir", str(project), "--python", str(python), cwd=project, env=env
    )

    assert result.returncode == 1, result.stderr
    assert "ERROR: Streamlit is not installed" in result.stderr
    assert "-m pip install streamlit" in result.stderr
    # A --python guess that misses points back to the automatic search.
    assert "re-run this script without --python" in result.stderr


def test_unrunnable_interpreter_is_not_reported_as_missing(tmp_path: Path) -> None:
    """An interpreter that cannot start is a failed check, not a missing install."""
    not_python = tmp_path / "python.exe"
    not_python.write_text("not an interpreter", encoding="utf-8")

    result = _run_discover("--python", str(not_python), cwd=tmp_path)

    assert result.returncode == 3
    assert "ERROR: Could not run any Python interpreter" in result.stderr
    assert "could not be started" in result.stderr
    assert "Streamlit is not installed" not in result.stderr


@pytest.mark.parametrize(
    ("args", "problem"),
    [
        pytest.param(["--python", "missing-python-x"], "--python", id="bad-python"),
        pytest.param(["--unknown"], "usage message", id="unknown-flag"),
    ],
)
def test_invalid_arguments_are_explained(
    tmp_path: Path, args: list[str], problem: str
) -> None:
    """Argument errors exit 5 and say that nothing was checked."""
    result = _run_discover(*args, cwd=tmp_path)

    assert result.returncode == 5
    assert "ERROR: Invalid arguments" in result.stderr
    assert problem in result.stderr
    assert "nothing was checked" in result.stderr


def test_candidates_are_ordered_from_project_to_path(
    discover: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """uv's selected and project environments come first, then activated ones."""
    outer = tmp_path / "outer"
    repo = outer / "repo"
    app = repo / "app"
    (repo / ".git").mkdir(parents=True)
    _env_without_interpreter(outer / ".venv")  # Above the git root: never checked.
    _env_without_interpreter(repo / ".venv")
    _env_without_interpreter(app / ".venv")
    _env_without_interpreter(app / "venv")
    (app / "env").mkdir()  # No pyvenv.cfg: a source folder.
    (app / ".conda").mkdir()  # No conda-meta: conda's settings folder.
    _isolate_lookups(monkeypatch, tmp_path / "home")
    monkeypatch.setenv("VIRTUAL_ENV", str(tmp_path / "virtual-env"))
    monkeypatch.setenv("CONDA_PREFIX", str(tmp_path / "conda"))
    monkeypatch.setenv("UV_PROJECT_ENVIRONMENT", "uv-env")
    monkeypatch.setattr(discover.shutil, "which", lambda _name: None)

    candidates = list(discover._candidates(app, deadline=float("inf")))

    this_python = discover._python_candidate("", Path(sys.executable))
    assert [(c.label, c.env_root) for c in candidates] == [
        ("$UV_PROJECT_ENVIRONMENT", app / "uv-env"),
        (".venv", app / ".venv"),
        ("venv", app / "venv"),
        (".venv", repo / ".venv"),
        ("$VIRTUAL_ENV", tmp_path / "virtual-env"),
        ("$CONDA_PREFIX", tmp_path / "conda"),
        ("Python running this script", this_python.env_root),
    ]


def test_project_at_the_git_root_also_searches_its_parent(
    discover: ModuleType, tmp_path: Path
) -> None:
    """A shared environment next to the repository is still found."""
    (tmp_path / "repo" / ".git").mkdir(parents=True)

    assert discover._search_dirs(tmp_path / "repo") == [tmp_path / "repo", tmp_path]


def test_failing_lookup_skips_only_its_own_section(
    discover: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An unreadable folder in one lookup does not hide the later candidates."""

    def unreadable(_dirs: list[Path]) -> Iterator[Any]:
        raise PermissionError(13, "Permission denied")
        yield  # Makes this a generator, like the function it replaces.

    _isolate_lookups(monkeypatch, tmp_path / "home")
    monkeypatch.setattr(discover, "_recorded_environments", unreadable)
    monkeypatch.setattr(discover.shutil, "which", lambda _name: None)

    labels = [c.label for c in discover._candidates(tmp_path, float("inf"))]

    assert labels == ["Python running this script"]


def test_environments_recorded_outside_the_project_are_found(
    discover: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Conda and Pipenv environments are found by reading files only."""
    home = tmp_path / "home"
    project = tmp_path / "project"
    project.mkdir()
    (project / "environment.yml").write_text("name: dash  # app env\n", "utf-8")
    conda_env = tmp_path / "miniforge3" / "envs" / "dash"
    pipenv_env = home / ".local" / "share" / "virtualenvs" / "project-Ab12Cd34"
    unrelated_env = home / ".local" / "share" / "virtualenvs" / "other-Ef56Gh78"
    for env_root in (conda_env, pipenv_env, unrelated_env):
        env_root.mkdir(parents=True)
    (pipenv_env / ".project").write_text(str(project), "utf-8")
    (unrelated_env / ".project").write_text(str(tmp_path / "other"), "utf-8")
    _isolate_lookups(monkeypatch, home)
    monkeypatch.setenv("CONDA_EXE", str(tmp_path / "miniforge3" / "bin" / "conda"))
    monkeypatch.setattr(discover, "_run", lambda *_: pytest.fail("must not run"))

    candidates = list(discover._recorded_environments([project]))

    assert [(c.label, c.env_root) for c in candidates] == [
        ("conda environment 'dash'", conda_env),
        ("Pipenv environment", pipenv_env),
    ]


def test_poetry_is_queried_only_in_a_poetry_project(
    discover: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Poetry is asked for its environment, without plugins, only with a lockfile."""
    poetry_env = tmp_path / "cache" / "app-py3.12"
    poetry_env.mkdir(parents=True)
    calls: list[list[str]] = []

    def fake_run(
        command: list[str], cwd: Path, deadline: float
    ) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        return subprocess.CompletedProcess(command, 0, f"{poetry_env}\n", "")

    monkeypatch.setattr(discover, "_run", fake_run)
    monkeypatch.setattr(discover.shutil, "which", lambda name: name)
    project = tmp_path / "project"
    project.mkdir()

    assert list(discover._poetry_environment([project], float("inf"))) == []
    assert calls == []

    (project / "poetry.lock").write_text("", encoding="utf-8")
    candidates = list(discover._poetry_environment([project], float("inf")))

    assert calls == [
        ["poetry", "--no-plugins", "--no-interaction", "env", "info", "--path"]
    ]
    assert [(c.label, c.env_root) for c in candidates] == [
        ("Poetry environment", poetry_env)
    ]


def test_child_processes_cannot_install_or_write(
    discover: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Probes run without input, bytecode writes, launcher auto-installs, or PYTHONHOME."""
    seen: dict[str, Any] = {}

    class FakePopen:
        returncode = 0

        def __init__(self, _command: list[str], **kwargs: Any) -> None:
            seen.update(kwargs)

        def communicate(self, timeout: float) -> tuple[str, str]:
            return "", ""

    monkeypatch.setenv("PYTHONHOME", str(tmp_path))
    monkeypatch.setattr(discover.subprocess, "Popen", FakePopen)

    discover._run(["python"], tmp_path, deadline=float("inf"))

    assert seen["stdin"] == subprocess.DEVNULL
    assert "PYTHONHOME" not in seen["env"]
    assert seen["env"]["PYTHONDONTWRITEBYTECODE"] == "1"
    assert seen["env"]["PYTHON_MANAGER_AUTOMATIC_INSTALL"] == "false"
    assert seen["env"]["MISE_AUTO_INSTALL"] == "false"


def test_hanging_interpreter_is_stopped(discover: ModuleType, tmp_path: Path) -> None:
    """A child that never answers is killed when the time limit runs out."""
    command = [sys.executable, "-c", "import time; time.sleep(60)"]
    started = time.monotonic()

    failure = discover._run(command, tmp_path, time.monotonic() + 1)

    assert failure.detail.startswith("did not answer within")
    assert time.monotonic() - started < 10


def test_timed_out_probe_does_not_stop_the_search(
    discover: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A hanging interpreter is recorded and the next candidate is checked."""
    skill = _plant_streamlit(_env_without_interpreter(tmp_path / "env"))
    candidates = [
        discover._Candidate("hanging", [str(tmp_path / "hanging-python")]),
        discover._Candidate("broken env", None, tmp_path / "env"),
    ]
    timed_out = discover._Result("failed", "did not answer within 15s")
    monkeypatch.setattr(discover, "_run", lambda *_: timed_out)
    monkeypatch.setattr(discover, "_candidates", lambda *_args: iter(candidates))

    assert discover.main(["--project-dir", str(tmp_path)]) == 0
    assert os.path.samefile(capsys.readouterr().out.strip(), skill)


def test_macos_python_stub_is_never_run(
    discover: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Without the Command Line Tools, /usr/bin/python3 would open an install dialog."""
    tools = tmp_path / "CommandLineTools"
    monkeypatch.setattr(discover.sys, "platform", "darwin")
    monkeypatch.setattr(discover, "_MACOS_DEVELOPER_TOOLS", (str(tools),))
    monkeypatch.setattr(discover, "_run", lambda *_: pytest.fail("must not run"))

    reason = discover._macos_install_dialog_reason("/usr/bin/python3")
    candidate = discover._Candidate("python3", ["/usr/bin/python3"], skip_reason=reason)
    result = discover._check(candidate, tmp_path, float("inf"))

    assert "Command Line Tools" in reason
    assert (result.status, result.detail) == ("skipped", f"not run: {reason}")
    assert discover._macos_install_dialog_reason("/opt/homebrew/bin/python3") == ""
    tools.mkdir()
    assert discover._macos_install_dialog_reason("/usr/bin/python3") == ""


def test_python_flag_has_the_macos_stub_guard(
    discover: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """--python gets the same guard against opening the macOS installer dialog."""
    python = tmp_path / "python3"
    python.write_text("", encoding="utf-8")
    monkeypatch.setattr(discover, "_macos_install_dialog_reason", lambda _: "dialog")
    monkeypatch.setattr(discover, "_run", lambda *_: pytest.fail("must not run"))

    assert discover.main(["--project-dir", str(tmp_path), "--python", str(python)]) == 3
    assert "not run: dialog" in capsys.readouterr().err


@pytest.mark.parametrize(
    ("python", "manifest", "advice"),
    [
        pytest.param("3.12", None, "-m pip install streamlit", id="supported-python"),
        pytest.param(
            "3.9", None, "uses Python 3.9, and Streamlit releases", id="old-python"
        ),
        # uv creates the project's environment with a Python it picks itself.
        pytest.param("3.9", "uv.lock", "uv add streamlit", id="old-launcher-uv"),
    ],
)
def test_not_installed_report_explains_every_way_forward(
    discover: ModuleType,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    python: str,
    manifest: str | None,
    advice: str,
) -> None:
    """Advice fits the interpreter's Python and names environments that failed."""
    if manifest is not None:
        (tmp_path / manifest).write_text("", encoding="utf-8")
    attempts = [
        (
            discover._Candidate(".venv", None, tmp_path / ".venv"),
            discover._Result("failed", "has no Python executable (deleted or broken)"),
        ),
        (
            discover._Candidate("python3 on PATH", ["python3"]),
            discover._Result(
                "missing", "ran, but Streamlit is not installed", python=python
            ),
        ),
    ]

    assert discover._report_not_found(attempts, tmp_path) == 1
    stderr = capsys.readouterr().err
    assert advice in stderr
    assert "Some environments could not be checked (.venv)" in stderr


def test_unexpected_error_is_explained(
    discover: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A bug in the script prints guidance instead of a traceback."""

    def explode(*_args: Any) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(discover, "_candidates", explode)

    assert discover.main(["--project-dir", str(tmp_path)]) == 6
    stderr = capsys.readouterr().err
    assert "ERROR: Unexpected error in discover.py: RuntimeError('boom')" in stderr
    assert "This is a bug in the script" in stderr
    assert "Traceback" not in stderr


@pytest.mark.parametrize(
    ("stdout", "expected"),
    [
        pytest.param(
            'banner\nSTREAMLIT_DISCOVER_PROBE={"package_dir": "a"}\n'
            'STREAMLIT_DISCOVER_PROBE={"package_dir": "b", "version": "1.60.0"}\n',
            {"package_dir": "b", "version": "1.60.0"},
            id="last-marker-wins",
        ),
        pytest.param("STREAMLIT_DISCOVER_PROBE={}\n", {}, id="not-installed"),
        pytest.param("Python was not found\n", None, id="no-marker"),
        pytest.param("STREAMLIT_DISCOVER_PROBE={oops\n", None, id="invalid-json"),
    ],
)
def test_only_the_last_probe_marker_line_is_trusted(
    discover: ModuleType, stdout: str, expected: dict[str, str] | None
) -> None:
    """Startup output before the marker is ignored, and garbage is a failure."""
    assert discover._parse_probe_output(stdout) == expected


@pytest.mark.parametrize(
    ("is_windows", "layout", "found"),
    [
        pytest.param(True, "Scripts/python.exe", True, id="win-venv"),
        pytest.param(True, "python.exe", True, id="win-conda"),
        pytest.param(False, "bin/python3", True, id="posix-python3-only"),
        pytest.param(False, "Scripts/python.exe", False, id="posix-ignores-win"),
    ],
)
def test_env_candidate_finds_the_interpreter_for_each_layout(
    discover: ModuleType,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    is_windows: bool,
    layout: str,
    found: bool,
) -> None:
    """Venv, conda, and pixi interpreter layouts are found per platform."""
    (tmp_path / layout).parent.mkdir(parents=True, exist_ok=True)
    (tmp_path / layout).write_text("", encoding="utf-8")
    monkeypatch.setattr(discover, "_IS_WINDOWS", is_windows)

    candidate = discover._env_candidate(".venv", tmp_path)

    assert candidate.command == ([str(tmp_path / layout)] if found else None)


@pytest.mark.parametrize(
    ("manifest", "pyvenv_cfg", "expected"),
    [
        pytest.param("poetry.lock", "", "poetry add streamlit", id="poetry"),
        # A cloned uv project that already locks Streamlit only needs a sync.
        pytest.param("uv.lock:locked", "", "uv sync", id="uv-project-not-synced"),
        pytest.param("Pipfile", "", "pipenv install streamlit", id="pipenv"),
        pytest.param(
            None, "uv = 0.9.0\n", "uv pip install --python {python} streamlit", id="uv"
        ),
        pytest.param(None, "", "{python} -m pip install streamlit", id="pip"),
    ],
)
def test_install_command_matches_project_tooling(
    discover: ModuleType,
    tmp_path: Path,
    manifest: str | None,
    pyvenv_cfg: str,
    expected: str,
) -> None:
    """Install advice uses the project's package manager."""
    if manifest is not None:
        name, _, locked = manifest.partition(":")
        text = '[[package]]\nname = "streamlit"\n' if locked else ""
        (tmp_path / name).write_text(text, encoding="utf-8")
    env_root = tmp_path / ".venv"
    env_root.mkdir()
    (env_root / "pyvenv.cfg").write_text(f"home = /x\n{pyvenv_cfg}", "utf-8")
    python = env_root / "bin" / "python"
    candidate = discover._Candidate(".venv", [str(python)], env_root)

    command = discover._install_command(candidate, tmp_path, "streamlit")

    python_display = discover._display_command([str(python)])
    assert command == expected.format(python=python_display)
