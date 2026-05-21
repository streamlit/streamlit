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

import io
import os
import shutil
import sys
import tarfile
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final
from urllib import request
from urllib.error import URLError

import click

import streamlit

# GitHub URL for downloading global skills (versioned tag)
_GLOBAL_SKILLS_URL: Final[str] = (
    "https://github.com/streamlit/agent-skills/archive/refs/tags/v1.tar.gz"
)

# Skill name installed in global mode
_GLOBAL_SKILL_NAME: Final[str] = "developing-with-streamlit"


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
    """
    if not source_dir.is_dir():
        return []

    skills = []
    for entry in sorted(source_dir.iterdir()):
        if not entry.is_dir():
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


def _get_project_target_dirs(project_root: Path) -> list[Path]:
    """Get target directories for project skill installation.

    Always targets .agents/skills/. Also targets .claude/skills/
    when ~/.claude exists (Claude Code is installed).
    """
    targets = [project_root / ".agents" / "skills"]

    claude_home = Path.home() / ".claude"
    if claude_home.exists():
        targets.append(project_root / ".claude" / "skills")

    return targets


def _get_global_target_dirs() -> list[Path]:
    """Get target directories for global skill installation.

    Always targets ~/.agents/skills/. Also targets ~/.claude/skills/
    when ~/.claude exists (Claude Code is installed).
    """
    home = Path.home()
    targets = [home / ".agents" / "skills"]

    claude_home = home / ".claude"
    if claude_home.exists():
        targets.append(claude_home / "skills")

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


def _is_streamlit_owned_directory(dir_path: Path) -> bool:
    """Check if a directory appears to be a Streamlit-managed skill copy.

    Returns True if the directory contains a .streamlit-skills marker file,
    indicating it was installed by this command.
    """
    if not dir_path.is_dir():
        return False
    return (dir_path / ".streamlit-skills").is_file()


def _install_skill_symlink(
    skill_name: str,
    source_dir: Path,
    target_dir: Path,
    result: _InstallResult,
) -> bool:
    """Install a single skill as a symlink to the source directory.

    Returns True if symlink was created successfully, False if symlinks
    are not supported (for fallback handling).
    """
    source_path = source_dir / skill_name
    target_path = target_dir / skill_name

    try:
        rel_target_path = target_path.relative_to(Path.cwd())
    except ValueError:
        rel_target_path = target_path

    # Ensure parent directory exists
    target_dir.mkdir(parents=True, exist_ok=True)

    if target_path.exists() or target_path.is_symlink():
        # Target exists - check if it's a matching symlink
        if target_path.is_symlink():
            try:
                resolved = target_path.resolve()
                if resolved == source_path.resolve():
                    result.up_to_date.append(str(rel_target_path))
                    return True
            except (OSError, ValueError):
                pass

            # Check if it's a Streamlit-owned symlink we can replace
            if _is_streamlit_owned_symlink(target_path, source_dir.parent):
                target_path.unlink()
            else:
                result.skipped.append(f"{rel_target_path} (existing symlink)")
                return True
        else:
            # Regular file or directory - skip
            result.skipped.append(f"{rel_target_path} (existing file or directory)")
            return True

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
        return True
    except OSError:
        # Symlink not supported (e.g., Windows without Developer Mode)
        return False


def _install_skill_copy(
    skill_name: str,
    source_dir: Path,
    target_dir: Path,
    result: _InstallResult,
) -> None:
    """Install a single skill by copying files to target directory."""
    source_path = source_dir / skill_name
    target_path = target_dir / skill_name

    try:
        rel_target_path = target_path.relative_to(Path.home())
        rel_target_path = Path("~") / rel_target_path
    except ValueError:
        rel_target_path = target_path

    # Ensure parent directory exists
    target_dir.mkdir(parents=True, exist_ok=True)

    if target_path.exists() or target_path.is_symlink():
        # Target exists - check if it's a Streamlit-owned copy we can replace
        if target_path.is_symlink():
            if _is_streamlit_owned_symlink(target_path, source_dir.parent):
                target_path.unlink()
            else:
                result.skipped.append(f"{rel_target_path} (existing symlink)")
                return
        elif _is_streamlit_owned_directory(target_path):
            # Check if content matches (up to date)
            marker = target_path / ".streamlit-skills"
            if marker.is_file():
                shutil.rmtree(target_path)
        else:
            result.skipped.append(f"{rel_target_path} (existing file or directory)")
            return

    # Copy skill directory
    try:
        shutil.copytree(source_path, target_path)
        # Add marker file to indicate Streamlit ownership
        (target_path / ".streamlit-skills").write_text("", encoding="utf-8")
        result.installed.append(str(rel_target_path))
    except OSError as e:
        result.skipped.append(f"{rel_target_path} (copy failed: {e})")


def _download_global_skill(url: str, skill_name: str) -> Path:
    """Download and extract global skill from GitHub.

    Returns path to extracted skill directory in a temporary location.
    Raises click.ClickException on network or extraction errors.
    """
    try:
        with request.urlopen(url, timeout=30) as response:  # noqa: S310
            data = response.read()
    except URLError as e:
        raise click.ClickException(
            f"Failed to download skills from GitHub: {e}\n"
            "Check your network connection and try again."
        ) from e

    # Extract tarball to temp directory
    temp_dir = Path(tempfile.mkdtemp(prefix="streamlit-skills-"))
    try:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
            # Security: validate paths before extraction
            for member in tar.getmembers():
                if member.name.startswith("/") or ".." in member.name:
                    raise click.ClickException("Invalid archive: contains unsafe paths")
            tar.extractall(temp_dir)  # noqa: S202
    except tarfile.TarError as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise click.ClickException(f"Failed to extract skills archive: {e}") from e

    # Find extracted skill directory (tarball root is typically repo-name-tag/)
    extracted_dirs = list(temp_dir.iterdir())
    if not extracted_dirs:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise click.ClickException("Downloaded archive is empty")

    archive_root = extracted_dirs[0]
    skill_path = archive_root / skill_name

    if not skill_path.is_dir() or not (skill_path / "SKILL.md").is_file():
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise click.ClickException(
            f"Skill '{skill_name}' not found in downloaded archive"
        )

    return skill_path


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
    click.echo(
        f"  {click.style('[g]', fg='cyan', bold=True)} "
        f"Global - "
        "skills available across all projects"
    )
    click.echo()

    while True:
        choice = click.prompt("Choice", default="p", show_default=True).strip().lower()
        if choice in {"", "p", "project"}:
            return "project"
        if choice in {"g", "global"}:
            return "global"
        click.echo("Invalid choice. Enter 'p' for project or 'g' for global install.")


def _confirm_project_installation(
    project_root: Path,
    skills: list[str],
    target_dirs: list[Path],
) -> bool:
    """Show project installation plan and confirm with user."""
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
        try:
            rel_path = target_dir.relative_to(project_root)
        except ValueError:
            rel_path = target_dir
        click.echo(
            f"  {click.style('•', fg='magenta')} "
            f"{click.style(str(rel_path) + '/', fg='cyan')}"
        )

    click.echo()
    return click.confirm("Proceed with installation?", default=True)


def _confirm_global_installation(target_dirs: list[Path]) -> bool:
    """Show global installation plan and confirm with user."""
    click.echo()
    click.echo("Installing globally (downloads from GitHub)")

    click.secho("\nSkill to install:", bold=True)
    click.echo(
        f"  {click.style('•', fg='magenta')} "
        f"{click.style(_GLOBAL_SKILL_NAME, fg='cyan')}"
    )

    click.secho("\nTarget directories:", bold=True)
    home = Path.home()
    for target_dir in target_dirs:
        try:
            rel_path = Path("~") / target_dir.relative_to(home)
        except ValueError:
            rel_path = target_dir
        click.echo(
            f"  {click.style('•', fg='magenta')} "
            f"{click.style(str(rel_path) + '/', fg='cyan')}"
        )

    click.echo()
    return click.confirm("Proceed with installation?", default=True)


def _install_project_skills(
    *,
    yes: bool = False,
    fallback_to_global: bool = True,
) -> None:
    """Install bundled skills to the current project via symlinks."""
    # Discover bundled skills
    source_skills_dir = _get_source_skills_dir()
    if not source_skills_dir.is_dir():
        raise click.ClickException(
            f"Bundled skills directory not found: {source_skills_dir}"
        )

    skills = _discover_skills(source_skills_dir)
    if not skills:
        raise click.ClickException("No installable skills found in Streamlit package.")

    # Determine targets
    project_root = _find_project_root()
    target_dirs = _get_project_target_dirs(project_root)

    # Confirm installation
    if not yes and not _confirm_project_installation(project_root, skills, target_dirs):
        click.echo("Installation cancelled.")
        return

    # Install skills
    result = _InstallResult()
    symlink_failed = False

    for skill_name in skills:
        for target_dir in target_dirs:
            success = _install_skill_symlink(
                skill_name, source_skills_dir, target_dir, result
            )
            if not success:
                symlink_failed = True
                break
        if symlink_failed:
            break

    # Handle symlink failure (Windows without Developer Mode)
    if symlink_failed and fallback_to_global:
        click.secho(
            "\n⚠ Symlinks not supported on this system.",
            fg="yellow",
            bold=True,
        )
        click.echo("Falling back to global installation mode...")
        click.echo()
        _install_global_skills(yes=yes)
        return

    if symlink_failed:
        raise click.ClickException(
            "Symlinks not supported. Use --global for global installation."
        )

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


def _install_global_skills(*, yes: bool = False) -> None:
    """Install skills globally by downloading from GitHub."""
    target_dirs = _get_global_target_dirs()

    # Confirm installation
    if not yes and not _confirm_global_installation(target_dirs):
        click.echo("Installation cancelled.")
        return

    # Download skill from GitHub
    click.echo("Downloading skills from GitHub...")
    skill_path = _download_global_skill(_GLOBAL_SKILLS_URL, _GLOBAL_SKILL_NAME)

    try:
        # Install to each target directory
        result = _InstallResult()
        for target_dir in target_dirs:
            _install_skill_copy(
                _GLOBAL_SKILL_NAME, skill_path.parent, target_dir, result
            )

        # Report results
        _print_result(result)

        if result.installed or result.up_to_date:
            click.echo()
            click.secho(
                "✨ Successfully installed globally",
                fg="green",
                bold=True,
            )
            if result.installed:
                click.echo()
                click.secho("Note: ", fg="bright_black", bold=True, nl=False)
                click.secho(
                    "Global skills include a discover.py script that finds",
                    fg="bright_black",
                )
                click.secho(
                    "      project-specific bundled skills at runtime.",
                    fg="bright_black",
                )
        elif result.skipped:
            raise click.ClickException(
                "No skills were installed due to conflicts. "
                "Remove conflicting files and try again."
            )
    finally:
        # Clean up temp directory
        shutil.rmtree(skill_path.parent.parent, ignore_errors=True)


def install_skills(*, global_mode: bool = False, yes: bool = False) -> None:
    """Install Streamlit AI-agent skills.

    Parameters
    ----------
    global_mode
        If True, install globally to home directories.
        If False (default), install to project directories via symlinks.
    yes
        If True, skip all confirmation prompts.
    """
    # Check if running interactively
    if not yes and not sys.stdin.isatty():
        raise click.ClickException(
            "Non-interactive terminal detected. Use --yes to skip prompts."
        )

    # Interactive mode selection (when not using flags)
    if not yes and not global_mode:
        mode = _prompt_install_mode()
        if mode == "global":
            global_mode = True

    if global_mode:
        _install_global_skills(yes=yes)
    else:
        _install_project_skills(yes=yes)
