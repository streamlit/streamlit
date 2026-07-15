#!/usr/bin/env python3
"""Discover the Streamlit package's bundled agent-skills SKILL.md.

Usage:
    python scripts/discover.py [--project-dir PATH]

When --project-dir is given, the script resolves `.venv`, `../.venv`,
`Pipfile`, `poetry.lock`, `pdm.lock`, and `uv.lock` relative to that path (so
its checks land on the user's project rather than on the script's installed
location).

Exit codes:
    0 - success; prints the absolute path to the bundled SKILL.md on stdout.
    1 - Streamlit is not installed in the detected interpreter.
    2 - Streamlit is installed but predates bundled skills (no .agents/skills/).
    3 - no usable Python interpreter was found.
    4 - .agents/skills/ exists but the expected developing-with-streamlit/SKILL.md
        is missing from the documented sub-path (likely upstream restructured).
        The agent should read the listed available skills directly.
    5 - invalid script argument.

On non-zero exit, a human-readable "ERROR:" block is printed on stderr.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple


def find_venv_python(venv_root: Path) -> Optional[Path]:
    """Return the venv's Python executable, cross-platform.

    POSIX venvs put it at bin/python; Windows venvs put it at Scripts/python.exe.
    """
    for candidate in (
        venv_root / "bin" / "python",
        venv_root / "Scripts" / "python.exe",
    ):
        if candidate.is_file():
            return candidate
    return None


def find_git_root(start: Path) -> Optional[Path]:
    """Walk up from `start` looking for a `.git` directory or file.

    Returns the directory containing `.git` (the repo root), or None if no
    git repository is found above `start`. Handles the worktree case where
    `.git` is a file pointing at the real repo dir.
    """
    for ancestor in [start, *start.parents]:
        if (ancestor / ".git").exists():
            return ancestor
    return None


def detect_interpreter(project_dir: Path) -> Optional[Tuple[List[str], str]]:
    """Pick the right Python interpreter, in documented priority order.

    Returns ``(cmd, tag)`` where ``cmd`` is the command for ``subprocess.run``
    and ``tag`` identifies which detection branch fired (``virtual-env``,
    ``venv-local``, ``venv-parent``, ``venv-git-root``, ``conda``, ``pipenv``,
    ``poetry``, ``pdm``, ``uv``, or ``system``). The tag lets callers give
    targeted install advice on exit 1 instead of a buffet of unrelated
    package-manager commands.
    """
    venv = os.environ.get("VIRTUAL_ENV")
    if venv:
        py = find_venv_python(Path(venv))
        if py:
            return [str(py)], "virtual-env"

    py = find_venv_python(project_dir / ".venv")
    if py:
        return [str(py)], "venv-local"

    py = find_venv_python(project_dir.parent / ".venv")
    if py:
        return [str(py)], "venv-parent"

    # Walk up to the git repo root and look for a `.venv` there. Helpful for
    # monorepos where the project's venv lives at repo root but the agent's
    # cwd / --project-dir points deep into a subdirectory.
    git_root = find_git_root(project_dir)
    if (
        git_root is not None
        and git_root != project_dir
        and git_root != project_dir.parent
    ):
        py = find_venv_python(git_root / ".venv")
        if py:
            return [str(py)], "venv-git-root"

    conda = os.environ.get("CONDA_PREFIX")
    if conda:
        py = find_venv_python(Path(conda))
        if py:
            return [str(py)], "conda"

    if shutil.which("pipenv") and (project_dir / "Pipfile").is_file():
        return ["pipenv", "run", "python"], "pipenv"

    if shutil.which("poetry") and (project_dir / "poetry.lock").is_file():
        return ["poetry", "run", "python"], "poetry"

    if shutil.which("pdm") and (project_dir / "pdm.lock").is_file():
        return ["pdm", "run", "python"], "pdm"

    if shutil.which("uv") and (project_dir / "uv.lock").is_file():
        return ["uv", "run", "--quiet", "python"], "uv"

    for name in ("python3", "python"):
        if shutil.which(name):
            return [name], "system"

    return None


def install_advice(cmd: List[str], tag: str) -> str:
    """Return the package-manager-appropriate install command for the
    detected interpreter.

    ``detect_interpreter`` already chose a branch; we know which tool to
    suggest. Dumping every install command and asking the agent to "match
    the tool for your project" is how a poetry project gets a stray
    ``pip install streamlit`` outside the lockfile.
    """
    if tag in {"virtual-env", "venv-local", "venv-parent", "venv-git-root"}:
        # Use the venv's own python to run pip — independent of activation
        # state on the user's shell.
        return f"{cmd[0]} -m pip install streamlit"
    if tag == "conda":
        return "conda install -c conda-forge streamlit"
    if tag == "pipenv":
        return "pipenv install streamlit"
    if tag == "poetry":
        return "poetry add streamlit"
    if tag == "pdm":
        return "pdm add streamlit"
    if tag == "uv":
        return "uv add streamlit"
    # tag == "system" (or unknown — defensive)
    return (
        f"{cmd[0]} -m pip install streamlit\n"
        "    (better: create a project venv first with "
        "`python -m venv .venv && source .venv/bin/activate`)"
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Discover the bundled developing-with-streamlit SKILL.md.",
    )
    parser.add_argument(
        "--project-dir",
        default=None,
        help="Absolute path to the user's project directory. Defaults to cwd.",
    )
    try:
        args = parser.parse_args()
    except SystemExit as e:
        return 5 if e.code else 0

    if args.project_dir is not None:
        project_dir = Path(args.project_dir)
        if not project_dir.is_dir():
            print(
                f"ERROR: --project-dir is not a directory: {project_dir}",
                file=sys.stderr,
            )
            return 5
    else:
        project_dir = Path.cwd()
    project_dir = project_dir.resolve()

    detection = detect_interpreter(project_dir)
    if detection is None:
        print(
            "ERROR: No Python interpreter found.\n"
            "Install Python 3.10+ (the easiest path is `uv` — see https://docs.astral.sh/uv/),\n"
            "then install Streamlit (pip install streamlit) and re-run.",
            file=sys.stderr,
        )
        return 3

    cmd, tag = detection
    py_display = " ".join(cmd)

    probe = "import streamlit; print(streamlit.__path__[0])"
    try:
        result = subprocess.run(
            [*cmd, "-c", probe],
            capture_output=True,
            text=True,
            cwd=project_dir,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        print(
            f"ERROR: import streamlit timed out (interpreter: {py_display})",
            file=sys.stderr,
        )
        return 1
    except FileNotFoundError:
        print(
            f"ERROR: detected interpreter not found on PATH: {py_display}",
            file=sys.stderr,
        )
        return 3

    if result.returncode != 0:
        combined = (result.stderr or "") + (result.stdout or "")
        if "ModuleNotFoundError" in combined:
            advice = install_advice(cmd, tag)
            extra = ""
            if tag == "system":
                # No env-manager artifact found. The user might still have
                # one (hatch, pyenv-virtualenv, an unactivated conda env)
                # we couldn't auto-detect.
                extra = (
                    "\n\nIf your project uses an environment manager we did not\n"
                    "auto-detect (hatch, pyenv-virtualenv, an unactivated conda env),\n"
                    "ACTIVATE it first so the right Python is found, then re-run."
                )
            print(
                "ERROR: Streamlit is not installed in the detected Python environment.\n"
                f"Interpreter:   {py_display}\n"
                f"Detected via:  {tag}\n"
                "\n"
                f"Install with:  {advice}\n"
                "\n"
                f"Then re-run this script.{extra}",
                file=sys.stderr,
            )
            return 1
        print(
            "ERROR: Failed to import streamlit.\n"
            f"Interpreter: {py_display}\n"
            "Output:\n"
            f"{combined}",
            file=sys.stderr,
        )
        return 1

    streamlit_path = Path(result.stdout.strip()).resolve()
    agents_skills_dir = streamlit_path / ".agents" / "skills"
    primary_skill = agents_skills_dir / "developing-with-streamlit" / "SKILL.md"

    if primary_skill.is_file():
        print(primary_skill)
        return 0

    if agents_skills_dir.is_dir():
        print(
            "ERROR: Streamlit's bundled skills directory exists, but the expected\n"
            "developing-with-streamlit/SKILL.md is missing from the documented sub-path.\n"
            "This usually means upstream Streamlit reorganized the skill layout.\n"
            "\n"
            f"Streamlit path: {streamlit_path}\n"
            f"Bundled skills directory: {agents_skills_dir}\n"
            "Available entries:",
            file=sys.stderr,
        )
        for entry in sorted(agents_skills_dir.iterdir()):
            print(f"  {entry.name}", file=sys.stderr)
        print(
            "\n"
            "Read whichever skill best matches the user's task. If none match,\n"
            "fall back to the complete Streamlit documentation:\n"
            "  https://docs.streamlit.io/llms-full.txt",
            file=sys.stderr,
        )
        return 4

    print(
        f"ERROR: Streamlit is installed but predates bundled skills (< 1.57).\n"
        f"Interpreter: {py_display}\n"
        f"Streamlit path: {streamlit_path}\n"
        "\n"
        "For best results, upgrade to get version-matched bundled skills:\n"
        "  pip install --upgrade streamlit\n"
        "\n"
        "If upgrading isn't an option, fall back to the complete Streamlit\n"
        "documentation (full API + guides, formatted for LLMs):\n"
        "  https://docs.streamlit.io/llms-full.txt",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
