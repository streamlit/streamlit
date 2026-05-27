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


def _generate_gitignore_snippet(
    skills: list[str], target_dirs: list[Path], project_root: Path
) -> str:
    """Generate a .gitignore snippet for installed skills.

    Creates entries for each skill in each target directory, using paths
    relative to the project root.
    """
    lines = ["# Streamlit agent skills (environment-specific symlinks)"]
    for target_dir in target_dirs:
        try:
            rel_dir = target_dir.relative_to(project_root)
        except ValueError:
            rel_dir = target_dir
        lines.extend(f"{rel_dir}/{skill_name}/" for skill_name in skills)
    return "\n".join(lines)


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

    return [
        entry.name
        for entry in sorted(source_dir.iterdir())
        if entry.is_dir() and (entry / "SKILL.md").is_file()
    ]


def _find_project_root() -> Path:
    """Find the project root directory for installation.

    1. If cwd or a non-home ancestor has .agents or .claude, use it
    2. Otherwise, walk up to find nearest .git
    3. Otherwise, use cwd
    """
    cwd = Path.cwd()
    # Resolve home to handle symlinks/bind mounts reaching home via another path
    resolved_home = Path.home().resolve()

    def _is_home(path: Path) -> bool:
        """Check if path is the home directory, handling symlinks."""
        try:
            return path.resolve() == resolved_home
        except OSError:
            return False

    # Check if cwd or a project ancestor already has agent directories.
    # Exclude the user's home directory so ~/.claude is not mistaken for
    # a project-local Claude configuration (including when cwd == home).
    # Use is_dir() to ensure we only match directories, not files that happen
    # to be named .agents or .claude.
    for parent in [cwd, *cwd.parents]:
        if _is_home(parent):
            break
        if (parent / ".agents").is_dir() or (parent / ".claude").is_dir():
            return parent

    # Walk up to find git root, also excluding home directory to avoid
    # treating ~/.git as the project root (including when cwd == home).
    for parent in [cwd, *cwd.parents]:
        if _is_home(parent):
            break
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


def _is_streamlit_owned_symlink(link_path: Path, bundled_skill_names: set[str]) -> bool:
    """Check if a symlink appears to be a Streamlit-managed skill link.

    Returns True for any symlink whose name matches a bundled skill, since
    these names are specific enough that users are unlikely to create their own.
    """
    return link_path.is_symlink() and link_path.name in bundled_skill_names


def _relative_skill_paths(root: Path) -> list[tuple[str, str]]:
    """Return relative paths and path types for a copied skill directory."""
    paths = [
        (
            path.relative_to(root).as_posix(),
            "dir" if path.is_dir() and not path.is_symlink() else "file",
        )
        for path in root.rglob("*")
    ]
    return sorted(paths)


def _skill_copy_matches(source_path: Path, target_path: Path) -> bool:
    """Check whether a managed copied skill matches the source skill."""
    if not target_path.is_dir():
        return False

    if _relative_skill_paths(source_path) != _relative_skill_paths(target_path):
        return False

    for source_file in source_path.rglob("*"):
        rel_path = source_file.relative_to(source_path)
        if source_file.is_dir() and not source_file.is_symlink():
            continue
        if (target_path / rel_path).read_bytes() != source_file.read_bytes():
            return False

    return True


def _symlinks_supported(project_root: Path, source_path: Path) -> bool:
    """Return whether project install can create directory symlinks."""
    try:
        with tempfile.TemporaryDirectory(
            prefix=".streamlit-skills-", dir=project_root
        ) as temp_dir:
            link_path = Path(temp_dir) / "skill-link"
            link_path.symlink_to(source_path, target_is_directory=True)
            return link_path.is_symlink()
    except (OSError, NotImplementedError):
        return False


def _get_display_path(
    target_path: Path, base_path: Path, use_tilde: bool = False
) -> Path:
    """Get a user-friendly display path, relative to base if possible."""
    try:
        rel_path = target_path.relative_to(base_path)
        return Path("~") / rel_path if use_tilde else rel_path
    except ValueError:
        return target_path


def _install_skill_symlink(
    skill_name: str,
    source_dir: Path,
    target_dir: Path,
    result: _InstallResult,
    bundled_skill_names: set[str],
) -> bool:
    """Install a single skill as a symlink to the source directory.

    Returns True if symlink was created successfully, False if symlinks
    are not supported (for fallback handling).
    """
    source_path = source_dir / skill_name
    target_path = target_dir / skill_name
    rel_target_path = _get_display_path(target_path, Path.cwd())

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
                # Broken symlink or resolution error - check ownership pattern below
                pass

            # Check if it's a Streamlit-owned symlink we can replace
            if _is_streamlit_owned_symlink(target_path, bundled_skill_names):
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
    except (OSError, NotImplementedError):
        # Symlink not supported (e.g., Windows without Developer Mode, or some
        # environments where symlinks are not implemented)
        return False


def _install_skill_copy(
    skill_name: str,
    source_dir: Path,
    target_dir: Path,
    result: _InstallResult,
    bundled_skill_names: set[str],
) -> None:
    """Install a single skill by copying files to target directory."""
    source_path = source_dir / skill_name
    target_path = target_dir / skill_name
    rel_target_path = _get_display_path(target_path, Path.home(), use_tilde=True)

    # Ensure parent directory exists
    target_dir.mkdir(parents=True, exist_ok=True)

    old_target_to_remove: Path | None = None

    if target_path.exists() or target_path.is_symlink():
        # Target exists - check if we can replace it
        if target_path.is_symlink():
            if _is_streamlit_owned_symlink(target_path, bundled_skill_names):
                target_path.unlink()
            else:
                result.skipped.append(f"{rel_target_path} (existing symlink)")
                return
        elif target_path.is_dir():
            if _skill_copy_matches(source_path, target_path):
                result.up_to_date.append(str(rel_target_path))
                return
            # Defer removal until after successful copy to ensure atomicity
            old_target_to_remove = target_path
        else:
            result.skipped.append(f"{rel_target_path} (existing file)")
            return

    # Copy skill directory - use temp location first to ensure atomicity
    try:
        if old_target_to_remove is not None:
            # Copy to temp location, then swap
            temp_path = target_path.with_name(f".{skill_name}.tmp")
            if temp_path.exists():
                shutil.rmtree(temp_path)
            shutil.copytree(source_path, temp_path)
            # Now safe to remove old and rename new
            shutil.rmtree(old_target_to_remove)
            temp_path.rename(target_path)
        else:
            shutil.copytree(source_path, target_path)
        result.installed.append(str(rel_target_path))
    except OSError as e:
        # Clean up temp path only if target still exists (meaning old wasn't removed).
        # If target is gone, the old directory was deleted and temp is our only copy -
        # keep it so the user isn't left with nothing.
        temp_path = target_path.with_name(f".{skill_name}.tmp")
        if temp_path.exists() and target_path.exists():
            shutil.rmtree(temp_path, ignore_errors=True)
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
            # Security: prevent path traversal and other attacks by filtering members.
            # On Python 3.12+, use filter='data' which blocks absolute paths,
            # parent directory references (..), and special files (devices, fifos, etc.).
            # On earlier versions, manually filter to regular files and directories only.
            if sys.version_info >= (3, 12):
                tar.extractall(temp_dir, filter="data")
            else:
                # Manual safe extraction for Python 3.10/3.11
                safe_members = [
                    m
                    for m in tar.getmembers()
                    if (m.isfile() or m.isdir())
                    and not os.path.isabs(m.name)
                    and ".." not in m.name.split("/")
                ]
                tar.extractall(temp_dir, members=safe_members)  # noqa: S202
    except tarfile.TarError as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise click.ClickException(f"Failed to extract skills archive: {e}") from e

    # Find skill directory - search all top-level directories in case archive has
    # multiple entries (typically GitHub archives have one: repo-name-tag/)
    extracted_dirs = [d for d in temp_dir.iterdir() if d.is_dir()]
    if not extracted_dirs:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise click.ClickException("Downloaded archive is empty")

    for archive_root in extracted_dirs:
        skill_path = archive_root / skill_name
        if skill_path.is_dir() and (skill_path / "SKILL.md").is_file():
            return skill_path

    shutil.rmtree(temp_dir, ignore_errors=True)
    raise click.ClickException(f"Skill '{skill_name}' not found in downloaded archive")


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
    click.secho(
        "Install skills to enable agents to build better Streamlit apps",
        fg="magenta",
        bold=True,
    )
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

    click.secho("\nSource:", bold=True)
    click.echo(
        f"  {click.style('•', fg='magenta')} "
        f"{click.style(_GLOBAL_SKILLS_URL, fg='cyan')}"
    )

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

    if not _symlinks_supported(project_root, source_skills_dir / skills[0]):
        if fallback_to_global:
            click.secho(
                "\n⚠ Symlinks not supported on this system.",
                fg="yellow",
                bold=True,
            )
            click.echo(
                "Project install uses symlinks so skills stay matched to your "
                "active Streamlit environment."
            )
            click.echo(
                "Falling back to global installation. On Windows, enable "
                "Developer Mode to use project installs."
            )
            click.echo()
            _install_global_skills(yes=yes)
            return

        raise click.ClickException(
            "Symlinks not supported. Use --global for global installation."
        )

    # Confirm installation
    if not yes and not _confirm_project_installation(project_root, skills, target_dirs):
        click.echo("Installation cancelled.")
        raise click.Abort()

    # Install skills
    result = _InstallResult()
    symlink_failed = False
    bundled_skill_names = set(skills)

    for skill_name in skills:
        for target_dir in target_dirs:
            success = _install_skill_symlink(
                skill_name, source_skills_dir, target_dir, result, bundled_skill_names
            )
            if not success:
                symlink_failed = True
                break
        if symlink_failed:
            break

    # Handle symlink failure (Windows without Developer Mode)
    if symlink_failed and fallback_to_global:
        # Don't clean up partial project symlinks - they're in a different location
        # than global install (~/.agents vs project/.agents) and serve as fallback
        # if global install fails.
        click.secho(
            "\n⚠ Symlinks not supported on this system.",
            fg="yellow",
            bold=True,
        )
        click.echo("Falling back to global installation mode...")
        click.echo()
        try:
            _install_global_skills(yes=yes)
        except click.ClickException:
            # Global install failed - partial project symlinks remain as fallback
            raise
        except click.exceptions.Abort:
            # User cancelled global install - report that nothing was fully installed
            raise click.ClickException(
                "Installation incomplete. Project symlinks failed and global install "
                "was cancelled."
            )
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
        click.echo()
        click.secho("Recommended .gitignore snippet:", fg="bright_black", bold=True)
        gitignore_snippet = _generate_gitignore_snippet(
            skills, target_dirs, project_root
        )
        for line in gitignore_snippet.splitlines():
            click.secho(f"  {line}", fg="bright_black")
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
        raise click.Abort()

    # Download skill from GitHub
    click.echo("Downloading skills from GitHub...")
    skill_path = _download_global_skill(_GLOBAL_SKILLS_URL, _GLOBAL_SKILL_NAME)

    try:
        # Install to each target directory
        result = _InstallResult()
        # For global install, only one skill is installed but we use a set for consistency
        bundled_skill_names = {_GLOBAL_SKILL_NAME}
        for target_dir in target_dirs:
            _install_skill_copy(
                _GLOBAL_SKILL_NAME,
                skill_path.parent,
                target_dir,
                result,
                bundled_skill_names,
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
        temp_root = skill_path.parent.parent
        if temp_root.name.startswith("streamlit-skills-"):
            shutil.rmtree(temp_root, ignore_errors=True)


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
