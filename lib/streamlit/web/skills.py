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

import contextlib
import errno
import os
import shutil
import sys
import tempfile
import time
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Final, Literal

import click

import streamlit
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)

# Skill name installed in global mode
_GLOBAL_SKILL_NAME: Final[str] = "developing-with-streamlit"

# Prefix for the scratch directories a replacement install stages into. Only
# ``mkdtemp`` produces these names, which is what makes the cleanup sweep in
# _sweep_staging_dirs safe to run against a directory holding user files.
#
# Kept deliberately short, as are the child names below: staging adds a path
# segment, and Windows still caps paths at 260 characters without long-path
# support - which is itself one of the failure causes this telemetry is meant to
# identify. Lengthening the path while hunting a path-length bug would be its own
# footgun.
_STAGING_PREFIX: Final[str] = ".st-skills-"
# Children of the staging dir: the incoming copy and the displaced old install.
# Single letters for the same path-budget reason; neither name is ever user-visible.
_STAGING_NEW: Final[str] = "n"
_STAGING_OLD: Final[str] = "o"
# How long a staging dir must sit untouched before the sweep will reclaim it. A live
# install writes into staging within seconds, so anything older was orphaned by a crash
# or a kill - and anything younger may belong to a concurrent install whose staging dir
# holds the only copy of the installation it has already moved aside.
_STAGING_ORPHAN_AGE_S: Final[float] = 3600.0
# Where a staging dir is moved when it holds the user's only copies (both the swap and
# the restore failed). Deliberately NOT under _STAGING_PREFIX: the orphan sweep must be
# unable to match it, or it would eventually delete the data it was retained to save.
# Nothing reclaims these - that is the point - and the failure is logged with the path.
_RECOVERY_PREFIX: Final[str] = ".st-recover-"
# Sentinel written into every staging dir. The sweep requires it before deleting, so a
# hidden user directory that merely shares the prefix is never touched: mkdtemp
# guarantees uniqueness for the *creating* side, but the sweep matches on name and age,
# which is a convention rather than proof of ownership.
_STAGING_MARKER: Final[str] = ".streamlit-owned"

# The full vocabulary of install-failure causes. Closed so the reason is safe to emit
# as a telemetry label, and a Literal so mypy rejects a typo'd or ad-hoc reason at the
# raise site rather than silently minting a label no query knows about.
_InstallFailureReason = Literal[
    "conflict",  # A pre-existing file or foreign symlink we won't overwrite.
    "incomplete",  # Project symlinks failed and the global fallback was cancelled.
    "no_skills",  # The bundled skills dir exists but contains nothing installable.
    "non_interactive",  # No TTY to prompt on and --yes wasn't passed.
    "source_missing",  # The bundled skills dir is absent from the installation.
    "source_incomplete",  # The dir is present but a required file is missing.
    "symlinks_unsupported",  # Project install needs symlinks; this OS won't make them.
    "write_denied",  # Permissions, or a read-only filesystem.
    "write_locked",  # Another process holds the path (antivirus, sync clients).
    "write_name_too_long",  # The path exceeded the OS limit (Windows MAX_PATH).
    "write_no_space",  # Out of disk, or over a quota.
    "write_failed",  # A write failed for a reason none of the above cover.
]

# Why a project install was rerouted to a global copy. Split finely because most
# Windows users take this path and then SUCCEED, so this - not the failure vocabulary
# above - is where their diagnostic signal lives, and only the first is a cause a user
# can fix themselves.
_FallbackReason = Literal[
    "symlinks_no_privilege",  # Windows Developer Mode off (ERROR_PRIVILEGE_NOT_HELD).
    "symlinks_denied",  # Permissions on the project dir refused the probe.
    "symlinks_unsupported",  # The filesystem/OS has no directory symlinks.
    "symlink_failed",  # Pre-check passed, then an individual link would not lay.
]

# OSError.errno -> reason. Built by name so a platform missing one of these (they
# are not all defined everywhere) simply omits it rather than failing at import.
_ERRNO_GROUPS: Final[tuple[tuple[tuple[str, ...], _InstallFailureReason], ...]] = (
    (("EACCES", "EPERM", "EROFS"), "write_denied"),
    # EFBIG is deliberately absent: a file-size limit is not out of space.
    (("ENOSPC", "EDQUOT"), "write_no_space"),
    # EAGAIN belongs here on retry semantics rather than locking specifically.
    (("EBUSY", "EAGAIN", "ETXTBSY"), "write_locked"),
    (("ENAMETOOLONG",), "write_name_too_long"),
)
_WRITE_REASON_BY_ERRNO: Final[dict[int, _InstallFailureReason]] = {
    code: reason
    for names, reason in _ERRNO_GROUPS
    for name in names
    if (code := getattr(errno, name, None)) is not None
}

# Consulted BEFORE errno: CPython's mapping is lossy in the one direction that would
# mislead us. A sharing violation (antivirus or a sync client holding the file) arrives
# as EACCES, so trusting errno on Windows sends us after folder ACLs when the fix is to
# retry.
_WRITE_REASON_BY_WINERROR: Final[dict[int, _InstallFailureReason]] = {
    5: "write_denied",  # ERROR_ACCESS_DENIED
    19: "write_denied",  # ERROR_WRITE_PROTECT
    32: "write_locked",  # ERROR_SHARING_VIOLATION
    33: "write_locked",  # ERROR_LOCK_VIOLATION
    39: "write_no_space",  # ERROR_HANDLE_DISK_FULL
    112: "write_no_space",  # ERROR_DISK_FULL
    206: "write_name_too_long",  # ERROR_FILENAME_EXCED_RANGE
}


def classify_write_error(error: OSError) -> _InstallFailureReason:
    """Map a filesystem ``OSError`` to a bounded, actionable failure reason.

    Only the error *class* is used, never the message, which can embed an absolute
    server path - so the result stays safe to emit as a telemetry label. An
    unrecognised code stays the generic ``"write_failed"`` rather than being guessed
    into a specific bucket that would point at the wrong fix.
    """
    winerror = getattr(error, "winerror", None)
    if isinstance(winerror, int) and winerror in _WRITE_REASON_BY_WINERROR:
        return _WRITE_REASON_BY_WINERROR[winerror]
    if error.errno is not None and error.errno in _WRITE_REASON_BY_ERRNO:
        return _WRITE_REASON_BY_ERRNO[error.errno]
    return "write_failed"


class InstallError(click.ClickException):
    """A skills-install failure carrying a stable machine-readable ``reason`` code.

    The backend-operation handler forwards the ``reason`` to the client, which emits
    it as a telemetry label suffix - hence the fixed :data:`_InstallFailureReason`
    vocabulary, never user input. Behaves like a plain ``click.ClickException``
    otherwise, so raising it changes nothing a user sees.
    """

    def __init__(self, message: str, *, reason: _InstallFailureReason) -> None:
        super().__init__(message)
        self.reason = reason


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
        lines.extend(f"{rel_dir}/{skill_name}" for skill_name in skills)
    return "\n".join(lines)


@dataclass
class _InstallResult:
    """Result of a skill installation attempt."""

    installed: list[str] = field(default_factory=list)
    up_to_date: list[str] = field(default_factory=list)
    # Pre-existing files/symlinks we won't overwrite - a genuine "conflict".
    skipped: list[str] = field(default_factory=list)
    # Filesystem failures during the global copy. Kept apart from ``skipped`` so a
    # write failure is never misreported as a "conflict", in the CLI summary and in
    # the nudge's telemetry reason. Only the copy path fills this.
    errored: list[str] = field(default_factory=list)
    # The distinct causes behind ``errored``. A set, not a per-entry list: the only
    # consumer asks whether the failed targets agreed on one cause, never which
    # target had which. Separate from the display strings above, which carry raw
    # OSError text that must not reach the browser.
    write_reasons: set[_InstallFailureReason] = field(default_factory=set)
    # Set when a project install was rerouted to a global copy, naming why. Surfaced
    # to telemetry so that cohort is countable - see InstallSkillsResponsePayload.
    fallback_reason: _FallbackReason | None = None


def _get_source_skills_dir() -> Path:
    """Get the path to bundled skills in the Streamlit package."""
    package_dir = Path(streamlit.__file__).parent
    return package_dir / ".agents" / "skills"


def _get_meta_skill_dir() -> Path:
    """Get the path to the bundled, version-agnostic meta-skill in the package.

    The meta-skill (a thin ``SKILL.md`` router plus ``scripts/discover.py``) is
    vendored in the wheel so global installs can copy it from local disk instead
    of downloading it from GitHub. ``discover.py`` finds the project's installed
    Streamlit at runtime and points the agent at the version-matched bundled
    content skills, so a single global install stays correct across Streamlit
    versions. It lives outside ``.agents/skills`` so project-mode discovery and
    skill detection never treat it as an installable content skill.
    """
    package_dir = Path(streamlit.__file__).parent
    return package_dir / ".agents" / "meta-skill"


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


def _symlink_blocker(project_root: Path, source_path: Path) -> _FallbackReason | None:
    """Return why project install can't use symlinks here, or ``None`` if it can.

    Probes by actually creating one in a temp dir, then classifies the failure rather
    than collapsing it to "unsupported" - most Windows users land here and then
    *succeed* via the global fallback, so this is what their success label carries,
    and only ``symlinks_no_privilege`` (Developer Mode off) is a cause a user can fix.
    """
    try:
        with tempfile.TemporaryDirectory(
            prefix=".streamlit-skills-", dir=project_root
        ) as temp_dir:
            link_path = Path(temp_dir) / "skill-link"
            link_path.symlink_to(source_path, target_is_directory=True)
            if link_path.is_symlink():
                return None
            # Created without error yet isn't a symlink: treat as unsupported rather
            # than claiming success we can't verify.
            return "symlinks_unsupported"
    except NotImplementedError:
        return "symlinks_unsupported"
    except OSError as e:
        # ERROR_PRIVILEGE_NOT_HELD: the account lacks SeCreateSymbolicLinkPrivilege,
        # which in practice means Windows Developer Mode is off. Distinguishing this
        # is the point of the exercise - it is the one cause a user can simply fix.
        if getattr(e, "winerror", None) == 1314:
            return "symlinks_no_privilege"
        # ``errno`` is Optional on OSError, and dict.get is typed to reject None, so
        # the guard is for the type checker rather than for runtime behaviour.
        if (
            e.errno is not None
            and _WRITE_REASON_BY_ERRNO.get(e.errno) == "write_denied"
        ):
            return "symlinks_denied"
        return "symlinks_unsupported"


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

    # Pre-symlink filesystem work runs under one guard: any OSError here means we
    # can't lay the symlink, so return False and let the caller fall back to a global
    # copy rather than letting it escape and be misbooked as a hard write failure.
    replace_owned_link = False
    try:
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
                    # Broken symlink or resolution error - check ownership below
                    pass

                # Check if it's a Streamlit-owned symlink we can replace. Don't
                # remove it yet - see the staged replacement below.
                if _is_streamlit_owned_symlink(target_path, bundled_skill_names):
                    replace_owned_link = True
                else:
                    result.skipped.append(f"{rel_target_path} (existing symlink)")
                    return True
            else:
                # Regular file or directory - skip
                result.skipped.append(f"{rel_target_path} (existing file or directory)")
                return True
    except (OSError, NotImplementedError):
        return False

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

    # Replacing an existing link is staged: ``symlink_to`` won't overwrite, so the
    # old one has to go first, and "remove then re-create" loses a working install
    # whenever the re-create fails. Since a failing re-create means this system
    # can't make symlinks at all, an attempt to restore would fail for the same
    # reason. So prove we can make the link - inside a private staging dir - BEFORE
    # removing anything. If that fails, the existing install is still untouched.
    staging: Path | None = None
    link_path = target_path
    if replace_owned_link:
        try:
            staging = _open_staging_dir(target_dir)
        except OSError:
            return False
        # ``rel_source`` is relative to target_dir, so while the link sits one level
        # down in staging it dangles. Nothing reads it there, and the rename below
        # moves the link verbatim, after which it resolves.
        link_path = staging / _STAGING_NEW

    try:
        link_path.symlink_to(rel_source, target_is_directory=True)
    except (OSError, NotImplementedError):
        # Symlink not supported (e.g., Windows without Developer Mode, or some
        # environments where symlinks are not implemented). Nothing was removed.
        if staging is not None:
            shutil.rmtree(staging, ignore_errors=True)
        return False

    if staging is not None:
        # Move the old link aside rather than unlinking it, mirroring the copy path:
        # if the swap then fails, the canonical path can be restored from staging
        # instead of being left empty.
        displaced = staging / _STAGING_OLD
        try:
            target_path.rename(displaced)
            link_path.rename(target_path)
        except OSError:
            if target_path.exists() or target_path.is_symlink():
                # The move-aside failed, so the old install is intact and the staged
                # link is redundant. Drop it and let the caller fall back.
                #
                # Removing this branch happens to reach the same state today - the
                # direct-lay attempt below would hit FileExistsError and unwind here
                # anyway - so no test can isolate it. Keep it regardless: it means an
                # intact install is never a target we attempt to overwrite, rather
                # than relying on symlink_to refusing to.
                shutil.rmtree(staging, ignore_errors=True)
                return False
            # The old link is out of the way but the staged one wouldn't move, leaving
            # the canonical path empty. Creating a link here demonstrably works - we
            # just made one - so lay it directly.
            try:
                target_path.symlink_to(rel_source, target_is_directory=True)
            except OSError:
                # Last resort: put the displaced link back, so the canonical path is
                # populated even though this install failed.
                with contextlib.suppress(OSError):
                    displaced.rename(target_path)
                if not (target_path.exists() or target_path.is_symlink()):
                    # The restore didn't land either, so staging holds the only copy
                    # of the old link. Deleting it here would destroy the very thing
                    # the move-aside preserved. Keep it, and drop the ownership marker
                    # so the sweep can't take it later either.
                    with contextlib.suppress(OSError):
                        (staging / _STAGING_MARKER).unlink()
                    return False
                shutil.rmtree(staging, ignore_errors=True)
                return False
        shutil.rmtree(staging, ignore_errors=True)

    result.installed.append(str(rel_target_path))
    return True


def _open_staging_dir(target_dir: Path) -> Path:
    """Create a private scratch directory inside ``target_dir`` for a replacement.

    Replacing an installed skill can't be done in one step: ``symlink_to`` won't
    overwrite, and no OS offers an atomic replace for a non-empty directory
    (``rename`` onto one gives ``ENOTEMPTY``, or ``PermissionError`` on Windows).
    So a replacement has to build the new copy somewhere else first and then swap
    it in, which raises the question of *where* "somewhere else" is.

    Three options, and why this is the one:

    - **A fixed sibling name** (``.<skill>.tmp``) is predictable, so clearing it
      before use can recursively delete a directory the installer never created,
      and two concurrent installs silently clobber each other's scratch space.
    - **A unique name with no cleanup** can't collide, but every interrupted
      install leaves a permanent orphan directory in a folder users browse and
      gitignore.
    - **A unique name plus a prefix-scoped sweep** — this. ``mkdtemp`` guarantees
      the directory is ours and fresh, so nothing is ever deleted that we didn't
      create; :func:`_sweep_staging_dirs` reclaims orphans on the next install by
      matching only our own prefix, so they don't accumulate either.

    The one accepted consequence: a staging directory deliberately left behind by
    an unrecoverable swap (see :func:`_install_skill_copy`) is reclaimed by the
    next install's sweep. That is bounded — anything in it is a copy of a bundled
    skill, reproducible from the wheel — and by the time the sweep runs, the
    install that follows it repopulates the canonical path anyway.
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    _sweep_staging_dirs(target_dir)
    staging = Path(tempfile.mkdtemp(dir=target_dir, prefix=_STAGING_PREFIX))
    (staging / _STAGING_MARKER).touch()
    return staging


def _sweep_staging_dirs(target_dir: Path) -> None:
    """Reclaim staging directories orphaned by an interrupted install.

    Two guards, both load-bearing:

    - A candidate must both match :data:`_STAGING_PREFIX` and contain the
      :data:`_STAGING_MARKER` sentinel. The prefix alone is a convention; the marker
      is proof we created it, so a hidden user directory that happens to share the
      prefix is never removed.
    - Only directories untouched for :data:`_STAGING_ORPHAN_AGE_S` are removed.
      Sweeping on name alone would delete a *concurrent* install's staging
      directory - which may already hold the old installation it moved aside, so
      the sweep would take out both that and its replacement and leave the
      canonical path empty. Orphan cleanup turning into data loss is worse than
      the orphans it set out to prevent. A live install writes into staging within
      seconds, so age separates the two cleanly without needing a lock.

    Best-effort throughout: failing to tidy up must never fail an install.
    """
    cutoff = time.time() - _STAGING_ORPHAN_AGE_S
    with contextlib.suppress(OSError):
        for stale in target_dir.glob(f"{_STAGING_PREFIX}*"):
            with contextlib.suppress(OSError):
                if (
                    stale / _STAGING_MARKER
                ).is_file() and stale.stat().st_mtime < cutoff:
                    shutil.rmtree(stale, ignore_errors=True)


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

    # All filesystem work runs under one try so a failure at ANY step is recorded as
    # a write failure classified by errno, instead of escaping as an uncaught OSError
    # the caller can only classify as "unknown".
    staging: Path | None = None
    unrecoverable = False
    try:
        # Ensure parent directory exists
        target_dir.mkdir(parents=True, exist_ok=True)

        old_target_to_remove: Path | None = None

        if target_path.exists() or target_path.is_symlink():
            # Target exists - check if we can replace it
            if target_path.is_symlink():
                if not _is_streamlit_owned_symlink(target_path, bundled_skill_names):
                    result.skipped.append(f"{rel_target_path} (existing symlink)")
                    return
                # Defer removal until after the copy succeeds, same as a directory.
                # Unlinking here instead would send this case down the plain-copytree
                # branch below, so a failed copy would delete a working skill and
                # leave nothing - the exact loss the staged swap exists to prevent.
                old_target_to_remove = target_path
            elif target_path.is_dir():
                if _skill_copy_matches(source_path, target_path):
                    result.up_to_date.append(str(rel_target_path))
                    return
                old_target_to_remove = target_path
            else:
                result.skipped.append(f"{rel_target_path} (existing file)")
                return

        # A replacement builds the new copy in a private staging dir and swaps it
        # in, so a failed copy leaves the working installation in place. See
        # _open_staging_dir for why staging is a fresh mkdtemp.
        if old_target_to_remove is not None:
            staging = _open_staging_dir(target_dir)
            new_path = staging / _STAGING_NEW
            backup_path = staging / _STAGING_OLD
            shutil.copytree(source_path, new_path)
            # Move the old target aside rather than deleting it: if the swap then
            # fails we can put it back, instead of stranding the new copy in
            # staging with nothing at the path the agent looks in.
            old_target_to_remove.rename(backup_path)
            try:
                new_path.rename(target_path)
            except OSError:
                # Put the old install back, then let the handler below record the
                # write failure. There is no atomic replace for a non-empty
                # directory on either POSIX or Windows, so this move-aside dance is
                # the best available and a restore that ALSO fails can't be
                # recovered in code. Log where both copies ended up - the
                # user-facing message deliberately carries no server paths, so this
                # is the only way the state is diagnosable.
                try:
                    backup_path.rename(target_path)
                except OSError:
                    unrecoverable = True
                raise
        else:
            shutil.copytree(source_path, target_path)
        result.installed.append(str(rel_target_path))
    except OSError as e:
        # A write failure, not a conflict - record it in ``errored`` so it is
        # classified as such, not "conflict", and note the errno-derived cause so the
        # telemetry reason names which write failed.
        result.errored.append(f"{rel_target_path} (copy failed: {e})")
        result.write_reasons.add(classify_write_error(e))
    finally:
        # Dropping staging is bookkeeping and must never turn a landed install into a
        # reported failure, hence the suppression throughout.
        if staging is not None:
            if unrecoverable:
                # Both the swap and the restore failed, so staging holds the only
                # copies of the old install and its replacement. Move it OUT of the
                # swept namespace: leaving it under _STAGING_PREFIX would let a later
                # install's orphan sweep delete the very thing we kept it for. The
                # contents are usually reproducible from the wheel, but not if the
                # user had edited their installed skill - so this is not ours to
                # garbage-collect on a timer.
                # Best-effort: relocating is itself a rename, and rename may be the
                # very operation failing here. If it doesn't work the copies stay
                # under the staging prefix, where only the age gate protects them -
                # hence the log below naming their location either way.
                keep = staging.with_name(
                    _RECOVERY_PREFIX + staging.name[len(_STAGING_PREFIX) :]
                )
                with contextlib.suppress(OSError):
                    staging.rename(keep)
                    staging = keep
                if staging.name.startswith(_STAGING_PREFIX):
                    # The relocation didn't take - rename may be the very operation
                    # failing here. Drop the ownership marker instead: the sweep
                    # requires it, so removing it makes this directory permanently
                    # invisible to cleanup. Unlinking one small file is far likelier
                    # to succeed than renaming a directory, so between the two the
                    # retained copies are protected whichever operation is broken.
                    with contextlib.suppress(OSError):
                        (staging / _STAGING_MARKER).unlink()
                _LOGGER.warning(
                    "Skills install left %s empty. The previous install is at %s and "
                    "the new copy at %s - move either one back to recover. Nothing "
                    "will clean this up automatically.",
                    target_path,
                    staging / _STAGING_OLD,
                    staging / _STAGING_NEW,
                )
            else:
                with contextlib.suppress(OSError):
                    shutil.rmtree(staging, ignore_errors=True)


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

    if result.errored:
        click.secho("\n✗ Failed to write:", fg="red", bold=True)
        for path in result.errored:
            click.echo(f"  {click.style('→', fg='red')} {path}")


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
    click.echo("Installing globally")

    click.secho("\nSource:", bold=True)
    click.echo(
        f"  {click.style('•', fg='magenta')} "
        f"{click.style(str(_get_meta_skill_dir() / _GLOBAL_SKILL_NAME), fg='cyan')}"
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


def _concise_install_paths(entries: list[str]) -> list[str]:
    """Collapse ``_InstallResult`` entries to short paths safe to show a user.

    Entries look like ``"<path> (why)"``. Both failure messages built from them are
    shown verbatim in the in-app nudge, so keep only the ``<harness>/skills/<skill>``
    tail and drop the parenthetical: neither an absolute server path nor a raw
    ``OSError`` string may reach the browser.
    """
    paths = []
    for entry in entries:
        raw = entry.split(" (", 1)[0]
        parts = Path(raw).parts
        paths.append(Path(*parts[-3:]).as_posix() if len(parts) >= 3 else raw)
    return paths


def _conflict_error(skipped: list[str]) -> InstallError:
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
    paths = _concise_install_paths(skipped)
    joined = ", ".join(paths)
    plural = len(paths) != 1
    return InstallError(
        f"{joined} already exist{'' if plural else 's'}. "
        f"Remove {'them' if plural else 'it'} and try again.",
        reason="conflict",
    )


def _write_error(result: _InstallResult) -> InstallError:
    """Build a "couldn't write" error for filesystem failures during copy.

    Distinct from :func:`_conflict_error`, which reports pre-existing files.

    The reason follows what the failed targets agreed on:

    - all agreed on one cause -> that cause
    - they disagreed -> the generic ``write_failed``, because claiming "permission
      denied" for a set that was half permissions and half disk-full would point
      whoever reads the telemetry at the wrong fix
    """
    joined = ", ".join(_concise_install_paths(result.errored))
    reasons = result.write_reasons
    reason: _InstallFailureReason = (
        next(iter(reasons)) if len(reasons) == 1 else "write_failed"
    )
    return InstallError(
        f"Could not write {joined}. Check folder permissions and free disk "
        "space, then try again.",
        reason=reason,
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
        # Keep the absolute path in the server log only - this message is shown
        # verbatim in the in-app nudge, so it must not leak a server path.
        _LOGGER.warning("Bundled skills directory not found at %s", source_skills_dir)
        raise InstallError(
            "Bundled skills were not found in your Streamlit installation. "
            "Reinstall Streamlit and try again.",
            reason="source_missing",
        )

    skills = _discover_skills(source_skills_dir)
    if not skills:
        raise InstallError(
            "No installable skills found in Streamlit package.", reason="no_skills"
        )

    # Determine targets. The in-app installer passes ``app_dir`` so the project
    # root resolves from the running app's directory (matching the nudge's skill
    # detection), instead of the server's working directory.
    project_root = _find_project_root(Path(app_dir) if app_dir else None)
    target_dirs = _get_project_target_dirs(project_root)

    symlink_blocker = _symlink_blocker(project_root, source_skills_dir / skills[0])
    if symlink_blocker is not None:
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
            global_result = _install_global_skills(yes=yes)
            global_result.fallback_reason = symlink_blocker
            return global_result

        raise InstallError(
            "Symlinks not supported. Use --global for global installation.",
            reason="symlinks_unsupported",
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
            global_result = _install_global_skills(yes=yes)
            # The pre-check said symlinks work here, yet laying one still failed -
            # distinct from the categorical case above, and worth chasing separately.
            global_result.fallback_reason = "symlink_failed"
            return global_result
        except click.ClickException:
            # Global install failed - partial project symlinks remain as fallback
            raise
        except click.exceptions.Abort:
            # User cancelled global install - report that nothing was fully installed
            raise InstallError(
                "Installation incomplete. Project symlinks failed and global install "
                "was cancelled.",
                reason="incomplete",
            )

    if symlink_failed:
        raise InstallError(
            "Symlinks not supported. Use --global for global installation.",
            reason="symlinks_unsupported",
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
    """Install the version-agnostic meta-skill globally from the local package.

    The meta-skill is vendored inside the installed ``streamlit`` package
    (:func:`_get_meta_skill_dir`), so we copy it from local disk with no network
    dependency. The old implementation downloaded it from GitHub, which made the
    in-app one-click install fail for ~1 in 8 Windows users on locked-down
    networks (see issue #15933) and raised a security review of runtime external
    downloads. Copying the bundled meta-skill removes both problems; its
    ``discover.py`` still resolves the version-matched content skills at runtime,
    so a single global install stays correct across Streamlit versions.
    """
    target_dirs = _get_global_target_dirs()

    # Confirm installation
    if not yes and not _confirm_global_installation(target_dirs):
        click.echo("Installation cancelled.")
        raise click.Abort()

    # The meta-skill ships in the wheel; copy it from local disk (no network).
    meta_skill_dir = _get_meta_skill_dir()
    meta_skill = meta_skill_dir / _GLOBAL_SKILL_NAME
    # The meta-skill is a router (SKILL.md) plus the discover.py it points the
    # agent at; SKILL.md alone is inert. Require BOTH so a stripped wheel or a
    # too-narrow package-data glob surfaces as an error instead of a "successful"
    # install of a skill that fails the moment an agent runs discover.py.
    if not (
        (meta_skill / "SKILL.md").is_file()
        and (meta_skill / "scripts" / "discover.py").is_file()
    ):
        # Keep the absolute path in the server log only - this message is shown
        # verbatim in the in-app nudge, so it must not leak a server path.
        _LOGGER.warning(
            "Bundled meta-skill %r is incomplete under %s "
            "(need SKILL.md + scripts/discover.py)",
            _GLOBAL_SKILL_NAME,
            meta_skill_dir,
        )
        raise InstallError(
            f"The bundled '{_GLOBAL_SKILL_NAME}' meta-skill was not found in your "
            "Streamlit installation. Reinstall Streamlit and try again.",
            # Distinct from source_missing: the directory is there but a required
            # file is not, which points at a too-narrow package-data glob rather
            # than skills being absent from the wheel entirely.
            reason="source_incomplete",
        )

    # Install to each target directory
    result = _InstallResult()
    # For global install, only one skill is installed but we use a set for consistency
    bundled_skill_names = {_GLOBAL_SKILL_NAME}
    for target_dir in target_dirs:
        _install_skill_copy(
            _GLOBAL_SKILL_NAME,
            meta_skill_dir,
            target_dir,
            result,
            bundled_skill_names,
        )

    # Report results
    _print_result(result)

    # A write failure on ANY target is a hard failure, even if another target
    # succeeded - otherwise a partial install (e.g. ~/.agents ok but ~/.claude
    # denied) reports success and drops skillsNudgeInstallFailed:write_failed.
    if result.errored:
        raise _write_error(result)

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
        raise InstallError(
            "Non-interactive terminal detected. Use --yes to skip prompts.",
            reason="non_interactive",
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

    Uses a bounded stdlib ancestor walk instead of Git or a Git library. Hosted-app
    startup hits this via ``create_page_profile_message``, and the walk stays ~1ms
    cold for a signal that is usually ``None`` there.
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
