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

"""Tests for the automatic update of global meta-skill copies."""

from __future__ import annotations

import errno
import hashlib
import os
import re
import stat
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from packaging.version import Version

from streamlit.version import STREAMLIT_VERSION_STRING
from streamlit.web import skills
from tests import testutil

if TYPE_CHECKING:
    from collections.abc import Iterator

_OLD_SKILL_MD = "---\nname: developing-with-streamlit\n---\n\nold router\n"
_OLD_DISCOVER = "print('old')\n"
_NEW_SKILL_MD = "---\nname: developing-with-streamlit\n---\n\nnew router\n"
_NEW_DISCOVER = "print('new')\n"
_OLD_FILES = {"SKILL.md": _OLD_SKILL_MD, "scripts/discover.py": _OLD_DISCOVER}
_NEW_FILES = {"SKILL.md": _NEW_SKILL_MD, "scripts/discover.py": _NEW_DISCOVER}


def _digest(content: str) -> str:
    """Return the SHA-256 hex digest of ``content``."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _write_skill_folder(
    root: Path, skills_dir: str, files: dict[str, str], newline: str = "\n"
) -> Path:
    """Write a meta-skill copy under ``root / skills_dir`` and return its folder."""
    copy = root / skills_dir / "developing-with-streamlit"
    for name, content in files.items():
        (copy / name).parent.mkdir(parents=True, exist_ok=True)
        (copy / name).write_bytes(content.replace("\n", newline).encode("utf-8"))
    return copy


def _files(folder: Path) -> dict[str, str]:
    """Map every file under ``folder`` to its text, keyed by relative POSIX path."""
    return {
        path.relative_to(folder).as_posix(): path.read_text(encoding="utf-8")
        for path in sorted(folder.rglob("*"))
        if path.is_file()
    }


@pytest.fixture
def bundled(tmp_path: Path) -> Iterator[Path]:
    """Bundle the new fake meta-skill, list it and the old one as official
    releases, and return the bundled skill folder.
    """
    meta_skill_dir = tmp_path / "package" / "meta-skill"
    skill = _write_skill_folder(meta_skill_dir, "", _NEW_FILES)
    (skill / "scripts" / "__pycache__").mkdir()
    (skill / "scripts" / "__pycache__" / "discover.cpython-312.pyc").write_text("x")
    official = {
        "SKILL.md": frozenset({_digest(_OLD_SKILL_MD), _digest(_NEW_SKILL_MD)}),
        "scripts/discover.py": frozenset(
            {_digest(_OLD_DISCOVER), _digest(_NEW_DISCOVER)}
        ),
    }
    with (
        patch.object(skills, "_get_meta_skill_dir", return_value=meta_skill_dir),
        patch.object(skills, "_META_SKILL_DIGESTS", official),
    ):
        yield skill


@pytest.fixture
def home(tmp_path: Path) -> Iterator[Path]:
    """Point ``Path.home()`` at an empty temporary home directory."""
    home_dir = tmp_path / "home"
    home_dir.mkdir()
    with patch.object(Path, "home", return_value=home_dir):
        yield home_dir


@pytest.mark.usefixtures("bundled")
def test_updates_official_copies_in_home_skills_dirs(
    home: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Official copies in any harness's home skills dir are replaced, without the
    bytecode cache, keeping unrelated hidden files, and one line says where.
    """
    agents_copy = _write_skill_folder(home, ".agents/skills", _OLD_FILES)
    cursor_copy = _write_skill_folder(home, ".cursor/skills", _OLD_FILES)
    (cursor_copy / ".DS_Store").write_text("finder", encoding="utf-8")

    skills.update_global_skills()

    assert _files(agents_copy) == _NEW_FILES
    assert _files(cursor_copy) == {**_NEW_FILES, ".DS_Store": "finder"}
    locations = f"{Path('~', '.agents', 'skills')}, {Path('~', '.cursor', 'skills')}"
    assert capsys.readouterr().out == (
        f"  Updated the global Streamlit agent skills ({locations}).\n\n"
    )


@pytest.mark.usefixtures("bundled")
def test_hide_welcome_message_updates_copies_without_printing(
    home: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """``logger.hideWelcomeMessage`` silences the update line, not the update."""
    copy = _write_skill_folder(home, ".claude/skills", _OLD_FILES)

    with testutil.patch_config_options({"logger.hideWelcomeMessage": True}):
        skills.update_global_skills()

    assert _files(copy) == _NEW_FILES
    assert capsys.readouterr().out == ""


@pytest.mark.usefixtures("bundled")
def test_updates_official_copy_with_crlf_line_endings(home: Path) -> None:
    """A copy whose files only differ from a release by line endings is official."""
    copy = _write_skill_folder(home, ".claude/skills", _OLD_FILES, newline="\r\n")

    skills.update_global_skills()

    assert _files(copy) == _NEW_FILES


@pytest.mark.usefixtures("bundled")
def test_adds_bundled_files_missing_from_an_official_copy(home: Path) -> None:
    """An official copy that lacks a bundled file gets it, folder included."""
    copy = _write_skill_folder(home, ".claude/skills", {"SKILL.md": _OLD_SKILL_MD})

    skills.update_global_skills()

    assert _files(copy) == _NEW_FILES


@pytest.mark.parametrize(
    "files",
    [
        pytest.param(
            {**_OLD_FILES, "SKILL.md": "edited or newer router\n"},
            id="unknown-skill-md",
        ),
        pytest.param({"scripts/discover.py": _OLD_DISCOVER}, id="no-skill-md"),
        pytest.param(
            {**_OLD_FILES, "scripts/discover.py": "print('edited')\n"},
            id="unknown-script",
        ),
        pytest.param(
            {**_OLD_FILES, "references/theme.md": "# Theme\n"},
            id="extra-file",
        ),
    ],
)
@pytest.mark.usefixtures("bundled")
def test_leaves_unofficial_copies_untouched(
    home: Path, capsys: pytest.CaptureFixture[str], files: dict[str, str]
) -> None:
    """Edited copies, copies from a newer release, and other skills are never
    overwritten.
    """
    copy = _write_skill_folder(home, ".claude/skills", files)

    skills.update_global_skills()

    assert _files(copy) == files
    assert capsys.readouterr().out == ""


@pytest.mark.usefixtures("bundled")
def test_up_to_date_copy_is_not_rewritten(
    home: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A copy that matches the bundled skill up to line endings is left as is."""
    copy = _write_skill_folder(home, ".agents/skills", _NEW_FILES, newline="\r\n")

    skills.update_global_skills()

    assert (copy / "SKILL.md").read_bytes() == _NEW_SKILL_MD.replace(
        "\n", "\r\n"
    ).encode("utf-8")
    assert capsys.readouterr().out == ""


@pytest.mark.parametrize("linked", ["skill-folder", "scripts-folder", "skill-md"])
@pytest.mark.usefixtures("bundled")
def test_symlinked_copies_are_not_written_through(
    home: Path, tmp_path: Path, linked: str
) -> None:
    """A copy that is, or contains, a symlink is left alone, so the update never
    writes through a link into files that something else manages.
    """
    elsewhere = _write_skill_folder(tmp_path / "elsewhere", "skills", _OLD_FILES)
    try:
        if linked == "skill-folder":
            link = home / ".claude" / "skills" / "developing-with-streamlit"
            link.parent.mkdir(parents=True)
            link.symlink_to(elsewhere, target_is_directory=True)
        elif linked == "scripts-folder":
            copy = _write_skill_folder(
                home, ".claude/skills", {"SKILL.md": _OLD_SKILL_MD}
            )
            (copy / "scripts").symlink_to(
                elsewhere / "scripts", target_is_directory=True
            )
        else:
            copy = _write_skill_folder(
                home, ".claude/skills", {"scripts/discover.py": _OLD_DISCOVER}
            )
            (copy / "SKILL.md").symlink_to(elsewhere / "SKILL.md")
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks are not supported on this system")

    skills.update_global_skills()

    assert _files(elsewhere) == _OLD_FILES
    skill_file = home / ".claude" / "skills" / "developing-with-streamlit" / "SKILL.md"
    assert skill_file.read_text(encoding="utf-8") == _OLD_SKILL_MD


@pytest.mark.skipif(
    os.name == "nt" or os.geteuid() == 0,
    reason="Needs folder permissions that apply to the current user",
)
@pytest.mark.usefixtures("bundled")
def test_copy_with_an_unlistable_folder_is_left_untouched(home: Path) -> None:
    """A folder the update cannot list stops it, so an edited file inside is
    never overwritten unchecked.
    """
    files = {**_OLD_FILES, "scripts/discover.py": "print('edited')\n"}
    copy = _write_skill_folder(home, ".claude/skills", files)
    scripts = copy / "scripts"
    # Write and search permission, but no read permission to list the folder.
    scripts.chmod(0o300)
    try:
        skills.update_global_skills()
    finally:
        scripts.chmod(0o755)

    assert _files(copy) == files


@pytest.mark.usefixtures("bundled")
def test_copy_with_an_oversized_file_is_left_untouched(home: Path) -> None:
    """A file over the size limit makes a copy unofficial, even when its digest
    is listed.
    """
    oversized = "#" * (skills._MAX_META_SKILL_FILE_BYTES + 1) + "\n"
    files = {**_OLD_FILES, "scripts/discover.py": oversized}
    copy = _write_skill_folder(home, ".claude/skills", files)
    official = skills._META_SKILL_DIGESTS["scripts/discover.py"] | {_digest(oversized)}

    with patch.dict(skills._META_SKILL_DIGESTS, {"scripts/discover.py": official}):
        skills.update_global_skills()

    assert _files(copy) == files


@pytest.mark.usefixtures("bundled")
def test_failed_write_keeps_old_skill_md_until_the_next_start(
    home: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A failed SKILL.md write:

    - keeps the old SKILL.md and leaves no temp file
    - doesn't stop other copies from updating
    - is finished by the next start
    """
    agents_copy = _write_skill_folder(home, ".agents/skills", _OLD_FILES)
    claude_copy = _write_skill_folder(home, ".claude/skills", _OLD_FILES)
    real_replace = os.replace

    def replace(source: str, destination: str) -> None:
        if Path(destination) == claude_copy / "SKILL.md":
            raise PermissionError(errno.EACCES, "Permission denied")
        real_replace(source, destination)

    with patch.object(skills.os, "replace", side_effect=replace):
        skills.update_global_skills()

    assert _files(agents_copy) == _NEW_FILES
    assert _files(claude_copy) == {**_NEW_FILES, "SKILL.md": _OLD_SKILL_MD}
    assert str(Path("~", ".claude", "skills")) not in capsys.readouterr().out

    skills.update_global_skills()

    assert _files(claude_copy) == _NEW_FILES


def test_unlisted_bundled_files_are_never_written(
    bundled: Path, home: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A bundled meta-skill with an unlisted file, such as one edited in a
    development checkout, updates no copy, since no later release could update
    the result.
    """
    (bundled / "SKILL.md").write_text("work in progress\n", encoding="utf-8")
    copy = _write_skill_folder(home, ".claude/skills", _OLD_FILES)

    skills.update_global_skills()

    assert _files(copy) == _OLD_FILES
    assert capsys.readouterr().out == ""


@pytest.mark.skipif(os.name == "nt", reason="Windows only keeps a read-only flag")
def test_replaced_files_keep_their_mode_and_new_files_stay_writable(
    tmp_path: Path,
) -> None:
    """A replaced file keeps its permissions, and a new file copied from a
    read-only bundle gets owner write, so a later update can replace it.
    """
    source = tmp_path / "source.md"
    source.write_text("new", encoding="utf-8")
    source.chmod(0o444)
    existing = tmp_path / "copy" / "existing.md"
    existing.parent.mkdir()
    existing.write_text("old", encoding="utf-8")
    existing.chmod(0o640)
    added = tmp_path / "copy" / "scripts" / "added.md"

    skills._replace_file(source, existing)
    skills._replace_file(source, added)

    assert existing.read_text(encoding="utf-8") == "new"
    assert stat.S_IMODE(existing.stat().st_mode) == 0o640
    assert added.read_text(encoding="utf-8") == "new"
    assert stat.S_IMODE(added.stat().st_mode) == 0o644


@pytest.mark.usefixtures("bundled")
def test_missing_bundled_meta_skill_is_a_silent_no_op(
    home: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Without a bundled meta-skill nothing is written, printed, or raised."""
    copy = _write_skill_folder(home, ".claude/skills", _OLD_FILES)

    with patch.object(skills, "_get_meta_skill_dir", return_value=tmp_path / "gone"):
        skills.update_global_skills()

    assert _files(copy) == _OLD_FILES
    assert capsys.readouterr().out == ""


@pytest.mark.usefixtures("bundled")
def test_unresolvable_home_directory_is_a_silent_no_op(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """When the home directory cannot be determined, the update does nothing."""
    with patch.object(Path, "home", side_effect=RuntimeError("no home")):
        skills.update_global_skills()

    assert capsys.readouterr().out == ""


_SHIPPED_META_SKILL = skills._get_meta_skill_dir() / "developing-with-streamlit"
_SHIPPED_SKILL = skills._get_source_skills_dir() / "developing-with-streamlit"


@pytest.mark.parametrize(
    "relative_path",
    [relative.as_posix() for relative in skills._skill_files(_SHIPPED_META_SKILL)],
)
def test_shipped_meta_skill_files_are_listed_as_official(relative_path: str) -> None:
    """Every shipped meta-skill file is in the official digest list, so the next
    release can update copies installed from this one.
    """
    digest = skills._meta_skill_digest(_SHIPPED_META_SKILL / relative_path)

    assert digest in skills._META_SKILL_DIGESTS.get(relative_path, frozenset()), (
        f"Add {digest!r} for {relative_path!r} to _META_SKILL_DIGESTS in "
        "lib/streamlit/web/skills.py, and keep the digests already there."
    )


@pytest.mark.parametrize(
    "skill_file",
    [_SHIPPED_META_SKILL / "SKILL.md", _SHIPPED_SKILL / "SKILL.md"],
    ids=["meta-skill", "bundled-skill"],
)
def test_shipped_skills_declare_license_and_author(skill_file: Path) -> None:
    """Both shipped skills declare their license and Streamlit as their author."""
    _, frontmatter, _ = skill_file.read_text(encoding="utf-8").split("---\n", 2)

    assert re.search(r"^license: Apache-2\.0$", frontmatter, flags=re.MULTILINE)
    assert re.search(
        r"^metadata:\n  author: streamlit$", frontmatter, flags=re.MULTILINE
    )


def test_bundled_skill_declares_its_release_version() -> None:
    """The bundled skill has one major.minor version line, which
    ``scripts/update_version.py`` rewrites, and it does not lag the package.
    """
    content = (_SHIPPED_SKILL / "SKILL.md").read_text(encoding="utf-8")

    versions = re.findall(r'^  version: "(.*)"$', content, flags=re.MULTILINE)

    assert len(versions) == 1
    assert re.fullmatch(r"\d+\.\d+", versions[0])
    package = Version(STREAMLIT_VERSION_STRING)
    assert Version(versions[0]) >= Version(f"{package.major}.{package.minor}")
