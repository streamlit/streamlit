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

"""Implementation of the `streamlit skills` CLI command."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

import click

import streamlit

# Skills excluded from project installs (meta/discovery skills)
_EXCLUDED_PROJECT_SKILLS: Final[frozenset[str]] = frozenset(
    {"finding-streamlit-skills"}
)


@dataclass
class _InstallResult:
    """Result of a skill installation attempt."""

    installed: list[str] = field(default_factory=list)
    up_to_date: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def _get_source_skills_dir() -> Path:
    """Get the path to bundled skills in the Streamlit package."""
    package_dir = Path(streamlit.__file__).parent
    return package_dir / ".agents" / "skills"


def _discover_skills(source_dir: Path) -> list[str]:
    """Discover installable skills from the source directory.

    A valid skill is a directory containing SKILL.md.
    Excludes meta/discovery skills from project installs.
    """
    if not source_dir.is_dir():
        return []

    skills = []
    for entry in sorted(source_dir.iterdir()):
        if not entry.is_dir():
            continue
        if entry.name in _EXCLUDED_PROJECT_SKILLS:
            continue
        if (entry / "SKILL.md").is_file():
            skills.append(entry.name)

    return skills


def _find_project_root() -> Path:
    """Find the project root directory for installation.

    1. If cwd has .agents or .claude, use cwd
    2. Otherwise, walk up to find nearest .git
    3. Otherwise, use cwd
    """
    cwd = Path.cwd()

    # Check if cwd already has agent directories
    if (cwd / ".agents").exists() or (cwd / ".claude").exists():
        return cwd

    # Walk up to find git root
    for parent in [cwd, *cwd.parents]:
        git_path = parent / ".git"
        if git_path.exists():
            return parent

    return cwd


def _get_target_dirs(project_root: Path) -> list[Path]:
    """Get target directories for skill installation.

    Always targets .agents/skills/. Also targets .claude/skills/
    when ~/.claude exists (Claude Code is installed).
    """
    targets = [project_root / ".agents" / "skills"]

    claude_home = Path.home() / ".claude"
    if claude_home.exists():
        targets.append(project_root / ".claude" / "skills")

    return targets


def _is_streamlit_owned_symlink(link_path: Path, source_skills_dir: Path) -> bool:
    """Check if a symlink appears to be a Streamlit-managed skill link.

    Returns True if the link resolves to the current source_skills_dir
    or its raw target contains .agents/skills/<skill-name> pattern
    (indicating a previous Streamlit install).
    """
    if not link_path.is_symlink():
        return False

    # Check if it resolves to current source
    try:
        resolved = link_path.resolve()
        if (
            source_skills_dir in resolved.parents
            or resolved.parent == source_skills_dir
        ):
            return True
    except (OSError, ValueError):
        pass

    # Check raw link target for Streamlit skill pattern
    try:
        raw_target = os.readlink(link_path)
        skill_name = link_path.name
        if f".agents/skills/{skill_name}" in raw_target:
            return True
    except OSError:
        pass

    return False


def _install_skill(
    skill_name: str,
    source_dir: Path,
    target_dir: Path,
    result: _InstallResult,
) -> None:
    """Install a single skill to a target directory.

    Creates a relative symlink from target_dir/skill_name to the source.
    """
    source_path = source_dir / skill_name
    target_path = target_dir / skill_name
    rel_target_path = target_path.relative_to(Path.cwd())

    # Ensure parent directory exists
    target_dir.mkdir(parents=True, exist_ok=True)

    if target_path.exists() or target_path.is_symlink():
        # Target exists - check if it's a matching symlink
        if target_path.is_symlink():
            try:
                resolved = target_path.resolve()
                if resolved == source_path.resolve():
                    result.up_to_date.append(str(rel_target_path))
                    return
            except (OSError, ValueError):
                pass

            # Check if it's a Streamlit-owned symlink we can replace
            if _is_streamlit_owned_symlink(target_path, source_dir.parent):
                # Remove and reinstall
                target_path.unlink()
            else:
                result.skipped.append(f"{rel_target_path} (existing symlink)")
                return
        else:
            # Regular file or directory - skip
            result.skipped.append(f"{rel_target_path} (existing file or directory)")
            return

    # Compute relative symlink target
    try:
        rel_source = os.path.relpath(source_path, target_path.parent)
    except ValueError:
        # Cross-drive on Windows - use absolute path
        rel_source = str(source_path)

    # Create symlink
    try:
        target_path.symlink_to(rel_source, target_is_directory=True)
        result.installed.append(str(rel_target_path))
    except OSError as e:
        # Symlink not supported - could implement copy fallback here
        result.skipped.append(f"{rel_target_path} (symlink failed: {e})")


def _print_result(result: _InstallResult) -> None:
    """Print the installation result summary."""
    if result.installed:
        click.secho("\n✓ Installed:", fg="green", bold=True)
        for path in result.installed:
            click.echo(
                f"  {click.style('→', fg='green')} {click.style(path, fg='cyan')}"
            )

    if result.up_to_date:
        click.secho("\n● Up to date:", fg="blue", bold=True)
        for path in result.up_to_date:
            click.echo(
                f"  {click.style('→', fg='blue')} {click.style(path, fg='cyan')}"
            )

    if result.skipped:
        click.secho("\n⚠ Skipped due to conflicts:", fg="yellow", bold=True)
        for path in result.skipped:
            click.echo(f"  {click.style('→', fg='yellow')} {path}")


def _prompt_install_mode() -> str:
    """Prompt user to select install mode."""
    click.echo()
    click.secho("Streamlit Skills Installer", fg="magenta", bold=True)
    click.echo()
    click.echo("Install mode:")
    click.echo(
        f"  {click.style('[p]', fg='cyan', bold=True)} "
        f"Project {click.style('(recommended)', fg='green')} - "
        "skills available in this project only"
    )
    click.echo()

    while True:
        choice = click.prompt("Choice", default="p", show_default=True).strip().lower()
        if choice in {"", "p", "project"}:
            return "project"
        click.echo("Invalid choice. Enter 'p' for project install.")


def _confirm_installation(
    project_root: Path,
    skills: list[str],
    target_dirs: list[Path],
) -> bool:
    """Show installation plan and confirm with user."""
    click.echo()
    click.echo(
        f"Installing to project: {click.style(str(project_root), fg='bright_blue')}"
    )

    click.secho("\nSkills to install:", bold=True)
    for skill in skills:
        click.echo(
            f"  {click.style('•', fg='magenta')} {click.style(skill, fg='cyan')}"
        )

    click.secho("\nTarget directories:", bold=True)
    for target_dir in target_dirs:
        rel_path = target_dir.relative_to(project_root)
        click.echo(
            f"  {click.style('•', fg='magenta')} {click.style(str(rel_path) + '/', fg='cyan')}"
        )

    click.echo()
    return click.confirm("Proceed with installation?", default=True)


def install_skills(*, yes: bool = False) -> None:
    """Install bundled Streamlit skills to the current project.

    Parameters
    ----------
    yes
        If True, skip all confirmation prompts.
    """
    # Check if running interactively
    if not yes and not sys.stdin.isatty():
        raise click.ClickException(
            "Non-interactive terminal detected. Use --yes to skip prompts."
        )

    # Discover bundled skills
    source_skills_dir = _get_source_skills_dir()
    if not source_skills_dir.is_dir():
        raise click.ClickException(
            f"Bundled skills directory not found: {source_skills_dir}"
        )

    skills = _discover_skills(source_skills_dir)
    if not skills:
        raise click.ClickException("No installable skills found in Streamlit package.")

    # Interactive mode selection
    if not yes:
        _prompt_install_mode()

    # Determine targets
    project_root = _find_project_root()
    target_dirs = _get_target_dirs(project_root)

    # Confirm installation
    if not yes and not _confirm_installation(project_root, skills, target_dirs):
        click.echo("Installation cancelled.")
        return

    # Install skills
    result = _InstallResult()
    for skill_name in skills:
        for target_dir in target_dirs:
            _install_skill(skill_name, source_skills_dir, target_dir, result)

    # Report results
    _print_result(result)

    if result.installed or result.up_to_date:
        click.echo()
        click.secho("✨ Successfully installed to ", fg="green", bold=True, nl=False)
        click.secho(str(project_root), fg="bright_blue")
        if result.installed:
            click.echo()
            click.secho("Note: ", fg="bright_black", bold=True, nl=False)
            click.secho(
                "Installed skills are symlinks to your local Streamlit environment.",
                fg="bright_black",
            )
            click.secho(
                "      They generally should not be committed to git.",
                fg="bright_black",
            )
    elif result.skipped:
        raise click.ClickException(
            "No skills were installed due to conflicts. "
            "Remove conflicting files and try again."
        )
