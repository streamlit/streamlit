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

# ruff: noqa: T201 - standalone CLI script: printing to stdout/stderr is its interface.

"""Discover the Streamlit package's bundled agent-skills SKILL.md.

Usage:
    python scripts/discover.py [--project-dir PATH] [--python PATH]

Agents run this script on the user's machine to find the skill that ships
inside the user's installed Streamlit. It must never cause trouble there, so it:

- Never imports or installs Streamlit, and never creates, syncs, or changes an
  environment. Each candidate interpreter re-runs this file with ``--probe``,
  which only asks ``importlib.util.find_spec`` where ``streamlit`` would be
  imported from. The first interpreter that has Streamlit decides.
- Writes nothing (not even bytecode caches), uses no network, shows no dialogs,
  and turns off the auto-install behavior of Python launchers (Windows install
  manager, mise). The only other tool it runs is Poetry, read-only.
- Keeps searching when an interpreter is missing, broken, or slow, and reads a
  broken environment's ``site-packages`` from disk instead, within a time limit.
- Explains every failure on stderr, with next steps for the agent.

Keep this file compatible with Python 3.8, below Streamlit's own minimum. Agents
may launch it with an old system Python (macOS's built-in python3 is 3.9), and
it re-runs itself under each project interpreter, so newer syntax would make it
crash or misreport old environments as broken.

Exit codes:
    0 - success; prints the absolute path to the bundled SKILL.md on stdout.
    1 - Streamlit is not installed in any interpreter that could be checked.
    2 - Streamlit is installed but predates bundled skills (no .agents/skills/).
    3 - no Python interpreter could be checked.
    4 - .agents/skills/ exists but the expected developing-with-streamlit/SKILL.md
        is missing from the documented sub-path (likely upstream restructured).
        The agent should read the listed available skills directly.
    5 - invalid script argument.
    6 - unexpected internal error.

On non-zero exit, a human-readable "ERROR:" block is printed on stderr.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import shutil
import subprocess  # noqa: S404 - runs the project's own interpreters and Poetry.
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterator

_IS_WINDOWS = os.name == "nt"
_SKILL_PARTS = (".agents", "skills", "developing-with-streamlit", "SKILL.md")
_FIRST_VERSION_WITH_SKILLS = "1.57"
# Streamlit releases with the bundled skill need at least this Python.
_MIN_PYTHON_WITH_SKILLS = (3, 10)
_DOCS_URL = "https://docs.streamlit.io/llms-full.txt"
_PROBE_FLAG = "--probe"
_PROBE_MARKER = "STREAMLIT_DISCOVER_PROBE="
# Short enough that the whole search, including a killed probe's cleanup,
# ends before the 10-second default timeout of Codex's shell tool. A typical
# search takes well under a second, and a slow interpreter's site-packages is
# still read from disk.
_PROBE_TIMEOUT_S = 5
_TOTAL_TIMEOUT_S = 7
# `venv`, `env`, and `.conda` count only when they contain their marker: the
# first two are also common source-folder names, and `~/.conda` is conda's
# settings folder.
_ENV_DIRS = (
    (".venv", ""),
    ("venv", "pyvenv.cfg"),
    ("env", "pyvenv.cfg"),
    (".conda", "conda-meta"),
    (".pixi/envs/default", ""),
)
_CHILD_ENV_OVERRIDES = {
    # Startup `.pth` files import site-packages modules; never write their caches.
    "PYTHONDONTWRITEBYTECODE": "1",
    "PYTHONIOENCODING": "utf-8",
    "NO_COLOR": "1",
    # With no runtime installed, the Windows install manager's `py` and
    # `python` download and install one.
    "PYTHON_MANAGER_AUTOMATIC_INSTALL": "false",
    # mise shims install missing tool versions on first use.
    "MISE_AUTO_INSTALL": "false",
    "MISE_EXEC_AUTO_INSTALL": "false",
    "MISE_NOT_FOUND_AUTO_INSTALL": "false",
}
_PATH_LAUNCHERS = (
    (("py", "-3"), ("python",), ("python3",))
    if _IS_WINDOWS
    else (("python3",), ("python",))
)
_COMMAND_LINE_TOOLS_DIR = "/Library/Developer/CommandLineTools"
_CONDA_INSTALL_DIRS = (
    "miniforge3",
    "miniconda3",
    "anaconda3",
    "mambaforge",
    "micromamba",
)
_INSTALL_COMMANDS = (
    ("uv.lock", "uv add"),
    ("poetry.lock", "poetry add"),
    ("Pipfile", "pipenv install"),
    ("pdm.lock", "pdm add"),
    ("pixi.toml", "pixi add"),
)


@dataclass
class _Candidate:
    """A Python environment to check for Streamlit."""

    label: str
    # Interpreter command, or None when the environment has no runnable one.
    command: list[str] | None
    # Environment folder, used to check site-packages on disk and pick install advice.
    env_root: Path | None = None
    # Why running this interpreter could cause trouble; such a candidate never runs.
    skip_reason: str = ""


@dataclass
class _Result:
    """What checking one candidate found."""

    # "found", "missing" (ran without Streamlit), "failed", or "skipped" (not run).
    status: str
    detail: str = ""
    package_dir: Path | None = None
    version: str = ""
    # The interpreter's "major.minor" version, when it ran.
    python: str = ""
    # Streamlit was read from site-packages because the interpreter could not run.
    from_disk: bool = False


def _locate_streamlit() -> dict[str, str]:
    """Return where this interpreter would import Streamlit from, without importing it."""
    from importlib.util import find_spec

    info = {"python": f"{sys.version_info[0]}.{sys.version_info[1]}"}
    spec = find_spec("streamlit")
    # A stray `streamlit.py` or a folder without `__init__.py` is not the package.
    if (
        spec is None
        or spec.origin is None
        or spec.submodule_search_locations is None
        or os.path.basename(spec.origin) != "__init__.py"
    ):
        return info
    info["package_dir"] = os.path.dirname(os.path.abspath(spec.origin))
    # The version only improves error messages, so any metadata problem is ignored.
    with contextlib.suppress(Exception):
        from importlib.metadata import version

        info["version"] = version("streamlit")
    return info


def _run(
    command: list[str], cwd: Path, deadline: float
) -> subprocess.CompletedProcess[str] | _Result:
    """Run a command without input, or return a _Result saying why it could not."""
    timeout = min(_PROBE_TIMEOUT_S, deadline - time.monotonic())
    if timeout <= 0:
        reason = f"not run: the {_TOTAL_TIMEOUT_S}-second search limit was reached"
        return _Result("skipped", reason)
    env = dict(os.environ, **_CHILD_ENV_OVERRIDES)
    # A PYTHONHOME meant for one interpreter breaks every other interpreter.
    env.pop("PYTHONHOME", None)
    try:
        process = subprocess.Popen(  # noqa: S603 - fixed arguments, detected executables.
            command,
            cwd=cwd,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            # Keeps Windows from opening a console window for each probe when
            # the agent has none.
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, ValueError) as exc:
        return _Result("failed", f"could not be started: {exc}")
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        # Unlike `subprocess.run`, never wait without a limit for the pipes to
        # close: on Windows, a `.bat` shim's own child can keep them open.
        with contextlib.suppress(subprocess.TimeoutExpired):
            process.communicate(timeout=1)
        return _Result("failed", f"did not answer within {timeout:.3g}s")
    return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)


def _read_lines(path: Path) -> list[str]:
    with contextlib.suppress(OSError):
        if os.path.isfile(path):
            return path.read_text(encoding="utf-8", errors="replace").splitlines()
    return []


def _first_line(path: Path) -> str:
    """Return the first non-empty line of a small text file, or ``""``."""
    return next((line.strip() for line in _read_lines(path) if line.strip()), "")


def _last_line(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[-1] if lines else ""


def _parse_probe_output(stdout: str) -> dict[str, str] | None:
    # Startup hooks (sitecustomize, .pth files) can print too, so only the
    # last marker line counts.
    lines = [line for line in stdout.splitlines() if line.startswith(_PROBE_MARKER)]
    try:
        info = json.loads(lines[-1][len(_PROBE_MARKER) :])
    except (IndexError, ValueError):
        return None
    if not isinstance(info, dict):
        return None
    return {str(key): str(value) for key, value in info.items()}


def _command_key(command: list[str]) -> tuple[str, ...]:
    """Identify an interpreter command, to check each one only once.

    Symlinks stay unresolved: a venv's `bin/python` links to its base
    interpreter but has other packages.
    """
    return (os.path.normcase(os.path.abspath(command[0])), *command[1:])


def _probe(python: list[str], project_dir: Path, deadline: float) -> _Result:
    """Ask an interpreter where Streamlit is installed."""
    if _command_key(python) == _command_key([sys.executable]):
        # The running interpreter answers in-process, without a child process.
        info = _locate_streamlit()
    else:
        command = [*python, os.path.abspath(__file__), _PROBE_FLAG]
        completed = _run(command, project_dir, deadline)
        if isinstance(completed, _Result):
            return completed
        parsed = _parse_probe_output(completed.stdout)
        if parsed is None:
            output = (
                _last_line(completed.stderr)
                or _last_line(completed.stdout)
                or "no output"
            )
            return _Result(
                "failed", f"exited with code {completed.returncode}: {output}"
            )
        info = parsed
    python_version = info.get("python", "")
    if not info.get("package_dir"):
        detail = "ran, but Streamlit is not installed"
        return _Result("missing", detail, python=python_version)
    package_dir = Path(info["package_dir"])
    if not os.path.isdir(package_dir):
        # For example, a Windows interpreter run from WSL reports a Windows path.
        detail = f"reported a Streamlit path that does not exist: {package_dir}"
        return _Result("failed", detail)
    version = info.get("version", "")
    return _Result(
        "found", package_dir=package_dir, version=version, python=python_version
    )


def _site_packages_streamlit(env_root: Path) -> Path | None:
    """Find Streamlit in an environment's site-packages without running Python."""
    packages = [
        path
        for path in (
            env_root / "Lib" / "site-packages" / "streamlit",
            *sorted(env_root.glob("lib/*/site-packages/streamlit")),
        )
        if os.path.isfile(path / "__init__.py")
    ]
    # A venv upgraded in place can keep an older Python's site-packages.
    with_skill = [
        path for path in packages if os.path.isfile(path.joinpath(*_SKILL_PARTS))
    ]
    return next(iter(with_skill or packages), None)


def _check(candidate: _Candidate, project_dir: Path, deadline: float) -> _Result:
    """Probe a candidate, reading its site-packages from disk when it cannot run."""
    if candidate.skip_reason:
        result = _Result("skipped", f"not run: {candidate.skip_reason}")
    elif candidate.command is None:
        result = _Result("failed", "has no Python executable (deleted or broken)")
    else:
        result = _probe(candidate.command, project_dir, deadline)
    # A broken interpreter (for example, a venv whose base Python was upgraded
    # or removed) can still have a usable package on disk.
    if result.status in {"failed", "skipped"} and candidate.env_root is not None:
        package_dir = _site_packages_streamlit(candidate.env_root)
        if package_dir is not None:
            detail = f"{result.detail}; read Streamlit from its site-packages instead"
            return _Result("found", detail, package_dir=package_dir, from_disk=True)
    return result


def _env_candidate(label: str, env_root: Path) -> _Candidate:
    """Return a candidate for a venv, conda, pixi, or pyenv environment folder."""
    names = (
        ("Scripts/python.exe", "python.exe")
        if _IS_WINDOWS
        else ("bin/python", "bin/python3")
    )
    python = next((env_root / n for n in names if os.path.isfile(env_root / n)), None)
    return _Candidate(label, [str(python)] if python else None, env_root)


def _python_candidate(label: str, python: Path) -> _Candidate:
    """Return a candidate for an interpreter, with its environment folder if any."""
    python = Path(os.path.abspath(python))
    in_bin = python.parent.name in {"bin", "Scripts"}
    root = python.parent.parent if in_bin else python.parent
    is_env = os.path.isfile(root / "pyvenv.cfg") or os.path.isdir(root / "conda-meta")
    return _Candidate(label, [str(python)], root if is_env else None)


def _which(name: str) -> str | None:
    """Find a command on PATH only, unlike ``shutil.which`` on Windows.

    For a bare name, Windows also searches the current directory first, which
    would run a project's own `python.bat` or `poetry.cmd` as if it were
    installed. A path the caller gives is used as given.
    """
    found = shutil.which(name)
    if found and _IS_WINDOWS and not os.path.dirname(name):
        folder = os.path.normcase(os.path.dirname(os.path.abspath(found)))
        path_dirs = os.environ.get("PATH", "").split(os.pathsep)
        on_path = {os.path.normcase(os.path.abspath(d)) for d in path_dirs if d}
        if folder not in on_path:
            return None
    return found


def _macos_install_dialog_reason(executable: str) -> str:
    """Explain why running ``executable`` would open a macOS installer dialog, if it would.

    Without the Command Line Tools, ``/usr/bin/python3`` is a stub that asks
    the user to install them instead of running.
    """
    if sys.platform != "darwin" or not executable.startswith("/usr/bin/"):
        return ""
    developer_dir = os.environ.get("DEVELOPER_DIR") or os.path.realpath(
        "/var/db/xcode_select_link"
    )
    for tools_dir in (developer_dir, _COMMAND_LINE_TOOLS_DIR):
        if os.path.exists(os.path.join(tools_dir, "usr", "bin", "python3")):
            return ""
    return "macOS would ask the user to install the Command Line Tools"


def _search_dirs(project_dir: Path) -> list[Path]:
    """Return the project directory, its parent, and any parents up to the git root."""
    ancestors = [project_dir, *project_dir.parents]
    for i, path in enumerate(ancestors):
        if os.path.exists(path / ".git"):
            return ancestors[: max(i + 1, 2)]
    return ancestors[:2]


def _canonical_path(path: str | Path) -> str:
    return os.path.normcase(os.path.realpath(os.path.expanduser(str(path))))


def _project_environments(dirs: list[Path], project_dir: Path) -> Iterator[_Candidate]:
    """Yield uv's selected environment, then those in the project and its parents."""
    # uv uses this instead of `.venv`, which may be stale or belong to another
    # OS (a dev container sees the host's `.venv`).
    uv_environment = os.environ.get("UV_PROJECT_ENVIRONMENT")
    if uv_environment:
        env_root = project_dir / os.path.expanduser(uv_environment)
        yield _env_candidate("$UV_PROJECT_ENVIRONMENT", env_root)
    for directory in dirs:
        for name, marker in _ENV_DIRS:
            env_root = directory / name
            if os.path.isdir(env_root) and (
                not marker or os.path.exists(env_root / marker)
            ):
                yield _env_candidate(name, env_root)
        # PDM records the interpreter it uses, which may live outside the project.
        pdm_python = _first_line(directory / ".pdm-python")
        if pdm_python:
            yield _python_candidate(".pdm-python", Path(pdm_python))


def _conda_env_name(directory: Path) -> str:
    """Return the environment name from a conda ``environment.yml``, or ``""``."""
    for filename in ("environment.yml", "environment.yaml"):
        for line in _read_lines(directory / filename):
            if line.startswith("name:"):
                return line[len("name:") :].split("#")[0].strip().strip("\"'")
    return ""


def _recorded_environments(dirs: list[Path]) -> Iterator[_Candidate]:
    """Yield environments that tools keep outside the project, by reading files only.

    Agent shells rarely activate these. It never runs conda, pyenv, or Pipenv,
    because some of them write to the user's home directory even to report a path.
    """
    home = Path(os.path.expanduser("~"))
    conda_exe = os.environ.get("CONDA_EXE")
    conda_bases = [Path(conda_exe).parent.parent] if conda_exe else []
    conda_bases.append(Path(os.environ.get("MAMBA_ROOT_PREFIX") or home / "micromamba"))
    conda_bases += [home / name for name in _CONDA_INSTALL_DIRS]
    envs_dirs = [base / "envs" for base in conda_bases] + [home / ".conda" / "envs"]
    pyenv_root = Path(os.environ.get("PYENV_ROOT") or home / ".pyenv")
    pyenv_roots = [pyenv_root, home / ".pyenv" / "pyenv-win"]

    for directory in dirs:
        # Conda and mamba: `environment.yml` names an environment in an envs folder.
        name = _conda_env_name(directory)
        if name:
            for envs_dir in envs_dirs:
                if os.path.isdir(envs_dir / name):
                    yield _env_candidate(f"conda environment {name!r}", envs_dir / name)
        # pyenv and pyenv-win: `.python-version` names a version or virtualenv.
        version = _first_line(directory / ".python-version")
        if version:
            for root in pyenv_roots:
                if os.path.isdir(root / "versions" / version):
                    label = f"pyenv {version!r}"
                    yield _env_candidate(label, root / "versions" / version)

    # Pipenv and virtualenvwrapper record each environment's project in `.project`.
    project_dirs = {_canonical_path(directory) for directory in dirs}
    data_home = os.environ.get("XDG_DATA_HOME") or str(home / ".local" / "share")
    workon_homes = [os.environ.get("WORKON_HOME") or ""]
    workon_homes += [os.path.join(data_home, "virtualenvs"), str(home / ".virtualenvs")]
    for workon_home in dict.fromkeys(filter(None, workon_homes)):
        projects = Path(os.path.expanduser(workon_home)).glob("*/.project")
        for project_file in sorted(projects):
            recorded = _first_line(project_file)
            if recorded and _canonical_path(recorded) in project_dirs:
                yield _env_candidate("Pipenv environment", project_file.parent)


def _poetry_environment(dirs: list[Path], deadline: float) -> Iterator[_Candidate]:
    """Yield the Poetry environment, which lives in a cache folder under a hashed name."""
    poetry_dir = next((d for d in dirs if os.path.isfile(d / "poetry.lock")), None)
    poetry = _which("poetry")
    if poetry_dir is None or poetry is None:
        return
    # `env info --path` only reads, unlike `poetry run`, which can create an
    # environment. Plugins are off because they run for every command.
    command = [poetry, "--no-plugins", "--no-interaction", "env", "info", "--path"]
    completed = _run(command, poetry_dir, deadline)
    if isinstance(completed, _Result) or completed.returncode:
        return
    path = _last_line(completed.stdout)
    if path and os.path.isdir(path):
        yield _env_candidate("Poetry environment", Path(path))


def _active_and_path_interpreters() -> Iterator[_Candidate]:
    """Yield activated environments, this script's interpreter, and PATH Pythons."""
    for variable in ("VIRTUAL_ENV", "CONDA_PREFIX"):
        value = os.environ.get(variable)
        if value:
            yield _env_candidate(f"${variable}", Path(value))
    if sys.executable:
        yield _python_candidate("Python running this script", Path(sys.executable))
    for launcher in _PATH_LAUNCHERS:
        # Full paths let Windows run `.bat`/`.cmd` shims (for example, pyenv-win).
        executable = _which(launcher[0])
        if executable is not None:
            yield _Candidate(
                f"{launcher[0]} on PATH",
                [executable, *launcher[1:]],
                skip_reason=_macos_install_dialog_reason(executable),
            )


def _candidates(project_dir: Path, deadline: float) -> Iterator[_Candidate]:
    """Yield interpreters to check, most project-specific first.

    1. ``$UV_PROJECT_ENVIRONMENT``, then environments in the project directory
       and its parents, up to the git root.
    2. Environments that conda, pyenv, Pipenv, and Poetry record for the project.
    3. ``$VIRTUAL_ENV`` and ``$CONDA_PREFIX``. They come late because agent
       shells often have the agent's own environment activated.
    4. This script's interpreter, then the Pythons on ``PATH``.

    The generator is lazy, so later lookups run only when earlier candidates
    lack Streamlit.
    """
    dirs = _search_dirs(project_dir)
    sections = (
        _project_environments(dirs, project_dir),
        _recorded_environments(dirs),
        _poetry_environment(dirs, deadline),
        _active_and_path_interpreters(),
    )
    for section in sections:
        # A lookup that fails (for example, on a folder the user cannot read)
        # skips only the rest of its own section.
        with contextlib.suppress(Exception):
            yield from section


def _display_command(command: list[str]) -> str:
    # Forward slashes work in every shell; PowerShell needs `& ` before a quoted
    # executable, which _install_command points out.
    executable = command[0].replace("\\", "/") if _IS_WINDOWS else command[0]
    if " " in executable:
        executable = f'"{executable}"'
    return " ".join([executable, *command[1:]])


def _describe(candidate: _Candidate) -> str:
    command = candidate.command
    where = _display_command(command) if command else str(candidate.env_root)
    return f"{candidate.label} ({where})"


def _manager_install_command(project_dir: Path, requirement: str) -> str | None:
    """Return the project's package-manager command that adds ``requirement``."""
    for directory in _search_dirs(project_dir):
        for manifest, command in _INSTALL_COMMANDS:
            if os.path.isfile(directory / manifest):
                return f"{command} {requirement}"
    return None


def _install_command(candidate: _Candidate, project_dir: Path, requirement: str) -> str:
    """Return a command that adds ``requirement`` the way the project manages packages."""
    manager_command = _manager_install_command(project_dir, requirement)
    if manager_command is not None:
        return manager_command
    env_root = candidate.env_root
    if env_root is not None and os.path.isdir(env_root / "conda-meta"):
        return f'conda install --prefix "{env_root}" -c conda-forge {requirement}'
    python = _display_command(candidate.command or ["python"])
    pyvenv_cfg = env_root / "pyvenv.cfg" if env_root is not None else None
    notes = []
    if pyvenv_cfg is None or not os.path.isfile(pyvenv_cfg):
        command = f"{python} -m pip install {requirement}"
        notes.append(
            "this is not a virtual environment; creating one for the project "
            "first is better"
        )
    elif any(line.startswith("uv =") for line in _read_lines(pyvenv_cfg)):
        # Environments created by `uv venv` have no pip.
        command = f"uv pip install --python {python} {requirement}"
    else:
        command = f"{python} -m pip install {requirement}"
    if _IS_WINDOWS and command.startswith('"'):
        notes.append("in PowerShell, put `& ` before the quoted path")
    return "\n".join([command, *(f"     ({note})" for note in notes)])


def _print_error(
    headline: str,
    why: str,
    steps: list[str],
    attempts: list[tuple[_Candidate, _Result]],
    details: list[str] | None = None,
) -> None:
    """Print what went wrong, why, and what the agent can do next."""
    docs = (
        "Otherwise, continue without the bundled skill and use the complete "
        "Streamlit documentation, formatted for LLMs (latest release, not matched "
        f"to the installed version): {_DOCS_URL}"
    )
    lines = [f"ERROR: {headline}", "", f"Why: {why}"]
    if details:
        lines += ["", *details]
    lines += ["", "Next steps:"]
    lines += [f"  {i}. {step}" for i, step in enumerate([*steps, docs], 1)]
    if attempts:
        lines += ["", "Checked, in order:"]
        lines += [
            f"  - {_describe(candidate)}: "
            + (result.detail or f"Streamlit {result.version}".strip())
            for candidate, result in attempts
        ]
    print("\n".join(lines), file=sys.stderr)


def _ask_first(action: str, command: str) -> str:
    """Return a next step the agent may take only with the user's consent."""
    return (
        f"Only if the user asked for it or agrees, {action}, then re-run this "
        f"script:\n     {command}"
    )


def _install_step(
    result: _Result, candidate: _Candidate, project_dir: Path, *, upgrade: bool
) -> str:
    """Return the step that gets a Streamlit release with the bundled skill."""
    with contextlib.suppress(ValueError):
        python = tuple(int(part) for part in result.python.split("."))
        if python < _MIN_PYTHON_WITH_SKILLS:
            return (
                f"This environment uses Python {result.python}, and Streamlit "
                "releases with the bundled skill need Python 3.10 or newer. Only "
                "if the user agrees, recreate the project's environment with a "
                "newer Python and install Streamlit in it, then re-run this script."
            )
    requirement = (
        f'"streamlit>={_FIRST_VERSION_WITH_SKILLS}"' if upgrade else "streamlit"
    )
    # Installing with another Python would not fix an environment that cannot run.
    if result.from_disk and _manager_install_command(project_dir, requirement) is None:
        return (
            "This environment's Python could not be run (see below), so nothing "
            "can be installed into it. Only if the user agrees, repair or recreate "
            f"it with Streamlit {_FIRST_VERSION_WITH_SKILLS} or newer, then re-run "
            "this script."
        )
    action = "upgrade Streamlit" if upgrade else "install Streamlit"
    return _ask_first(action, _install_command(candidate, project_dir, requirement))


def _report_found(
    package_dir: Path, attempts: list[tuple[_Candidate, _Result]], project_dir: Path
) -> int:
    """Print the bundled SKILL.md path, or explain why this Streamlit has none."""
    candidate, result = attempts[-1]
    package_dir = Path(os.path.realpath(package_dir))
    skill = package_dir.joinpath(*_SKILL_PARTS)
    location = [f"Environment: {_describe(candidate)}", f"Streamlit: {package_dir}"]
    if os.path.isfile(skill):
        print(skill)
        if result.from_disk:
            print(
                f"NOTE: {_describe(candidate)} {result.detail}. The skill is usable, "
                "but the environment may need repair before the app can run.",
                file=sys.stderr,
            )
        return 0

    skills_dir = package_dir / ".agents" / "skills"
    if os.path.isdir(skills_dir):
        available = sorted(skills_dir.glob("*/SKILL.md"))
        _print_error(
            "Streamlit's bundled skills folder has no "
            "developing-with-streamlit/SKILL.md.",
            "This Streamlit release organizes its bundled skills differently than "
            "this script expects; the script is probably older than the installed "
            "Streamlit. Re-running it will not help.",
            [
                "Read whichever SKILL.md listed above best matches the task.",
                (
                    "To update this script, the user can re-run "
                    "`streamlit skills --global`."
                ),
            ],
            attempts,
            [*location, "Bundled skills:", *(f"  {path}" for path in available)],
        )
        return 4

    version = f"Streamlit {result.version}" if result.version else "Streamlit"
    _print_error(
        f"{version} is installed but predates bundled skills "
        f"(added in {_FIRST_VERSION_WITH_SKILLS}).",
        "The skill ships inside the Streamlit package, and this installed version "
        "has none. Re-running this script will not help until Streamlit is upgraded.",
        [_install_step(result, candidate, project_dir, upgrade=True)],
        attempts,
        location,
    )
    return 2


def _from_msys_path(raw: str) -> str:
    """Turn a Git Bash path such as ``/c/Users/me`` into ``C:/Users/me`` on Windows."""
    if (
        _IS_WINDOWS
        and len(raw) >= 2
        and raw[0] == "/"
        and raw[1].isalpha()
        and (len(raw) == 2 or raw[2] == "/")
    ):
        return f"{raw[1].upper()}:/{raw[3:]}"
    return raw


def _expand(raw: str) -> Path:
    """Turn a path argument as agents pass it (quoted, ``~``, variables) into a Path."""
    raw = raw.strip().strip("\"'")
    return Path(_from_msys_path(os.path.expandvars(os.path.expanduser(raw))))


def _resolve_project_dir(raw: str | None) -> Path:
    """Return the project directory, falling back to the cwd with a warning.

    Agents sometimes pass a placeholder their harness did not expand (such as
    ``${CLAUDE_PROJECT_DIR}``), which should not end the search.
    """
    cwd = Path.cwd()
    if raw is None:
        return cwd
    if raw.strip() and os.path.isdir(_expand(raw)):
        return _expand(raw).resolve()
    print(
        f"WARNING: --project-dir {raw!r} is not a directory, so the current "
        f"directory is searched instead: {cwd}",
        file=sys.stderr,
    )
    return cwd


def _report_invalid_arguments(problem: str) -> int:
    _print_error(
        f"Invalid arguments: {problem}",
        "The command line is wrong, so nothing was checked.",
        [
            (
                "Fix the arguments and re-run, or leave out --python to search the "
                "project's environments automatically."
            )
        ],
        [],
    )
    return 5


def _report_not_found(
    attempts: list[tuple[_Candidate, _Result]], project_dir: Path
) -> int:
    """Explain why no interpreter had Streamlit, and return the exit code."""
    failed = [c.label for c, r in attempts if r.status in {"failed", "skipped"}]
    fix_failed = (
        f"Some environments could not be checked ({', '.join(failed)}). If one of "
        "them runs the app, fixing it may resolve this, but only with the user's "
        "agreement."
    )
    missing = next(((c, r) for c, r in attempts if r.status == "missing"), None)
    if missing is not None:
        candidate, result = missing
        steps = [_install_step(result, candidate, project_dir, upgrade=False)]
        steps += [fix_failed] if failed else []
        steps.append(
            "If Streamlit is installed in an environment that is not listed, "
            "re-run this script with --python <path to that environment's Python>."
        )
        _print_error(
            "Streamlit is not installed in any Python environment found for this "
            "project.",
            "The interpreters that ran cannot import `streamlit`, so there is no "
            "bundled skill to read. Re-running this script will give the same "
            "result until Streamlit is installed.",
            steps,
            attempts,
        )
        return 1

    if not attempts:  # pragma: no cover - only when sys.executable is empty.
        _print_error(
            "No Python interpreter was found.",
            "There is no project environment and no Python on PATH.",
            ["Only if the user agrees, install Python 3.11+ and Streamlit."],
            [],
        )
        return 3
    _print_error(
        "Could not run any Python interpreter found for this project.",
        "Each interpreter listed below failed to start or to answer, or was not "
        "run on purpose, so it is unknown whether Streamlit is installed. This is "
        "a problem with those environments, not a missing package. Re-running "
        "this script only helps if the failure was temporary, such as a timeout.",
        [
            (
                "If you know which Python runs the app, re-run this script with "
                "--python <path to it>."
            ),
            fix_failed,
        ],
        attempts,
    )
    return 3


def _discover(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Discover the bundled developing-with-streamlit SKILL.md.",
    )
    # `nargs="?"`: Windows PowerShell 5.1 drops an empty "" argument, such as
    # an unexpanded "${CLAUDE_PROJECT_DIR}", which leaves the flag without a value.
    parser.add_argument(
        "--project-dir",
        nargs="?",
        const="",
        help="Absolute path to the user's project directory. Defaults to cwd.",
    )
    parser.add_argument("--python", help="Only check this Python interpreter.")
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        if not exc.code:
            return 0
        return _report_invalid_arguments("see the usage message above.")

    deadline = time.monotonic() + _TOTAL_TIMEOUT_S
    project_dir = _resolve_project_dir(args.project_dir)
    if args.python is not None:
        python = _expand(args.python)
        found = str(python) if os.path.isfile(python) else _which(str(python))
        if found is None:
            return _report_invalid_arguments(
                f"--python {args.python!r} is not a file or a command on PATH."
            )
        candidate = _python_candidate("--python", Path(found))
        candidate.skip_reason = _macos_install_dialog_reason(os.path.abspath(found))
        candidates = iter([candidate])
    else:
        candidates = _candidates(project_dir, deadline)

    attempts: list[tuple[_Candidate, _Result]] = []
    seen: set[tuple[str, ...]] = set()
    for candidate in candidates:
        key = _command_key(candidate.command or [str(candidate.env_root)])
        if key in seen:
            continue
        seen.add(key)
        try:
            result = _check(candidate, project_dir, deadline)
        except Exception as exc:
            # One unreadable or unusual environment must not end the search.
            result = _Result("failed", f"could not be checked: {exc!r}")
        attempts.append((candidate, result))
        if result.package_dir is not None:
            return _report_found(result.package_dir, attempts, project_dir)
    return _report_not_found(attempts, project_dir)


def _prepare_process() -> None:
    """Print UTF-8 everywhere, and keep Windows from showing error dialogs."""
    # Agent harnesses decode output as UTF-8.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            with contextlib.suppress(OSError, ValueError):
                reconfigure(encoding="utf-8")
    if _IS_WINDOWS:
        # Child processes inherit this, so a broken interpreter (for example,
        # one missing a DLL) fails instead of opening a modal dialog.
        with contextlib.suppress(Exception):
            import ctypes

            fail_critical_errors, no_gp_fault_box, no_open_file_box = 0x1, 0x2, 0x8000
            ctypes.windll.kernel32.SetErrorMode(  # type: ignore[attr-defined]
                fail_critical_errors | no_gp_fault_box | no_open_file_box
            )


def main(argv: list[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if arguments == [_PROBE_FLAG]:
        # JSON escapes non-ASCII characters, so the parent can read the result
        # whatever this interpreter's output encoding is.
        print(_PROBE_MARKER + json.dumps(_locate_streamlit()))
        return 0
    _prepare_process()
    try:
        return _discover(arguments)
    except Exception as exc:
        _print_error(
            f"Unexpected error in discover.py: {exc!r}",
            "This is a bug in the script, not a problem with the user's setup. "
            "Re-running it will most likely fail the same way.",
            [
                (
                    "Read the bundled skill directly from the project's virtual "
                    "environment: .venv/Lib/site-packages/streamlit/.agents/skills/"
                    "developing-with-streamlit/SKILL.md (Windows) or "
                    ".venv/lib/python3.*/site-packages/streamlit/.agents/skills/"
                    "developing-with-streamlit/SKILL.md (macOS and Linux)."
                )
            ],
            [],
        )
        return 6


if __name__ == "__main__":
    sys.exit(main())
