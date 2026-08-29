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

Usage::

    python scripts/discover.py [--project-dir PATH] [--python EXECUTABLE] [--verbose]

When ``--project-dir`` is given, the script resolves project virtualenvs and
lockfiles relative to that path. Unexpanded ``${...}`` placeholders and missing
paths warn and fall back to the current working directory. When it is omitted,
``CLAUDE_PROJECT_DIR`` then ``CURSOR_PROJECT_DIR`` are used if they name an
existing directory (so a shell whose cwd is this skill still finds the app).

Exit codes:
    0 - success; prints the absolute path to the bundled SKILL.md on stdout.
    1 - ``ERROR[NO_STREAMLIT]``: inspected interpreters did not have Streamlit.
    2 - ``ERROR[NO_USABLE_SKILL]``: Streamlit was found without a usable bundled skill.
    3 - ``ERROR[NO_PROJECT_PYTHON]``: no interpreter candidate was found.
    4 - ``ERROR[SKILLS_LAYOUT_CHANGED]``: ``.agents/skills/`` exists without the expected file.
    5 - ``ERROR[INVALID_ARGS]``: bad ``--python`` or unknown flags.
    6 - ``ERROR[INTERNAL]``: unexpected exception.
    7 - ``ERROR[PROBE_FAILED]``: candidates were attempted but none were inspected.

On non-zero exit, a human-readable ``ERROR[CODE]`` block is printed on stderr.

Compatibility: stdlib-only. Agents run this file with the project or agent
interpreter, so it must work on every Python version Streamlit currently
supports (see ``requires-python`` in ``lib/pyproject.toml``). Do not add
syntax, stdlib APIs, or interpreter flags newer than that floor — for
example ``python -P`` is 3.11+ and must not be used on the probe child.
"""

from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess  # noqa: S404 - used only to probe the project's own interpreter.
import sys
import time
from dataclasses import dataclass
from enum import IntEnum
from pathlib import Path
from typing import TYPE_CHECKING, Final, Literal, NoReturn

if TYPE_CHECKING:
    from collections.abc import Iterator, Sequence

# Tests patch this instead of ``os.name`` so pathlib keeps the host flavor.
_IS_WINDOWS = os.name == "nt"
_MAX_WALK_DEPTH: Final = 20  # Same cap as skills._MAX_REPO_ROOT_WALK_DEPTH.
_GLOBAL_BUDGET_S: Final = 60.0
_DIRECT_TIMEOUT_S: Final = 10.0
_MANAGER_TIMEOUT_S: Final = 30.0
_SKILL_REL: Final = (
    Path(".agents") / "skills" / "developing-with-streamlit" / "SKILL.md"
)
_DOCS_URL: Final = "https://docs.streamlit.io/llms-full.txt"
_SENTINEL: Final = "STREAMLIT_PKG="
# Workspace dirs published by coding agents. Used when ``--project-dir`` is
# omitted so a shell whose cwd is this skill still finds the user's app.
_PROJECT_DIR_ENV_VARS: Final = ("CLAUDE_PROJECT_DIR", "CURSOR_PROJECT_DIR")

# Child process: locate Streamlit without importing it.
# Keep this snippet valid on every Python Streamlit currently supports.
# - Drop cwd from sys.path; do not use python -P (newer than Streamlit's floor).
# - Parent keeps the last STREAMLIT_PKG= line.
_PROBE_SNIPPET: Final = """\
import importlib.util
import pathlib
import sys
cwd = pathlib.Path(".").resolve()
kept = []
for p in sys.path:
    if not p:
        continue
    try:
        if pathlib.Path(p).resolve() == cwd:
            continue
    except OSError:
        pass
    kept.append(p)
sys.path[:] = kept
spec = importlib.util.find_spec("streamlit")
ok = (
    spec is not None
    and spec.origin
    and spec.submodule_search_locations
    and pathlib.Path(spec.origin).name == "__init__.py"
)
if ok:
    print("STREAMLIT_PKG=" + str(pathlib.Path(spec.origin).resolve().parent))
"""


class _Outcome(IntEnum):
    """CLI exit codes."""

    SUCCESS = 0
    NO_STREAMLIT = 1
    NO_USABLE_SKILL = 2
    NO_PROJECT_PYTHON = 3
    SKILLS_LAYOUT_CHANGED = 4
    INVALID_ARGS = 5
    INTERNAL = 6
    PROBE_FAILED = 7


_ERROR_MESSAGE: Final[dict[_Outcome, str]] = {
    _Outcome.NO_STREAMLIT: (
        "Streamlit is not installed in the inspected Python environment."
    ),
    _Outcome.NO_USABLE_SKILL: (
        "Found Streamlit, but no usable bundled skill. "
        "Upgrade or reinstall Streamlit, or use the docs."
    ),
    _Outcome.NO_PROJECT_PYTHON: "No Python interpreter was found to inspect.",
    _Outcome.SKILLS_LAYOUT_CHANGED: (
        "Streamlit's bundled skills directory exists, but the expected "
        "developing-with-streamlit/SKILL.md is missing from the documented "
        "sub-path. Upstream Streamlit likely reorganized the skill layout."
    ),
    _Outcome.INVALID_ARGS: "Invalid arguments.",
    _Outcome.INTERNAL: "Unexpected error while discovering the bundled skill.",
    _Outcome.PROBE_FAILED: (
        "Could not inspect any interpreter (timeout, stub, or unreadable "
        "output). This does not mean Streamlit is not installed."
    ),
}

_STATUS_TO_OUTCOME: Final[dict[str, _Outcome]] = {
    "no_streamlit": _Outcome.NO_STREAMLIT,
    "no_usable_skill": _Outcome.NO_USABLE_SKILL,
    "layout_changed": _Outcome.SKILLS_LAYOUT_CHANGED,
}
_INSPECTED_STATUSES: Final = frozenset(_STATUS_TO_OUTCOME)


@dataclass(frozen=True)
class _Candidate:
    """One interpreter (or manager wrapper) to inspect, in probe order."""

    tag: str
    argv: list[str]
    kind: Literal["direct", "manager"]
    prefix: Path | None


@dataclass
class _ProbeBudget:
    """Wall-clock budget that charges subprocess time only."""

    remaining: float = _GLOBAL_BUDGET_S

    def timeout_for(self, kind: Literal["direct", "manager"]) -> float:
        """Return the per-probe timeout, capped by remaining budget."""
        cap = _DIRECT_TIMEOUT_S if kind == "direct" else _MANAGER_TIMEOUT_S
        return min(cap, max(0.0, self.remaining))

    def charge(self, elapsed: float) -> None:
        """Subtract elapsed subprocess time from the remaining budget."""
        self.remaining = max(0.0, self.remaining - elapsed)


@dataclass
class _Attempt:
    """One candidate's recorded outcome for the attempt log."""

    tag: str
    display: str
    status: str
    argv: list[str]


class _DiscoverArgumentParser(argparse.ArgumentParser):
    """ArgumentParser whose errors start with ``ERROR[INVALID_ARGS]``."""

    def error(self, message: str) -> NoReturn:
        print(f"ERROR[INVALID_ARGS]: {message}", file=sys.stderr)
        print(_DOCS_URL, file=sys.stderr)
        raise SystemExit(int(_Outcome.INVALID_ARGS))


def _reconfigure_stdio() -> None:
    """Set stdout/stderr encoding to UTF-8; skip streams that cannot be reconfigured."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding="utf-8")
        except (OSError, ValueError):
            # Closed or redirected streams cannot be reconfigured.
            pass


def _maybe_msys_path(raw: str) -> str:
    """Convert a light MSYS path (``/c/foo``) to a Windows drive path."""
    if not _IS_WINDOWS:
        return raw
    if (
        len(raw) >= 2
        and raw[0] == "/"
        and raw[1].isalpha()
        and (len(raw) == 2 or raw[2] == "/")
    ):
        drive = raw[1].upper()
        rest = raw[3:].replace("/", "\\") if len(raw) > 3 else ""
        return f"{drive}:\\{rest}" if rest else f"{drive}:\\"
    return raw


def _expand_user_path(raw: str) -> str:
    """Expand ``~`` and environment variables, then apply light MSYS rewrite."""
    return _maybe_msys_path(os.path.expandvars(os.path.expanduser(raw)))


def _safe_resolve(path: Path) -> Path:
    """Resolve ``path`` when the filesystem allows it; otherwise keep it as-is."""
    try:
        return path.resolve()
    except OSError:
        return path


def _absolute_no_follow(path: Path) -> Path:
    """Return an absolute path without following symlinks.

    ``Path.resolve()`` collapses a venv ``bin/python`` symlink to the base
    interpreter. Prefix inference and candidate dedup must keep the venv path.
    """
    try:
        return Path(os.path.abspath(path))
    except OSError:
        return path


def _iter_ancestors(start: Path) -> Iterator[Path]:
    """Yield ``start`` then each parent, up to ``_MAX_WALK_DEPTH`` levels."""
    current = _safe_resolve(start)
    for _ in range(_MAX_WALK_DEPTH):
        yield current
        parent = current.parent
        if parent == current:
            return
        current = parent


def find_venv_python(venv_root: Path) -> Path | None:
    """Return the venv's Python executable, cross-platform.

    Windows: ``<root>/python.exe`` (conda) then ``<root>/Scripts/python.exe``.
    POSIX: ``<root>/bin/python`` then ``<root>/bin/python3``.
    """
    if _IS_WINDOWS:
        candidates = (venv_root / "python.exe", venv_root / "Scripts" / "python.exe")
    else:
        candidates = (venv_root / "bin" / "python", venv_root / "bin" / "python3")
    return next((path for path in candidates if path.is_file()), None)


def find_git_root(start: Path) -> Path | None:
    """Return the nearest git root at or above ``start``, if within the walk cap.

    Matches ``skills.py``: at most ``_MAX_WALK_DEPTH`` ancestors, and ``.git``
    may be a directory or a file (worktrees).
    """
    return next(
        (path for path in _iter_ancestors(start) if (path / ".git").exists()),
        None,
    )


def _find_lockfile(start: Path, name: str) -> Path | None:
    """Return the nearest ``name`` file at or above ``start``, if within the walk cap."""
    return next(
        (path / name for path in _iter_ancestors(start) if (path / name).is_file()),
        None,
    )


def _prefix_from_python(executable: Path) -> Path | None:
    """Infer an environment prefix from a Python executable path.

    Does not follow symlinks, so a venv ``bin/python`` is not collapsed to
    the base interpreter (and that interpreter's site-packages).
    """
    exe = _absolute_no_follow(executable)
    parent = exe.parent
    if _IS_WINDOWS:
        if parent.name.lower() == "scripts":
            return parent.parent
        if exe.suffix.lower() == ".exe":
            return parent
        return None
    if parent.name == "bin":
        return parent.parent
    return None


def _is_windows_store_alias(executable: Path) -> bool:
    """Return True if ``executable`` is a Windows App Execution Alias stub.

    Only the App Execution Alias directory
    (``%LOCALAPPDATA%/Microsoft/WindowsApps/``) is rejected. Real Store
    Python installs live elsewhere and must not be skipped.
    """
    if not _IS_WINDOWS:
        return False
    local = os.environ.get("LOCALAPPDATA")
    if not local:
        return False
    try:
        alias_dir = (Path(local) / "Microsoft" / "WindowsApps").resolve()
        executable.resolve().relative_to(alias_dir)
    except (OSError, ValueError):
        return False
    return True


def _filesystem_lookup(prefix: Path) -> Path | None:
    """Return a ``streamlit`` package dir under ``prefix``, if one exists.

    Editable installs are a filesystem miss and fall through to the subprocess
    probe. On POSIX, if several ``lib/python*`` trees exist, prefer one that
    already has the skill file.
    """
    if _IS_WINDOWS:
        pkg = prefix / "Lib" / "site-packages" / "streamlit"
        return pkg if (pkg / "__init__.py").is_file() else None
    hits = sorted(prefix.glob("lib/python*/site-packages/streamlit"))
    dirs = [hit for hit in hits if (hit / "__init__.py").is_file()]
    if not dirs:
        return None
    with_skill = [hit for hit in dirs if (hit / _SKILL_REL).is_file()]
    return with_skill[0] if with_skill else dirs[0]


def _classify_package(pkg: Path) -> tuple[str, Path | None]:
    """Return ``(status, skill_path)`` for a Streamlit package directory.

    Status is ``usable``, ``layout_changed``, or ``no_usable_skill``.
    """
    skill = pkg / _SKILL_REL
    if skill.is_file():
        try:
            return "usable", skill.resolve()
        except OSError:
            return "usable", skill
    agents = pkg / ".agents" / "skills"
    if agents.is_dir():
        return "layout_changed", None
    return "no_usable_skill", None


def _is_usable_package_dir(pkg: Path) -> bool:
    """Return True if ``pkg`` looks like the Streamlit package directory."""
    try:
        resolved = pkg.resolve()
    except OSError:
        return False
    if not resolved.is_dir():
        return False
    return (resolved / "__init__.py").is_file()


def _parse_streamlit_pkg(stdout: str) -> Path | None:
    """Return the package dir from the last ``STREAMLIT_PKG=`` line in stdout."""
    last: Path | None = None
    for line in stdout.splitlines():
        stripped = line.strip()
        if stripped.startswith(_SENTINEL):
            value = stripped[len(_SENTINEL) :]
            if value:
                last = Path(value)
    return last


def _probe_env() -> dict[str, str]:
    """Child env: UTF-8 I/O, without inherited ``PYTHONPATH`` / ``PYTHONHOME``."""
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    env.pop("PYTHONPATH", None)
    env.pop("PYTHONHOME", None)
    return env


def _direct_executable(candidate: _Candidate) -> Path | None:
    """Return the filesystem path of a direct interpreter candidate, if any."""
    if candidate.kind != "direct" or not candidate.argv:
        return None
    raw = Path(candidate.argv[0])
    if raw.is_file():
        return raw
    found = shutil.which(candidate.argv[0])
    return Path(found) if found else None


def _iter_candidates(project_dir: Path, python_flag: Path | None) -> list[_Candidate]:
    """Build the ordered candidate list. ``--python`` is exclusive."""
    if python_flag is not None:
        return [
            _Candidate(
                tag="python-flag",
                argv=[str(python_flag)],
                kind="direct",
                prefix=_prefix_from_python(python_flag),
            )
        ]

    out: list[_Candidate] = []
    seen_exes: set[Path] = set()

    def _remember(exe: Path) -> bool:
        key = _absolute_no_follow(exe)
        if key in seen_exes:
            return False
        seen_exes.add(key)
        return True

    def add_path(tag: str, exe: Path, prefix: Path | None) -> None:
        if not _remember(exe):
            return
        out.append(_Candidate(tag=tag, argv=[str(exe)], kind="direct", prefix=prefix))

    def add_venv(tag: str, root: Path) -> None:
        python = find_venv_python(root)
        if python is None:
            return
        add_path(tag, python, root)

    def add_venv_pair(tag: str, base: Path) -> None:
        # ``.venv`` is conventionally a virtualenv. ``venv/`` is a common
        # project folder name, so require PEP 405's pyvenv.cfg.
        add_venv(tag, base / ".venv")
        venv_dir = base / "venv"
        if (venv_dir / "pyvenv.cfg").is_file():
            add_venv(tag, venv_dir)

    # Project venvs come first: agent shells often point $VIRTUAL_ENV at
    # the agent's own environment, not the app's.
    add_venv_pair("venv-local", project_dir)
    parent = project_dir.parent
    if parent != project_dir:
        add_venv_pair("venv-parent", parent)

    git_root = find_git_root(project_dir)
    if git_root is not None and git_root not in {project_dir, parent}:
        add_venv_pair("venv-git-root", git_root)

    virtual_env = os.environ.get("VIRTUAL_ENV")
    if virtual_env:
        root = Path(virtual_env)
        python = find_venv_python(root)
        if python is not None:
            add_path("virtual-env", python, root)

    conda = os.environ.get("CONDA_PREFIX")
    if conda:
        root = Path(conda)
        python = find_venv_python(root)
        if python is not None:
            add_path("conda", python, root)

    sys_exe = Path(sys.executable)
    if sys_exe.is_file():
        add_path("sys-executable", sys_exe, _prefix_from_python(sys_exe))

    managers: tuple[tuple[str, str, list[str]], ...] = (
        ("pipenv", "Pipfile", ["pipenv", "run", "python"]),
        ("poetry", "poetry.lock", ["poetry", "run", "python"]),
        ("pdm", "pdm.lock", ["pdm", "run", "python"]),
        ("uv", "uv.lock", ["uv", "run", "--no-sync", "--quiet", "python"]),
    )
    for tag, lock_name, argv in managers:
        if shutil.which(argv[0]) and _find_lockfile(project_dir, lock_name):
            out.append(_Candidate(tag=tag, argv=argv, kind="manager", prefix=None))

    if _IS_WINDOWS and shutil.which("py"):
        out.append(
            _Candidate(tag="py-launcher", argv=["py", "-3"], kind="direct", prefix=None)
        )

    names = ("python", "python3") if _IS_WINDOWS else ("python3", "python")
    for name in names:
        found = shutil.which(name)
        if found:
            path = Path(found)
            add_path("system", path, _prefix_from_python(path))

    return out


def _subprocess_probe(
    candidate: _Candidate,
    project_dir: Path,
    budget: _ProbeBudget,
) -> tuple[Path | None, str]:
    """Run the find_spec probe. Returns ``(package_dir, status)``."""
    timeout = budget.timeout_for(candidate.kind)
    if timeout <= 0:
        return None, "not_tried"
    started = time.monotonic()
    try:
        result = subprocess.run(  # noqa: S603 - argv is a detected interpreter.
            [*candidate.argv, "-c", _PROBE_SNIPPET],
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            cwd=project_dir,
            timeout=timeout,
            check=False,
            stdin=subprocess.DEVNULL,
            env=_probe_env(),
        )
    except subprocess.TimeoutExpired:
        return None, "probe_failed"
    except (OSError, ValueError, UnicodeError):
        return None, "probe_failed"
    finally:
        budget.charge(time.monotonic() - started)

    pkg = _parse_streamlit_pkg(result.stdout or "")
    if pkg is None:
        if result.returncode == 0:
            return None, "no_streamlit"
        return None, "probe_failed"
    if not _is_usable_package_dir(pkg):
        return None, "no_streamlit"
    return pkg, "ok"


def _evaluate_candidate(
    candidate: _Candidate,
    project_dir: Path,
    budget: _ProbeBudget,
) -> tuple[_Attempt, Path | None]:
    """Return an attempt log entry and a skill path if this candidate is usable.

    Filesystem lookup runs first. Only a usable ``SKILL.md`` short-circuits the
    subprocess. If the filesystem already classified the package and the probe
    then fails, keep that filesystem status so a timeout does not hide
    ``no_usable_skill`` / ``layout_changed``.
    """
    display = " ".join(candidate.argv)

    def recorded(
        status: str, skill: Path | None = None
    ) -> tuple[_Attempt, Path | None]:
        return _Attempt(candidate.tag, display, status, candidate.argv), skill

    exe = _direct_executable(candidate)
    if exe is not None and _is_windows_store_alias(exe):
        return recorded("skipped_stub")

    fs_status: str | None = None
    if candidate.prefix is not None:
        pkg = _filesystem_lookup(candidate.prefix)
        if pkg is not None:
            status, skill = _classify_package(pkg)
            # Only a usable SKILL.md skips the subprocess for this candidate.
            if status == "usable" and skill is not None:
                return recorded(status, skill)
            fs_status = status

    pkg, probe_status = _subprocess_probe(candidate, project_dir, budget)
    if probe_status != "ok" or pkg is None:
        if fs_status is not None and probe_status == "probe_failed":
            return recorded(fs_status)
        return recorded(probe_status)
    status, skill = _classify_package(pkg)
    return recorded(status, skill)


def _quote_argv(parts: Sequence[str]) -> str:
    """Return a copy-pasteable command line for ``parts``."""
    if not _IS_WINDOWS:
        return " ".join(shlex.quote(part) for part in parts)
    quoted: list[str] = []
    for part in parts:
        if " " in part or "\t" in part:
            quoted.append(f'"{part}"')
        else:
            quoted.append(part)
    return " ".join(quoted)


def _install_advice(project_dir: Path, attempts: Sequence[_Attempt]) -> str:
    """Return install advice, quoted for the agent to show rather than execute."""
    header = (
        "If the user asked you to install Streamlit, you may run the command "
        "below. Do not change dependencies unless the user asked."
    )
    first = next(
        (a for a in attempts if a.status in _INSPECTED_STATUSES),
        next(
            (a for a in attempts if a.status not in {"not_tried", "skipped_stub"}),
            None,
        ),
    )
    upgrade = first is not None and first.status == "no_usable_skill"
    if upgrade:
        header += (
            " Streamlit is present but has no usable bundled skill; "
            "upgrade or reinstall it."
        )
    if _find_lockfile(project_dir, "uv.lock") is not None:
        command = (
            "uv add --upgrade streamlit\n    # or: uv pip install --upgrade streamlit"
            if upgrade
            else "uv add streamlit\n    # or: uv pip install streamlit"
        )
    else:
        tag = first.tag if first is not None else ""
        python = first.argv[0] if first is not None and first.argv else "python"
        pip = [python, "-m", "pip", "install"]
        if upgrade:
            pip.append("--upgrade")
        pip.append("streamlit")
        if tag in {"virtual-env", "venv-local", "venv-parent", "venv-git-root"}:
            command = _quote_argv(pip)
        elif tag == "conda":
            command = "conda install -c conda-forge streamlit"
        elif tag == "pipenv":
            command = "pipenv install streamlit"
        elif tag == "poetry":
            command = "poetry add streamlit"
        elif tag == "pdm":
            command = "pdm add streamlit"
        elif tag == "uv":
            command = "uv add streamlit"
        else:
            command = (
                f"{_quote_argv(pip)}\n"
                "    # better: create a project venv first "
                "(`uv venv` or `python -m venv .venv`)"
            )
    return f"{header}\n    {command}"


def _print_failure(
    outcome: _Outcome, attempts: Sequence[_Attempt], project_dir: Path
) -> int:
    """Print the error block and return the exit code."""
    print(f"ERROR[{outcome.name}]: {_ERROR_MESSAGE[outcome]}", file=sys.stderr)
    print(file=sys.stderr)
    print("Attempts:", file=sys.stderr)
    if not attempts:
        print("  (none)", file=sys.stderr)
    for attempt in attempts:
        print(
            f"  {attempt.tag} [{attempt.display}]: {attempt.status}",
            file=sys.stderr,
        )
    print(file=sys.stderr)
    print(_install_advice(project_dir, attempts), file=sys.stderr)
    print(file=sys.stderr)
    print(_DOCS_URL, file=sys.stderr)
    return int(outcome)


def _meta_skill_dir() -> Path:
    """Return the directory that contains this skill's ``SKILL.md``."""
    return Path(__file__).resolve().parent.parent


def _usable_dir(raw: str) -> Path | None:
    """Return ``raw`` as a directory after ``~`` / env expansion, or ``None``."""
    expanded = _expand_user_path(raw)
    if "${" in expanded:
        return None
    path = Path(expanded)
    if not path.is_dir():
        return None
    return _safe_resolve(path)


def _env_project_dir() -> Path | None:
    """Return a harness workspace directory when one is set and exists."""
    for name in _PROJECT_DIR_ENV_VARS:
        raw = os.environ.get(name)
        if not raw:
            continue
        found = _usable_dir(raw)
        if found is not None:
            return found
    return None


def _fallback_project_dir() -> Path:
    """Prefer an agent workspace env var; otherwise cwd.

    Agent Skills hosts often run with cwd equal to this skill directory.
    Warn in that case so the agent passes ``--project-dir`` next.
    """
    env_dir = _env_project_dir()
    if env_dir is not None:
        return env_dir
    cwd = Path.cwd()
    try:
        if _safe_resolve(cwd) == _meta_skill_dir():
            print(
                "WARNING: current working directory is this skill's directory; "
                "pass --project-dir as the user's Streamlit app",
                file=sys.stderr,
            )
    except OSError:
        pass
    return cwd


def _resolve_project_dir(raw: str | None) -> Path:
    """Resolve ``--project-dir``, warning and using a fallback when it is unusable."""
    if raw is None:
        return _fallback_project_dir()
    found = _usable_dir(raw)
    if found is not None:
        return found
    reason = (
        f"still contains unexpanded variables: {raw!r}"
        if "${" in _expand_user_path(raw)
        else f"is not an existing directory: {_expand_user_path(raw)}"
    )
    print(
        f"WARNING: --project-dir {reason}; using the default project directory",
        file=sys.stderr,
    )
    return _fallback_project_dir()


def _resolve_python_flag(raw: str) -> Path:
    """Resolve ``--python`` or raise ``SystemExit`` with ``INVALID_ARGS``."""
    expanded = _expand_user_path(raw)
    path = Path(expanded)
    if path.is_file():
        # Absolutize against the invoker's cwd. The probe later runs with
        # cwd=project_dir, so a relative argv[0] would select a different file.
        return _absolute_no_follow(path)
    found = shutil.which(expanded)
    if found:
        return Path(found)
    print(
        f"ERROR[INVALID_ARGS]: --python is not a usable executable: {raw}",
        file=sys.stderr,
    )
    print(_DOCS_URL, file=sys.stderr)
    raise SystemExit(int(_Outcome.INVALID_ARGS))


def _discover(project_dir: Path, python_flag: Path | None, verbose: bool) -> int:
    """Run per-candidate discovery and print the skill path or an error block."""
    candidates = _iter_candidates(project_dir, python_flag)
    if not candidates:
        return _print_failure(_Outcome.NO_PROJECT_PYTHON, [], project_dir)

    budget = _ProbeBudget()
    attempts: list[_Attempt] = []
    # Final error follows the first candidate that was actually inspected.
    # A later layout_changed/no_usable_skill must not hide an earlier no_streamlit.
    first_inspected: _Attempt | None = None

    for candidate in candidates:
        attempt, skill = _evaluate_candidate(candidate, project_dir, budget)
        attempts.append(attempt)
        if attempt.status == "usable" and skill is not None:
            print(skill)
            if verbose:
                print(
                    f"discovered via: {attempt.tag} {attempt.display}",
                    file=sys.stderr,
                )
            return int(_Outcome.SUCCESS)
        if attempt.status in _INSPECTED_STATUSES and first_inspected is None:
            first_inspected = attempt

    if first_inspected is None:
        any_started = any(attempt.status != "not_tried" for attempt in attempts)
        code = _Outcome.PROBE_FAILED if any_started else _Outcome.NO_PROJECT_PYTHON
        return _print_failure(code, attempts, project_dir)
    return _print_failure(
        _STATUS_TO_OUTCOME[first_inspected.status], attempts, project_dir
    )


def _run(argv: Sequence[str] | None) -> int:
    """Parse CLI arguments and run discovery."""
    parser = _DiscoverArgumentParser(
        description="Discover the bundled developing-with-streamlit SKILL.md.",
    )
    parser.add_argument(
        "--project-dir",
        default=None,
        help=(
            "Path to the user's project directory. Defaults to "
            "CLAUDE_PROJECT_DIR or CURSOR_PROJECT_DIR when set to an "
            "existing directory, otherwise cwd. Expands ~ and environment "
            "variables. Unexpanded ${...} or a missing path warns and uses "
            "that same fallback."
        ),
    )
    parser.add_argument(
        "--python",
        default=None,
        help="Inspect only this interpreter. Exclusive: other candidates are skipped.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="On success, print the winning tag and interpreter on stderr.",
    )
    args = parser.parse_args(None if argv is None else list(argv))
    project_dir = _resolve_project_dir(args.project_dir)
    python_flag = _resolve_python_flag(args.python) if args.python else None
    return _discover(project_dir, python_flag, args.verbose)


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point. Unexpected exceptions become ``ERROR[INTERNAL]``."""
    _reconfigure_stdio()
    try:
        return _run(argv)
    except SystemExit as exc:
        if exc.code is None:
            return 0
        if isinstance(exc.code, int):
            return exc.code
        return int(_Outcome.INVALID_ARGS)
    except Exception as exc:
        print(f"ERROR[INTERNAL]: {exc}", file=sys.stderr)
        print(_DOCS_URL, file=sys.stderr)
        return int(_Outcome.INTERNAL)


if __name__ == "__main__":
    sys.exit(main())
