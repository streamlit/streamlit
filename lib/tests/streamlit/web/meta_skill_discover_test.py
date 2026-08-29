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

"""Guardrails for the vendored meta-skill ``discover.py`` script."""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Final

import pytest

if TYPE_CHECKING:
    from types import ModuleType

# Locate files from this test module so Windows CI can run without importing
# Streamlit (generated protobufs are not present in that job).
_LIB_STREAMLIT: Final = Path(__file__).resolve().parents[3] / "streamlit"
_DISCOVER_PY: Final = (
    _LIB_STREAMLIT
    / ".agents"
    / "meta-skill"
    / "developing-with-streamlit"
    / "scripts"
    / "discover.py"
)
_SKILL_REL: Final = (
    Path(".agents") / "skills" / "developing-with-streamlit" / "SKILL.md"
)


@pytest.fixture
def discover_mod() -> ModuleType:
    """Load ``discover.py`` as a module so helpers can be unit-tested."""
    spec = importlib.util.spec_from_file_location("meta_skill_discover", _DISCOVER_PY)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Dataclasses look up the module in sys.modules during class creation.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def isolated_env(
    monkeypatch: pytest.MonkeyPatch, discover_mod: ModuleType, tmp_path: Path
) -> None:
    """Hide inherited interpreters so tests control the candidate list."""
    _hide_inherited_interpreters(monkeypatch, discover_mod, tmp_path)
    # Planted fixtures use POSIX ``bin/python`` layouts. Force that lookup
    # so these helper tests also pass on the Windows CI job.
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", False)


def _hide_inherited_interpreters(
    monkeypatch: pytest.MonkeyPatch, discover_mod: ModuleType, tmp_path: Path
) -> None:
    """Drop VIRTUAL_ENV, CONDA_PREFIX, sys.executable, and PATH lookups."""
    monkeypatch.delenv("VIRTUAL_ENV", raising=False)
    monkeypatch.delenv("CONDA_PREFIX", raising=False)
    monkeypatch.setattr(
        discover_mod.sys, "executable", str(tmp_path / "no-such-python")
    )
    monkeypatch.setattr(discover_mod.shutil, "which", lambda _name: None)


def _subprocess_reports_no_streamlit(
    *_args: object, **_kwargs: object
) -> subprocess.CompletedProcess[str]:
    """Fake ``subprocess.run``: exit 0 with empty stdout (no STREAMLIT_PKG line)."""
    return subprocess.CompletedProcess(["python"], 0, stdout="", stderr="")


def _run_discover(*cli_args: str) -> subprocess.CompletedProcess[str]:
    """Run discover.py as a subprocess, ignoring inherited venv env vars."""
    env = os.environ.copy()
    env.pop("VIRTUAL_ENV", None)
    env.pop("CONDA_PREFIX", None)
    return subprocess.run(
        [sys.executable, str(_DISCOVER_PY), *cli_args],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
        env=env,
    )


def _touch_exe(path: Path) -> Path:
    """Create an empty placeholder executable file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("", encoding="utf-8")
    return path


def _symlink_or_skip(link: Path, target: Path) -> Path:
    """Create ``link`` -> ``target``, or skip when the host cannot symlink."""
    link.parent.mkdir(parents=True, exist_ok=True)
    try:
        link.symlink_to(target)
    except OSError as exc:
        pytest.skip(f"cannot create symlink: {exc}")
    return link


def _plant_skill(pkg: Path, content: str = "# skill\n") -> Path:
    """Write a Streamlit package tree with the bundled content skill."""
    pkg.mkdir(parents=True, exist_ok=True)
    (pkg / "__init__.py").write_text("", encoding="utf-8")
    skill = pkg / _SKILL_REL
    skill.parent.mkdir(parents=True, exist_ok=True)
    skill.write_text(content, encoding="utf-8")
    return skill


def _posix_site_packages(prefix: Path, version: str = "python3.12") -> Path:
    """Return ``prefix/lib/<version>/site-packages``, creating it."""
    site_packages = prefix / "lib" / version / "site-packages"
    site_packages.mkdir(parents=True, exist_ok=True)
    return site_packages


def _plant_posix_venv(root: Path, *, with_skill: bool = True) -> Path | None:
    """Plant a POSIX-style venv prefix with ``bin/python`` and optional skill."""
    _touch_exe(root / "bin" / "python")
    pkg = _posix_site_packages(root) / "streamlit"
    pkg.mkdir(parents=True, exist_ok=True)
    (pkg / "__init__.py").write_text("", encoding="utf-8")
    if with_skill:
        return _plant_skill(pkg)
    return None


def _venv_site_packages(venv_root: Path) -> Path:
    """Return site-packages of a real ``python -m venv`` tree."""
    if os.name == "nt":
        return venv_root / "Lib" / "site-packages"
    matches = sorted(venv_root.glob("lib/python*/site-packages"))
    assert matches, f"no site-packages under {venv_root}"
    return matches[0]


def _create_venv(path: Path) -> Path:
    """Create a real virtualenv at ``path``."""
    subprocess.run(
        [sys.executable, "-m", "venv", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return path


def test_iter_candidates_order(
    tmp_path: Path,
    discover_mod: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Candidates follow the spec order: project venvs, then env vars, then sys."""
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", False)
    repo = tmp_path / "repo"
    pkg = repo / "pkg"
    project = pkg / "app"
    project.mkdir(parents=True)
    (repo / ".git").mkdir()

    _plant_posix_venv(project / ".venv")
    parent_venv = pkg / "venv"
    _plant_posix_venv(parent_venv)
    (parent_venv / "pyvenv.cfg").write_text("home = x\n", encoding="utf-8")
    _plant_posix_venv(repo / ".venv")

    virtual_env = tmp_path / "agent-venv"
    _plant_posix_venv(virtual_env)
    conda = tmp_path / "conda"
    _plant_posix_venv(conda)
    sys_py = _touch_exe(tmp_path / "sys" / "bin" / "python")
    python3 = _touch_exe(tmp_path / "system" / "python3")
    python = _touch_exe(tmp_path / "system" / "python")
    uv_bin = _touch_exe(tmp_path / "bin" / "uv")
    (project / "uv.lock").write_text("", encoding="utf-8")

    monkeypatch.setenv("VIRTUAL_ENV", str(virtual_env))
    monkeypatch.setenv("CONDA_PREFIX", str(conda))
    monkeypatch.setattr(discover_mod.sys, "executable", str(sys_py))

    which_map = {
        "uv": str(uv_bin),
        "python3": str(python3),
        "python": str(python),
    }
    monkeypatch.setattr(discover_mod.shutil, "which", which_map.get)

    candidates = discover_mod._iter_candidates(project, python_flag=None)
    tags = [candidate.tag for candidate in candidates]
    assert tags == [
        "venv-local",
        "venv-parent",
        "venv-git-root",
        "virtual-env",
        "conda",
        "sys-executable",
        "uv",
        "system",
        "system",
    ]
    assert candidates[6].argv == ["uv", "run", "--no-sync", "--quiet", "python"]
    assert candidates[7].argv[0] == str(python3)
    assert candidates[8].argv[0] == str(python)


def test_python_flag_is_exclusive(
    tmp_path: Path, discover_mod: ModuleType, isolated_env: None
) -> None:
    """``--python`` returns only that candidate."""
    project = tmp_path / "proj"
    project.mkdir()
    _plant_posix_venv(project / ".venv")
    chosen = _touch_exe(tmp_path / "chosen" / "bin" / "python")

    candidates = discover_mod._iter_candidates(project, python_flag=chosen)
    assert len(candidates) == 1
    assert candidates[0].tag == "python-flag"
    assert candidates[0].argv == [str(chosen)]


def test_prefix_from_python_does_not_follow_venv_symlink(
    tmp_path: Path, discover_mod: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A venv ``bin/python`` symlink must keep the venv prefix, not the base install."""
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", False)
    base_py = _touch_exe(tmp_path / "usr" / "bin" / "python")
    venv_py = _symlink_or_skip(tmp_path / "venv" / "bin" / "python", base_py)
    assert discover_mod._prefix_from_python(venv_py) == tmp_path / "venv"


def test_python_flag_symlink_does_not_use_base_install_skill(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """``--python`` on a venv symlink must not short-circuit to the base install skill."""
    base_py = _touch_exe(tmp_path / "usr" / "bin" / "python")
    _plant_skill(
        _posix_site_packages(tmp_path / "usr") / "streamlit", content="# base\n"
    )
    venv = tmp_path / "venv"
    venv_py = _symlink_or_skip(venv / "bin" / "python", base_py)
    venv_skill = _plant_skill(
        _posix_site_packages(venv) / "streamlit", content="# venv\n"
    )

    code = discover_mod.main(["--python", str(venv_py)])
    captured = capsys.readouterr()
    assert code == 0
    assert captured.out.strip() == str(venv_skill.resolve())


def test_distinct_venv_python_symlinks_are_not_deduped(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Two venvs that share a resolved interpreter must both be inspected."""
    target = _touch_exe(tmp_path / "cpython" / "bin" / "python")
    project = tmp_path / "proj"
    project.mkdir()
    _symlink_or_skip(project / ".venv" / "bin" / "python", target)
    local_pkg = _posix_site_packages(project / ".venv") / "streamlit"
    local_pkg.mkdir(parents=True)
    (local_pkg / "__init__.py").write_text("", encoding="utf-8")

    parent_venv = tmp_path / ".venv"
    _symlink_or_skip(parent_venv / "bin" / "python", target)
    parent_skill = _plant_skill(_posix_site_packages(parent_venv) / "streamlit")

    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 0
    assert captured.out.strip() == str(parent_skill.resolve())


def test_project_venv_beats_virtual_env(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Project ``.venv`` wins over a stale ``$VIRTUAL_ENV``."""
    project = tmp_path / "proj"
    project.mkdir()
    project_skill = _plant_posix_venv(project / ".venv", with_skill=True)
    agent = tmp_path / "agent-venv"
    _plant_posix_venv(agent, with_skill=True)
    monkeypatch.setenv("VIRTUAL_ENV", str(agent))

    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 0
    assert captured.out.strip() == str(project_skill.resolve())


def test_unusable_skill_is_not_terminal(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """An old Streamlit in the project venv does not stop a later usable skill."""
    project = tmp_path / "proj"
    project.mkdir()
    _plant_posix_venv(project / ".venv", with_skill=False)
    later = tmp_path / "later-venv"
    later_skill = _plant_posix_venv(later, with_skill=True)
    monkeypatch.setenv("VIRTUAL_ENV", str(later))

    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 0
    assert captured.out.strip() == str(later_skill.resolve())


def test_layout_changed_does_not_outrank_earlier_no_streamlit(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Final error is the highest-priority inspected candidate, not worst severity."""
    project = tmp_path / "proj"
    project.mkdir()
    _touch_exe(project / ".venv" / "bin" / "python")
    later = tmp_path / "later-venv"
    _touch_exe(later / "bin" / "python")
    pkg = _posix_site_packages(later) / "streamlit"
    pkg.mkdir(parents=True)
    (pkg / "__init__.py").write_text("", encoding="utf-8")
    (pkg / ".agents" / "skills").mkdir(parents=True)
    monkeypatch.setenv("VIRTUAL_ENV", str(later))

    monkeypatch.setattr(
        discover_mod.subprocess, "run", _subprocess_reports_no_streamlit
    )

    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 1
    assert captured.err.startswith("ERROR[NO_STREAMLIT]:")
    assert "ERROR[SKILLS_LAYOUT_CHANGED]" not in captured.err
    assert discover_mod._DOCS_URL in captured.err


def test_lone_streamlit_py_is_rejected(
    tmp_path: Path, discover_mod: ModuleType
) -> None:
    """A shadowed ``streamlit.py`` file is not a usable package."""
    lone = tmp_path / "streamlit.py"
    lone.write_text("print('nope')\n", encoding="utf-8")
    assert discover_mod._is_usable_package_dir(lone) is False


def test_in_tree_streamlit_package_is_accepted(discover_mod: ModuleType) -> None:
    """The in-tree ``lib/streamlit`` package (editable checkout) is accepted."""
    pkg = _LIB_STREAMLIT
    assert pkg.name == "streamlit"
    assert discover_mod._is_usable_package_dir(pkg) is True


def test_sentinel_last_wins(discover_mod: ModuleType, tmp_path: Path) -> None:
    """The parent keeps the last ``STREAMLIT_PKG=`` line, not a banner."""
    blob = (
        "hello from sitecustomize\n"
        "STREAMLIT_PKG=/wrong\n"
        "banner STREAMLIT_PKG=/nope\n"
        f"STREAMLIT_PKG={tmp_path / 'right'}\n"
    )
    assert discover_mod._parse_streamlit_pkg(blob) == tmp_path / "right"


def test_store_alias_skipped_only_for_windowsapps_dir(
    tmp_path: Path,
    discover_mod: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Skip App Execution Alias stubs, not every path containing WindowsApps."""
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", True)
    local = tmp_path / "la"
    alias = local / "Microsoft" / "WindowsApps" / "python.exe"
    _touch_exe(alias)
    real = local / "Programs" / "Python" / "python.exe"
    _touch_exe(real)
    trick = tmp_path / "WindowsAppsStore" / "python.exe"
    _touch_exe(trick)
    monkeypatch.setenv("LOCALAPPDATA", str(local))

    assert discover_mod._is_windows_store_alias(alias) is True
    assert discover_mod._is_windows_store_alias(real) is False
    assert discover_mod._is_windows_store_alias(trick) is False


def test_windows_find_venv_python_root_then_scripts(
    tmp_path: Path,
    discover_mod: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Windows: conda-style ``python.exe`` at the prefix, else ``Scripts/python.exe``."""
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", True)
    prefix = tmp_path / "conda"
    root_exe = _touch_exe(prefix / "python.exe")
    assert discover_mod.find_venv_python(prefix) == root_exe

    scripts = tmp_path / "venv"
    scripts_exe = _touch_exe(scripts / "Scripts" / "python.exe")
    assert discover_mod.find_venv_python(scripts) == scripts_exe


def test_unexpanded_project_dir_warns_and_uses_cwd(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A literal ``${CLAUDE_PROJECT_DIR}`` is a warning, not ``INVALID_ARGS``."""
    project = tmp_path / "proj"
    project.mkdir()
    skill = _plant_posix_venv(project / ".venv")
    monkeypatch.chdir(project)

    code = discover_mod.main(["--project-dir", "${CLAUDE_PROJECT_DIR}"])
    captured = capsys.readouterr()
    assert code == 0
    assert "WARNING:" in captured.err
    assert "ERROR[INVALID_ARGS]" not in captured.err
    assert captured.out.strip() == str(skill.resolve())


def test_missing_project_dir_warns_and_uses_cwd(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A path that does not exist warns and falls back to cwd."""
    project = tmp_path / "proj"
    project.mkdir()
    skill = _plant_posix_venv(project / ".venv")
    monkeypatch.chdir(project)

    code = discover_mod.main(["--project-dir", str(tmp_path / "missing")])
    captured = capsys.readouterr()
    assert code == 0
    assert "WARNING:" in captured.err
    assert captured.out.strip() == str(skill.resolve())


def test_python_flag_exclusive_ignores_project_venv(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """``--python`` does not fall through to a project venv that has a skill."""
    project = tmp_path / "proj"
    project.mkdir()
    _plant_posix_venv(project / ".venv")
    chosen = _touch_exe(tmp_path / "chosen" / "bin" / "python")

    monkeypatch.setattr(
        discover_mod.subprocess, "run", _subprocess_reports_no_streamlit
    )

    code = discover_mod.main(["--project-dir", str(project), "--python", str(chosen)])
    captured = capsys.readouterr()
    assert code == 1
    assert captured.err.startswith("ERROR[NO_STREAMLIT]:")
    assert "python-flag" in captured.err


def test_bad_python_flag_is_invalid_args(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A missing ``--python`` path is a hard ``ERROR[INVALID_ARGS]``."""
    code = discover_mod.main(["--python", str(tmp_path / "missing-python")])
    captured = capsys.readouterr()
    assert code == 5
    assert captured.err.startswith("ERROR[INVALID_ARGS]:")
    assert discover_mod._DOCS_URL in captured.err


def test_unknown_flag_is_invalid_args(
    discover_mod: ModuleType, capsys: pytest.CaptureFixture[str]
) -> None:
    """Unknown flags start with ``ERROR[INVALID_ARGS]`` and exit 5."""
    code = discover_mod.main(["--nope"])
    captured = capsys.readouterr()
    assert code == 5
    assert captured.err.startswith("ERROR[INVALID_ARGS]:")
    assert discover_mod._DOCS_URL in captured.err


def test_budget_marks_remaining_candidates_not_tried(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """After the subprocess budget is exhausted, later candidates are ``not_tried``."""
    project = tmp_path / "proj"
    project.mkdir()
    _touch_exe(project / ".venv" / "bin" / "python")
    later = tmp_path / "later-venv"
    _touch_exe(later / "bin" / "python")
    monkeypatch.setenv("VIRTUAL_ENV", str(later))

    times = iter([0.0, 60.0])
    monkeypatch.setattr(
        discover_mod.subprocess, "run", _subprocess_reports_no_streamlit
    )
    monkeypatch.setattr(discover_mod.time, "monotonic", lambda: next(times))

    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 1
    assert "not_tried" in captured.err


def test_probe_failed_when_nothing_inspected(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Timeouts/stubs with no successful inspection are ``PROBE_FAILED``, not missing Streamlit."""
    project = tmp_path / "proj"
    project.mkdir()
    _touch_exe(project / ".venv" / "bin" / "python")

    def _boom(*_args: object, **_kwargs: object) -> None:
        raise subprocess.TimeoutExpired(cmd="python", timeout=10)

    monkeypatch.setattr(discover_mod.subprocess, "run", _boom)

    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 7
    assert captured.err.startswith("ERROR[PROBE_FAILED]:")
    assert "ERROR[NO_STREAMLIT]" not in captured.err
    assert discover_mod._DOCS_URL in captured.err


def test_skip_py_launcher_when_missing(
    tmp_path: Path,
    discover_mod: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Windows ``py -3`` is omitted when ``py`` is not on PATH."""
    _hide_inherited_interpreters(monkeypatch, discover_mod, tmp_path)
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", True)
    project = tmp_path / "proj"
    project.mkdir()
    tags = [c.tag for c in discover_mod._iter_candidates(project, python_flag=None)]
    assert "py-launcher" not in tags


@pytest.mark.parametrize(
    "is_windows",
    [True, False],
    ids=["windows", "posix"],
)
def test_system_interpreter_order(
    tmp_path: Path,
    discover_mod: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    is_windows: bool,
) -> None:
    """Windows prefers ``python`` then ``python3``; POSIX the reverse."""
    _hide_inherited_interpreters(monkeypatch, discover_mod, tmp_path)
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", is_windows)
    python = _touch_exe(tmp_path / "python")
    python3 = _touch_exe(tmp_path / "python3")
    which_map = {"python": str(python), "python3": str(python3)}
    monkeypatch.setattr(discover_mod.shutil, "which", which_map.get)
    project = tmp_path / "proj"
    project.mkdir()
    system = [
        c
        for c in discover_mod._iter_candidates(project, python_flag=None)
        if c.tag == "system"
    ]
    expected = ["python", "python3"] if is_windows else ["python3", "python"]
    assert [Path(c.argv[0]).name for c in system] == expected


def test_uv_argv_includes_no_sync(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The uv manager candidate must pass ``--no-sync`` so discovery never installs."""
    project = tmp_path / "proj"
    project.mkdir()
    (project / "uv.lock").write_text("", encoding="utf-8")
    monkeypatch.setattr(
        discover_mod.shutil,
        "which",
        lambda name: "/usr/bin/uv" if name == "uv" else None,
    )
    candidates = discover_mod._iter_candidates(project, python_flag=None)
    uv = next(c for c in candidates if c.tag == "uv")
    assert uv.argv == ["uv", "run", "--no-sync", "--quiet", "python"]
    assert uv.kind == "manager"


def test_git_walk_caps_at_twenty(tmp_path: Path, discover_mod: ModuleType) -> None:
    """The git-root walk stops after 20 ancestors, matching ``skills.py``."""
    current = tmp_path
    (tmp_path / ".git").mkdir()
    for index in range(25):
        current /= f"d{index}"
    current.mkdir(parents=True)
    assert discover_mod.find_git_root(current) is None
    shallow = tmp_path / "d0" / "d1"
    assert discover_mod.find_git_root(shallow) == tmp_path.resolve()


def test_venv_dir_requires_pyvenv_cfg(
    tmp_path: Path, discover_mod: ModuleType, isolated_env: None
) -> None:
    """``venv/`` is listed only when ``pyvenv.cfg`` exists; ``.venv`` always is."""
    project = tmp_path / "proj"
    project.mkdir()
    _touch_exe(project / "venv" / "bin" / "python")
    tags = [c.tag for c in discover_mod._iter_candidates(project, python_flag=None)]
    assert "venv-local" not in tags

    (project / "venv" / "pyvenv.cfg").write_text("home = x\n", encoding="utf-8")
    tags = [c.tag for c in discover_mod._iter_candidates(project, python_flag=None)]
    assert "venv-local" in tags

    _touch_exe(project / ".venv" / "bin" / "python")
    tags = [c.tag for c in discover_mod._iter_candidates(project, python_flag=None)]
    assert tags.count("venv-local") == 2


def test_duplicate_git_root_venv_is_skipped(
    tmp_path: Path, discover_mod: ModuleType, isolated_env: None
) -> None:
    """When the project dir is the git root, do not emit ``venv-git-root``."""
    project = tmp_path / "proj"
    project.mkdir()
    (project / ".git").mkdir()
    _plant_posix_venv(project / ".venv")
    tags = [c.tag for c in discover_mod._iter_candidates(project, python_flag=None)]
    assert tags == ["venv-local"]


def test_install_advice_prefers_uv_and_is_quoted(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Failure stderr quotes install advice, prefers uv, and never suggests ``source activate``."""
    project = tmp_path / "proj"
    project.mkdir()
    _touch_exe(project / ".venv" / "bin" / "python")
    (project / "uv.lock").write_text("", encoding="utf-8")

    monkeypatch.setattr(
        discover_mod.subprocess, "run", _subprocess_reports_no_streamlit
    )

    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 1
    assert "uv add streamlit" in captured.err
    assert "source " not in captured.err
    assert "activate" not in captured.err
    assert captured.err.strip().endswith(discover_mod._DOCS_URL)
    assert captured.err.startswith("ERROR[NO_STREAMLIT]:")


def test_install_advice_quotes_venv_python_with_space(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Install advice quotes a venv interpreter whose path contains a space."""
    project = tmp_path / "my project"
    project.mkdir()
    python = _touch_exe(project / ".venv" / "bin" / "python")

    monkeypatch.setattr(
        discover_mod.subprocess, "run", _subprocess_reports_no_streamlit
    )

    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 1
    quoted = discover_mod.shlex.quote(str(python))
    assert f"{quoted} -m pip install streamlit" in captured.err


def test_success_stdout_is_one_line_verbose_on_stderr(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Success prints exactly one path on stdout; ``--verbose`` logs the winner on stderr."""
    project = tmp_path / "proj"
    project.mkdir()
    skill = _plant_posix_venv(project / ".venv")
    code = discover_mod.main(["--project-dir", str(project), "--verbose"])
    captured = capsys.readouterr()
    assert code == 0
    assert captured.out.splitlines() == [str(skill.resolve())]
    assert captured.err.startswith("discovered via: venv-local ")
    assert str(project / ".venv" / "bin" / "python") in captured.err


def test_msys_project_dir_on_windows(
    tmp_path: Path,
    discover_mod: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Light MSYS ``/c/...`` paths become ``C:\\...`` on Windows."""
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", True)
    converted = discover_mod._maybe_msys_path("/c/Users/me/app")
    assert converted == "C:\\Users\\me\\app"
    assert discover_mod._maybe_msys_path("/usr/bin") == "/usr/bin"


def test_windows_filesystem_lookup_layout(
    tmp_path: Path,
    discover_mod: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Windows filesystem lookup uses ``Lib\\site-packages\\streamlit``."""
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", True)
    prefix = tmp_path / "venv"
    pkg = prefix / "Lib" / "site-packages" / "streamlit"
    skill = _plant_skill(pkg)
    assert discover_mod._filesystem_lookup(prefix) == pkg
    status, classified = discover_mod._classify_package(pkg)
    assert status == "usable"
    assert classified == skill.resolve()


def test_filesystem_lookup_requires_init_py(
    tmp_path: Path, discover_mod: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A ``streamlit`` directory without ``__init__.py`` is a filesystem miss."""
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", False)
    prefix = tmp_path / "venv"
    pkg = _posix_site_packages(prefix) / "streamlit"
    pkg.mkdir(parents=True)
    assert discover_mod._filesystem_lookup(prefix) is None
    (pkg / "__init__.py").write_text("", encoding="utf-8")
    assert discover_mod._filesystem_lookup(prefix) == pkg


def test_no_project_python_when_nothing_started(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """No candidates at all is ``NO_PROJECT_PYTHON``."""
    project = tmp_path / "proj"
    project.mkdir()
    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 3
    assert captured.err.startswith("ERROR[NO_PROJECT_PYTHON]:")
    assert discover_mod._DOCS_URL in captured.err


def test_subprocess_run_against_planted_venv_skill(tmp_path: Path) -> None:
    """End-to-end: a real project ``.venv`` with a planted skill is discovered."""
    project = tmp_path / "proj"
    project.mkdir()
    venv = _create_venv(project / ".venv")
    skill = _plant_skill(_venv_site_packages(venv) / "streamlit", content="# e2e\n")
    result = _run_discover("--project-dir", str(project), "--verbose")
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [str(skill.resolve())]
    assert "discovered via: venv-local" in result.stderr


def test_subprocess_run_against_project_path_with_space(tmp_path: Path) -> None:
    """Discovery works when the project directory contains a space."""
    project = tmp_path / "my project"
    project.mkdir()
    venv = _create_venv(project / ".venv")
    skill = _plant_skill(_venv_site_packages(venv) / "streamlit")
    result = _run_discover("--project-dir", str(project))
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == str(skill.resolve())


def test_pth_hits_via_subprocess_not_filesystem(tmp_path: Path) -> None:
    """Stage 1 misses site-packages; stage 2 finds Streamlit via a ``.pth`` file."""
    project = tmp_path / "proj"
    project.mkdir()
    venv = _create_venv(project / ".venv")
    site_packages = _venv_site_packages(venv)
    ext = project / "editable_src"
    skill = _plant_skill(ext / "streamlit")
    (site_packages / "discover_editable.pth").write_text(
        str(ext.resolve()) + "\n", encoding="utf-8"
    )
    assert not (site_packages / "streamlit").exists()

    result = _run_discover("--project-dir", str(project), "--verbose")
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == str(skill.resolve())
    assert "venv-local" in result.stderr


def test_unusable_filesystem_hit_falls_through_to_subprocess(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A skill-less site-packages tree must still run the interpreter probe."""
    project = tmp_path / "proj"
    project.mkdir()
    _plant_posix_venv(project / ".venv", with_skill=False)
    real_pkg = tmp_path / "real" / "streamlit"
    skill = _plant_skill(real_pkg)

    def fake_run(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            ["python"], 0, stdout=f"STREAMLIT_PKG={real_pkg}\n", stderr=""
        )

    monkeypatch.setattr(discover_mod.subprocess, "run", fake_run)
    code = discover_mod.main(["--project-dir", str(project)])
    captured = capsys.readouterr()
    assert code == 0
    assert captured.out.strip() == str(skill.resolve())


@pytest.mark.skipif(os.name != "nt", reason="Windows venv layout smoke")
def test_windows_filesystem_layout_smoke(tmp_path: Path) -> None:
    """Plant ``Lib\\site-packages`` in a real Windows venv; stage 1 must hit."""
    project = tmp_path / "proj"
    project.mkdir()
    venv = _create_venv(project / ".venv")
    python = venv / "Scripts" / "python.exe"
    assert python.is_file()
    lib_pkg = venv / "Lib" / "site-packages" / "streamlit"
    skill = _plant_skill(lib_pkg)
    result = _run_discover("--project-dir", str(project), "--verbose")
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == str(skill.resolve())
    assert "venv-local" in result.stderr


@pytest.mark.skipif(os.name != "nt", reason="Windows .pth subprocess smoke")
def test_windows_pth_subprocess_smoke(tmp_path: Path) -> None:
    """Do not plant under ``Lib\\site-packages``; hit via ``.venv\\Scripts\\python.exe``."""
    project = tmp_path / "proj"
    project.mkdir()
    venv = _create_venv(project / ".venv")
    site_packages = venv / "Lib" / "site-packages"
    ext = project / "editable_src"
    skill = _plant_skill(ext / "streamlit")
    (site_packages / "discover_editable.pth").write_text(
        str(ext.resolve()) + "\n", encoding="utf-8"
    )
    result = _run_discover("--project-dir", str(project), "--verbose")
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == str(skill.resolve())
    python = venv / "Scripts" / "python.exe"
    assert str(python) in result.stderr or python.name.lower() in result.stderr.lower()


def test_posix_prefers_skill_bearing_python_tree(
    tmp_path: Path, discover_mod: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    """If several ``lib/python*`` trees exist, prefer one that already has the skill."""
    monkeypatch.setattr(discover_mod, "_IS_WINDOWS", False)
    prefix = tmp_path / "venv"
    old_pkg = _posix_site_packages(prefix, "python3.10") / "streamlit"
    old_pkg.mkdir(parents=True)
    (old_pkg / "__init__.py").write_text("", encoding="utf-8")
    new_pkg = _posix_site_packages(prefix, "python3.12") / "streamlit"
    _plant_skill(new_pkg)
    assert discover_mod._filesystem_lookup(prefix) == new_pkg


def test_tilde_project_dir_expands(
    tmp_path: Path,
    discover_mod: ModuleType,
    isolated_env: None,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """``--project-dir ~/...`` expands using ``HOME`` / ``USERPROFILE``."""
    home = tmp_path / "home"
    project = home / "proj"
    project.mkdir(parents=True)
    skill = _plant_posix_venv(project / ".venv")
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("USERPROFILE", str(home))
    code = discover_mod.main(["--project-dir", os.path.join("~", "proj")])
    captured = capsys.readouterr()
    assert code == 0
    assert captured.out.strip() == str(skill.resolve())
