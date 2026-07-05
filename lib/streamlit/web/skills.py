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
from functools import lru_cache
from pathlib import Path
from typing import Final
from urllib import request
from urllib.error import URLError

import click

import streamlit
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)

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


def _find_project_root(start: Path | None = None) -> Path:
    """Find the project root directory for installation.

    1. If the start dir or a non-home ancestor has .agents or .claude, use it
    2. Otherwise, walk up to find nearest .git
    3. Otherwise, fall back to the current working directory when it is an
       ancestor of (or equal to) the start dir — the common
       ``cd repo && streamlit run sub/app.py`` launch, where ``repo`` is the
       directory the developer thinks of as the project — and to the start dir
       otherwise (e.g. ``cd /tmp && streamlit run /proj/app.py``, where ``/tmp``
       must not become the install root). Never fall back to the home directory.

    Parameters
    ----------
    start
        Directory to begin the upward search from. Defaults to the current
        working directory. The in-app installer passes the running app's
        directory so the install lands in the same tree the nudge detection
        scans (``app_dir`` or its git root), rather than wherever the server
        happened to be launched from.
    """
    start_dir = start or Path.cwd()
    # Resolve home to handle symlinks/bind mounts reaching home via another path
    resolved_home = Path.home().resolve()

    def _is_home(path: Path) -> bool:
        """Check if path is the home directory, handling symlinks."""
        try:
            return path.resolve() == resolved_home
        except OSError:
            return False

    # Check if start_dir or a project ancestor already has agent directories.
    # Exclude the user's home directory so ~/.claude is not mistaken for
    # a project-local Claude configuration (including when start_dir == home).
    # Use is_dir() to ensure we only match directories, not files that happen
    # to be named .agents or .claude.
    for parent in [start_dir, *start_dir.parents]:
        if _is_home(parent):
            break
        if (parent / ".agents").is_dir() or (parent / ".claude").is_dir():
            return parent

    # Walk up to find git root, also excluding home directory to avoid
    # treating ~/.git as the project root (including when start_dir == home).
    for parent in [start_dir, *start_dir.parents]:
        if _is_home(parent):
            break
        git_path = parent / ".git"
        if git_path.exists():
            return parent

    # No marker found. Prefer the current working directory when it is an
    # ancestor of (or equal to) the start dir, so ``cd repo && streamlit run
    # sub/app.py`` installs into ``repo`` rather than the nested app-script dir.
    # Fall back to the start dir when cwd is unrelated, so a launch from an
    # arbitrary cwd never installs somewhere surprising. Never use home: a
    # project-local install belongs in the project, not ``~``.
    cwd = Path.cwd()
    try:
        cwd_resolved = cwd.resolve()
        start_resolved = start_dir.resolve()
    except OSError:  # pragma: no cover - defensive
        return start_dir
    if not _is_home(cwd) and (
        cwd_resolved == start_resolved or cwd_resolved in start_resolved.parents
    ):
        return cwd
    return start_dir


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


def are_skills_installed() -> bool:
    """Check whether Streamlit agent skills appear to be installed.

    Returns ``True`` if the bundled skill is present (as a symlink, copied
    directory, or regular directory) in any of the project-local or global
    target directories. This is a best-effort check used to decide whether to
    recommend installing skills; it does not validate skill contents.
    """
    candidate_dirs: list[Path] = []
    try:
        project_root = _find_project_root()
    except (OSError, RuntimeError):
        # RuntimeError can be raised by Path.home() when the home directory
        # cannot be determined. This is a best-effort check, so skip project dirs.
        pass
    else:
        try:
            candidate_dirs.extend(_get_project_target_dirs(project_root))
        except (OSError, RuntimeError):
            # Same reasoning as above; still check global dirs.
            pass

    try:
        candidate_dirs.extend(_get_global_target_dirs())
    except (OSError, RuntimeError):
        # Keep any project dirs already collected above instead of discarding
        # them; still a best-effort check, so just skip the global dirs.
        pass

    for target_dir in candidate_dirs:
        skill_path = target_dir / _GLOBAL_SKILL_NAME
        try:
            if skill_path.is_symlink() or skill_path.exists():
                return True
        except OSError:
            continue
    return False


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

    # Compute the relative symlink target from the REAL (symlink-resolved) paths
    # of both ends. os.path.relpath counts ``..`` levels against the logical
    # path, but the kernel resolves the resulting relative link against the
    # link's *physical* location — so a logical path with a depth-changing
    # symlinked ancestor (macOS /var -> /private/var, container bind-mounts, a
    # symlinked /home) yields a link that dangles. Resolving both sides first
    # makes the ``..`` count match the physical layout, so the link always
    # resolves and the nudge's skill detection can follow it.
    try:
        rel_source = os.path.relpath(
            os.path.realpath(source_path), os.path.realpath(target_path.parent)
        )
    except (ValueError, OSError):
        # Cross-drive on Windows (ValueError) or a resolution error - use the
        # absolute (resolved) source path, which still resolves correctly.
        rel_source = os.path.realpath(source_path)

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


def _conflict_error(skipped: list[str]) -> click.ClickException:
    """Build a specific "couldn't install" error that names the conflicting
    paths, rather than a vague "remove conflicting files".

    ``skipped`` entries are formatted ``"<path> (<reason>)"``. We surface the
    paths so the user knows exactly what to remove, collapsed to the concise
    ``<harness>/skills/<skill>`` tail (like the install summary) so the message
    never leaks an absolute path when the server's cwd isn't the project root.
    This message is what the in-app nudge shows verbatim on failure, so it must
    stand on its own (the CLI's detailed ``_print_result`` output never reaches
    the browser).
    """
    paths = []
    for entry in skipped:
        raw = entry.split(" (", 1)[0]
        parts = Path(raw).parts
        paths.append(Path(*parts[-3:]).as_posix() if len(parts) >= 3 else raw)
    joined = ", ".join(paths)
    plural = len(paths) != 1
    return click.ClickException(
        f"{joined} already exist{'' if plural else 's'}. "
        f"Remove {'them' if plural else 'it'} and try again."
    )


def _install_project_skills(
    *,
    yes: bool = False,
    fallback_to_global: bool = True,
    app_dir: str | None = None,
) -> _InstallResult:
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

    # Determine targets. The in-app installer passes ``app_dir`` so the project
    # root resolves from the running app's directory (matching the nudge's skill
    # detection), instead of the server's working directory.
    project_root = _find_project_root(Path(app_dir) if app_dir else None)
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
            return _install_global_skills(yes=yes)

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
            return _install_global_skills(yes=yes)
        except click.ClickException:
            # Global install failed - partial project symlinks remain as fallback
            raise
        except click.exceptions.Abort:
            # User cancelled global install - report that nothing was fully installed
            raise click.ClickException(
                "Installation incomplete. Project symlinks failed and global install "
                "was cancelled."
            )

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
        raise _conflict_error(result.skipped)

    return result


def _install_global_skills(*, yes: bool = False) -> _InstallResult:
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
            raise _conflict_error(result.skipped)

        return result
    finally:
        # Clean up temp directory
        temp_root = skill_path.parent.parent
        if temp_root.name.startswith("streamlit-skills-"):
            shutil.rmtree(temp_root, ignore_errors=True)


def install_skills(
    *, global_mode: bool = False, yes: bool = False, app_dir: str | None = None
) -> _InstallResult:
    """Install Streamlit AI-agent skills.

    Parameters
    ----------
    global_mode
        If True, install globally to home directories.
        If False (default), install to project directories via symlinks.
    yes
        If True, skip all confirmation prompts.
    app_dir
        Directory of the running app's main script. When provided (the in-app
        one-click install), the project-mode install resolves its root from this
        directory so it lands in the same tree the nudge's skill detection scans.
        Defaults to ``None`` (CLI use), which resolves from the current working
        directory.

    Returns
    -------
    _InstallResult
        The skills that were newly installed, already up to date, or skipped.
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
        return _install_global_skills(yes=yes)
    return _install_project_skills(yes=yes, app_dir=app_dir)


def _install_location(path: str) -> str:
    """Return a concise ``<harness>/skills`` label for an installed skill path.

    Install display paths are relative to the current working directory when
    possible (e.g. ``.agents/skills/<skill>``), but fall back to an absolute
    path when the resolved project root is an ancestor of the cwd (e.g. running
    ``streamlit run sub/app.py`` from a subdirectory). Global installs use a
    home-relative ``~/.agents/skills/<skill>`` form. The skill target layout is
    always ``<harness>/skills/<skill>``, so collapse to the final two segments
    of the parent directory to keep the in-app summary concise — but preserve a
    leading ``~`` so a global (home) install is not mislabeled as project-local.
    """
    parent = Path(path).parent
    parts = parent.parts
    if parts and parts[0] == "~":
        # Home-relative global install: keep the ``~`` so the message reads
        # e.g. "~/.agents/skills" rather than being collapsed to
        # ".agents/skills" (which looks project-local).
        return parent.as_posix()
    if len(parts) > 2:
        return Path(*parts[-2:]).as_posix()
    return parent.as_posix()


def summarize_install(result: _InstallResult) -> str:
    """Return a short, user-facing summary of an install for the in-app nudge.

    Reports where skills were newly installed, or that they were already up to
    date, and flags any skills skipped due to conflicts so a partial install is
    not silently presented as a complete success. Used to give the one-click
    "install skills" toast concrete feedback instead of a generic confirmation.
    Returns an empty string when there is nothing meaningful to report.
    """
    parts: list[str] = []
    if result.installed:
        # Collapse the per-skill target paths to their distinct parent dirs
        # (e.g. ".agents/skills", ".claude/skills") for a concise message.
        locations = sorted({_install_location(path) for path in result.installed})
        # Terminate with a period so a following "N skipped" sentence reads as
        # two sentences ("Installed to .agents/skills. 1 skill skipped…") rather
        # than running together.
        parts.append("Installed to " + ", ".join(locations) + ".")
    elif result.up_to_date:
        parts.append("Skills are already up to date.")
    if result.skipped:
        # Surface skipped skills so a mixed result (some installed/up-to-date,
        # some skipped due to a conflicting file) is not mistaken for "all done".
        count = len(result.skipped)
        noun = "skill" if count == 1 else "skills"
        parts.append(f"{count} {noun} skipped due to conflicts.")
    return " ".join(parts)


def _nudge_dismissed_marker_path() -> Path:
    """Return the path to the marker file that suppresses the skills nudge."""
    from streamlit import file_util

    return Path(file_util.get_streamlit_file_path(".skills_nudge_dismissed"))


def write_nudge_dismissed_marker() -> None:
    """Persist the user's "don't ask again" choice for the skills nudge.

    Creates an empty marker file under the user's Streamlit config directory,
    creating parent directories as needed. ``should_show_skills_nudge`` checks
    for this file, so once written the in-app nudge is no longer shown.
    """
    marker = _nudge_dismissed_marker_path()
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.touch(exist_ok=True)


_STREAMLIT_SKILL_NAMES: Final = (
    "developing-with-streamlit",
    "developing-with-streamlit-in-snowflake",
)
_SKILL_MARKER_FILENAME: Final = "SKILL.md"
# (harness, project_skills_dir, home_skills_dir, agent_home_dir) - skill dirs
# are checked for the SKILL.md marker; agent_home_dir is checked for existence
# to detect the harness itself independent of Streamlit skills.
_HARNESSES: Final = (
    ("agents", ".agents/skills", ".agents/skills", ".agents"),
    ("claude", ".claude/skills", ".claude/skills", ".claude"),
    ("codex", ".codex/skills", ".codex/skills", ".codex"),
    ("copilot", ".github/skills", ".copilot/skills", ".copilot"),
    ("cortex", ".cortex/skills", ".snowflake/cortex/skills", ".snowflake/cortex"),
    ("cursor", ".cursor/skills", ".cursor/skills", ".cursor"),
    ("gemini", ".gemini/skills", ".gemini/skills", ".gemini"),
    ("opencode", ".opencode/skills", ".config/opencode/skills", ".config/opencode"),
)
# Max directory levels to walk when searching for a ``.git`` ancestor. Bounded
# to avoid scanning the entire filesystem on pathological layouts.
_MAX_REPO_ROOT_WALK_DEPTH: Final = 20


def _find_git_root(start: str) -> str | None:
    """Return the nearest ancestor of ``start`` containing a ``.git`` entry, or ``None``.

    Uses a bounded stdlib ancestor walk rather than ``git.Repo(...)`` from
    GitPython. GitPython's cold import adds ~170ms on first call, which shows
    up on every hosted-app startup via the ``create_page_profile_message``
    code path — for a signal that almost always resolves to ``None`` in those
    environments. The stdlib walk is ~1ms cold and returns the same path we
    need.
    """
    current = os.path.abspath(start)
    for _ in range(_MAX_REPO_ROOT_WALK_DEPTH):
        if os.path.exists(os.path.join(current, ".git")):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent
    return None


def detect_installed_skills(app_dir: str | None) -> list[str]:
    """Detect Streamlit-shipped agent skills in well-known locations.

    Returns a sorted, deduplicated list of ``"<location>:<harness>:<skill>"``
    tokens. ``location`` is ``home``, ``app``, ``repo``, or ``project`` (the
    in-app installer's resolved root, when distinct from ``app``/``repo``);
    ``harness`` is one of ``agents``, ``claude``, ``codex``, ``copilot``,
    ``cortex``, ``cursor``, ``gemini``, or ``opencode``; ``skill`` is one of
    ``_STREAMLIT_SKILL_NAMES``. Never raises: filesystem errors are swallowed
    and produce an empty list.

    The result is cached per ``app_dir`` for the lifetime of the process.
    """
    return list(_detect_installed_skills_cached(app_dir))


# maxsize=2 (not 1) so the two callers' keys can coexist: the page-profile
# telemetry may pass ``None`` (no script-run context) while the skills nudge
# passes ``dirname(main_script_path)``. A size-1 cache would let those evict
# each other and re-walk the filesystem on every alternating call.
@lru_cache(maxsize=2)
def _detect_installed_skills_cached(app_dir: str | None) -> tuple[str, ...]:
    try:
        home = os.path.expanduser("~")
        app = os.path.abspath(app_dir) if app_dir else os.getcwd()
        repo = _find_git_root(app)

        roots: dict[str, str] = {"home": home, "app": app}
        # Skip ``repo`` when it matches ``app`` to avoid double-counting the
        # common case where the app script lives at the repo root. ``normcase``
        # handles case-insensitive filesystems (Windows, default macOS).
        if repo is not None and os.path.normcase(repo) != os.path.normcase(app):
            roots["repo"] = repo

        # Also scan the in-app installer's resolved project root — the very same
        # ``_find_project_root`` the one-click install writes to — so a
        # successful install is always detected, even when it lands in a dir
        # that is neither ``app`` nor the git root (e.g. a monorepo per-package
        # ``.agents``/``.claude``, or a project nested far below its git root).
        # Sharing the resolver (instead of a mirror) keeps install and detection
        # from ever drifting apart.
        project = str(_find_project_root(Path(app)))
        project_nc = os.path.normcase(project)
        if project_nc != os.path.normcase(app) and (
            repo is None or project_nc != os.path.normcase(repo)
        ):
            roots["project"] = project

        tokens: set[str] = set()
        for location, root in roots.items():
            for harness, project_dir, home_skills_dir, agent_home_dir in _HARNESSES:
                # At home level, skip harnesses that aren't installed at all
                # (saves 2 isfile calls per absent harness — common on hosted
                # apps where no skills or harnesses exist).
                if location == "home" and not os.path.isdir(
                    os.path.join(root, agent_home_dir)
                ):
                    continue
                harness_dir = home_skills_dir if location == "home" else project_dir
                for skill in _STREAMLIT_SKILL_NAMES:
                    marker = os.path.join(
                        root, harness_dir, skill, _SKILL_MARKER_FILENAME
                    )
                    if os.path.isfile(marker):
                        tokens.add(f"{location}:{harness}:{skill}")
        return tuple(sorted(tokens))
    except Exception as ex:  # pragma: no cover - defensive
        _LOGGER.debug("Failed to detect installed Streamlit skills", exc_info=ex)
        return ()


def detect_installed_agents() -> list[str]:
    """Detect agent harnesses installed under the user's home directory.

    Returns a sorted, deduplicated list of harness name tokens (``agents``,
    ``claude``, ``codex``, ``copilot``, ``cortex``, ``cursor``, ``gemini``, ``opencode``)
    for each harness whose home-level config directory exists. Independent
    of whether Streamlit-specific skills are installed for that harness.

    The result is cached for the lifetime of the process. Never raises:
    filesystem errors are swallowed and produce an empty list.
    """
    return list(_detect_installed_agents_cached())


@lru_cache(maxsize=1)
def _detect_installed_agents_cached() -> tuple[str, ...]:
    try:
        home = os.path.expanduser("~")
        tokens: set[str] = set()
        for harness, _project_dir, _home_skills_dir, agent_home_dir in _HARNESSES:
            if os.path.isdir(os.path.join(home, agent_home_dir)):
                tokens.add(harness)
        return tuple(sorted(tokens))
    except Exception as ex:  # pragma: no cover - defensive
        _LOGGER.debug("Failed to detect installed agents", exc_info=ex)
        return ()


def clear_installed_skills_cache() -> None:
    """Invalidate the cached installed-skills detection.

    Call after installing skills so a subsequent ``detect_installed_skills``
    in the same process re-scans the filesystem instead of returning the
    stale (pre-install) result.
    """
    _detect_installed_skills_cached.cache_clear()


def should_show_skills_nudge(app_dir: str | None = None) -> bool:
    """Return whether the in-app "install skills" nudge should be shown.

    The nudge is recommended only for interactive local development where an
    AI agent harness is present but the bundled Streamlit skills are not yet
    installed, and the user has not permanently dismissed it. This mirrors the
    gating of the CLI recommendation printed on app startup.

    Parameters
    ----------
    app_dir
        Directory of the running app's main script, used to detect
        project-local skills. Pass the same value the page-profile telemetry
        uses (``dirname(main_script_path)``) so both share the cached
        detection result. Falls back to the current working directory when
        ``None``.

    Best-effort: returns ``False`` on any error so a detection failure never
    blocks app startup or surfaces a spurious nudge.
    """
    from streamlit import config

    try:
        if config.get_option("server.headless"):
            # Don't nudge in headless mode (e.g. deployments, CI, SiS).
            return False
        if config.get_option("logger.hideWelcomeMessage"):
            return False
        if _nudge_dismissed_marker_path().exists():
            return False
        # Gate on the same detection the page-profile telemetry uses (both now
        # defined here): an agent must be present, and our skills must not be
        # installed yet.
        if not detect_installed_agents():
            return False
        # An agent is present; recommend installing only if our skills aren't.
        return not detect_installed_skills(app_dir)
    except Exception:  # pragma: no cover - defensive
        return False
