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

"""Unit tests for the `streamlit skills` CLI command."""

from __future__ import annotations

import errno
import os
import subprocess
import sys
import time
from pathlib import Path
from unittest.mock import patch

import click
import pytest
from click.testing import CliRunner

from streamlit.web import cli, skills


def _skip_if_symlinks_not_supported(tmp_path: Path) -> None:
    """Skip test if symlinks are not supported on this system."""
    test_link = tmp_path / ".symlink_test"
    test_target = tmp_path / ".symlink_target"
    test_target.mkdir(parents=True, exist_ok=True)
    try:
        test_link.symlink_to(test_target)
        test_link.unlink()
    except (OSError, NotImplementedError):
        pytest.skip(
            "Symlinks not supported on this system (requires privileges on Windows)"
        )


@pytest.fixture
def runner() -> CliRunner:
    """Create a CliRunner for testing CLI commands."""
    return CliRunner()


@pytest.fixture
def mock_source_skills_dir(tmp_path: Path) -> Path:
    """Create a mock bundled skills directory with a test skill."""
    source_dir = tmp_path / "streamlit" / ".agents" / "skills"
    skill_dir = source_dir / "developing-with-streamlit"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("# Test Skill\n", encoding="utf-8")
    return source_dir


@pytest.fixture
def mock_meta_skill_dir(tmp_path: Path) -> Path:
    """Create a mock bundled meta-skill directory.

    Mirrors the layout vendored in the wheel: a thin ``SKILL.md`` router plus a
    ``scripts/discover.py`` under ``.agents/meta-skill/developing-with-streamlit``.
    Returns the ``.agents/meta-skill`` dir (the source passed to the copy step),
    matching what :func:`skills._get_meta_skill_dir` returns.
    """
    meta_dir = tmp_path / "streamlit" / ".agents" / "meta-skill"
    skill_dir = meta_dir / "developing-with-streamlit"
    (skill_dir / "scripts").mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("# Meta Skill\n", encoding="utf-8")
    (skill_dir / "scripts" / "discover.py").write_text(
        "print('discover')\n", encoding="utf-8"
    )
    return meta_dir


class TestGetSourceSkillsDir:
    """Tests for _get_source_skills_dir."""

    def test_returns_path_relative_to_streamlit_package(self) -> None:
        """Returns a path under the streamlit package directory."""
        result = skills._get_source_skills_dir()
        assert result.name == "skills"
        assert result.parent.name == ".agents"


class TestDiscoverSkills:
    """Tests for _discover_skills."""

    def test_discovers_skill_with_skill_md(self, tmp_path: Path) -> None:
        """Discovers directories containing SKILL.md."""
        skill_dir = tmp_path / "my-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# Skill\n", encoding="utf-8")

        result = skills._discover_skills(tmp_path)
        assert result == ["my-skill"]

    def test_excludes_directories_without_skill_md(self, tmp_path: Path) -> None:
        """Excludes directories that don't contain SKILL.md."""
        (tmp_path / "not-a-skill").mkdir()
        result = skills._discover_skills(tmp_path)
        assert result == []

    def test_returns_sorted_skills(self, tmp_path: Path) -> None:
        """Returns skills sorted alphabetically."""
        for name in ["z-skill", "a-skill", "m-skill"]:
            skill_dir = tmp_path / name
            skill_dir.mkdir()
            (skill_dir / "SKILL.md").write_text("# Skill\n", encoding="utf-8")

        result = skills._discover_skills(tmp_path)
        assert result == ["a-skill", "m-skill", "z-skill"]

    def test_returns_empty_for_nonexistent_directory(self, tmp_path: Path) -> None:
        """Returns empty list if directory doesn't exist."""
        result = skills._discover_skills(tmp_path / "nonexistent")
        assert result == []


class TestGenerateGitignoreSnippet:
    """Tests for _generate_gitignore_snippet."""

    def test_generates_snippet_for_single_skill_single_target(
        self, tmp_path: Path
    ) -> None:
        """Generates correct snippet for one skill and one target directory."""
        project_root = tmp_path / "project"
        target_dirs = [project_root / ".agents" / "skills"]
        skill_names = ["developing-with-streamlit"]

        result = skills._generate_gitignore_snippet(
            skill_names, target_dirs, project_root
        )

        assert result == (
            "# Streamlit agent skills (environment-specific symlinks)\n"
            ".agents/skills/developing-with-streamlit"
        )

    def test_generates_snippet_for_multiple_targets(self, tmp_path: Path) -> None:
        """Generates entries for both .agents and .claude target directories."""
        project_root = tmp_path / "project"
        target_dirs = [
            project_root / ".agents" / "skills",
            project_root / ".claude" / "skills",
        ]
        skill_names = ["developing-with-streamlit"]

        result = skills._generate_gitignore_snippet(
            skill_names, target_dirs, project_root
        )

        assert ".agents/skills/developing-with-streamlit" in result
        assert ".claude/skills/developing-with-streamlit" in result
        assert "developing-with-streamlit/" not in result

    def test_generates_snippet_for_multiple_skills(self, tmp_path: Path) -> None:
        """Generates entries for all discovered skills."""
        project_root = tmp_path / "project"
        target_dirs = [project_root / ".agents" / "skills"]
        skill_names = ["developing-with-streamlit", "debugging-apps"]

        result = skills._generate_gitignore_snippet(
            skill_names, target_dirs, project_root
        )

        assert ".agents/skills/developing-with-streamlit" in result
        assert ".agents/skills/debugging-apps" in result
        assert "developing-with-streamlit/" not in result
        assert "debugging-apps/" not in result


class TestFindProjectRoot:
    """Tests for _find_project_root."""

    @pytest.mark.parametrize(
        "marker_dir",
        [".agents", ".claude"],
        ids=["agents", "claude"],
    )
    def test_uses_cwd_when_marker_dir_exists(
        self, tmp_path: Path, marker_dir: str
    ) -> None:
        """Uses cwd when .agents or .claude directory exists."""
        (tmp_path / marker_dir).mkdir()
        with (
            patch("pathlib.Path.cwd", return_value=tmp_path),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._find_project_root()
        assert result == tmp_path

    def test_finds_git_root(self, tmp_path: Path) -> None:
        """Walks up to find the nearest .git directory."""
        (tmp_path / ".git").mkdir()
        subdir = tmp_path / "sub" / "dir"
        subdir.mkdir(parents=True)

        with (
            patch("pathlib.Path.cwd", return_value=subdir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._find_project_root()
        assert result == tmp_path

    def test_uses_cwd_when_no_git_found(self, tmp_path: Path) -> None:
        """Falls back to cwd when no .git is found."""
        subdir = tmp_path / "sub" / "dir"
        subdir.mkdir(parents=True)

        with (
            patch("pathlib.Path.cwd", return_value=subdir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._find_project_root()
        assert result == subdir

    def test_prefers_local_agents_over_git_root(self, tmp_path: Path) -> None:
        """Prefers cwd with .agents over parent git root."""
        (tmp_path / ".git").mkdir()
        subdir = tmp_path / "sub"
        subdir.mkdir()
        (subdir / ".agents").mkdir()

        with (
            patch("pathlib.Path.cwd", return_value=subdir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._find_project_root()
        assert result == subdir

    def test_finds_parent_agents_before_git_root(self, tmp_path: Path) -> None:
        """Walks up to find an existing project agent directory."""
        project_dir = tmp_path / "project"
        (project_dir / ".agents").mkdir(parents=True)
        subdir = project_dir / "sub" / "dir"
        subdir.mkdir(parents=True)

        with (
            patch("pathlib.Path.cwd", return_value=subdir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._find_project_root()

        assert result == project_dir

    def test_does_not_use_home_claude_dir_as_project_root(self, tmp_path: Path) -> None:
        """Does not treat ~/.claude as a project-local agent directory."""
        home = tmp_path / "home"
        (home / ".claude").mkdir(parents=True)
        subdir = home / "workspace" / "project"
        subdir.mkdir(parents=True)

        with (
            patch("pathlib.Path.cwd", return_value=subdir),
            patch("pathlib.Path.home", return_value=home),
        ):
            result = skills._find_project_root()

        assert result == subdir

    def test_does_not_use_home_git_dir_as_project_root(self, tmp_path: Path) -> None:
        """Does not treat ~/.git as the project root (rare but possible)."""
        home = tmp_path / "home"
        (home / ".git").mkdir(parents=True)
        subdir = home / "workspace" / "project"
        subdir.mkdir(parents=True)

        with (
            patch("pathlib.Path.cwd", return_value=subdir),
            patch("pathlib.Path.home", return_value=home),
        ):
            result = skills._find_project_root()

        # Should fall back to cwd since ~/.git should be excluded
        assert result == subdir

    @pytest.mark.parametrize(
        "marker_name",
        [".agents", ".claude"],
        ids=["agents-file", "claude-file"],
    )
    def test_ignores_marker_files_only_matches_directories(
        self, tmp_path: Path, marker_name: str
    ) -> None:
        """Ignores .agents or .claude files (only directories count as markers)."""
        # Create a file named .agents or .claude (not a directory)
        (tmp_path / marker_name).write_text("not a directory", encoding="utf-8")
        subdir = tmp_path / "sub" / "dir"
        subdir.mkdir(parents=True)

        with (
            patch("pathlib.Path.cwd", return_value=subdir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._find_project_root()

        # Should fall back to cwd since file markers don't count
        assert result == subdir

    @pytest.mark.parametrize(
        "marker_dir",
        [".agents", ".claude"],
        ids=["agents", "claude"],
    )
    def test_does_not_use_home_marker_when_cwd_is_home(
        self, tmp_path: Path, marker_dir: str
    ) -> None:
        """Does not treat ~/.agents or ~/.claude as project marker when cwd==home.

        When running `streamlit skills` from the home directory with ~/.claude
        or ~/.agents existing, the function should not treat home as a project
        root. Instead, it should fall back to returning cwd (home) via the
        default fallback, not via marker detection.
        """
        home = tmp_path / "home"
        (home / marker_dir).mkdir(parents=True)
        # Also add a .git directory to verify marker detection was skipped
        # (if markers were checked first and matched, .git wouldn't be reached)
        (home / ".git").mkdir()

        with (
            patch("pathlib.Path.cwd", return_value=home),
            patch("pathlib.Path.home", return_value=home),
        ):
            result = skills._find_project_root()

        # Should return home, but via the fallback path (since both marker and
        # git root detection skip home). The function correctly avoids treating
        # home directory as a project even when it has agent directories.
        assert result == home

    def test_falls_back_to_cwd_when_cwd_is_ancestor_of_app(
        self, tmp_path: Path
    ) -> None:
        """No marker, but cwd is an ancestor of the app dir: install into cwd.

        Mirrors ``cd repo && streamlit run sub/app.py`` with no project marker —
        the developer expects skills in ``repo``, not the nested app-script dir.
        """
        repo = tmp_path / "repo"
        app_dir = repo / "sub" / "app"
        app_dir.mkdir(parents=True)
        with (
            patch("pathlib.Path.cwd", return_value=repo),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._find_project_root(app_dir)
        assert result == repo

    def test_falls_back_to_start_when_cwd_unrelated_to_app(
        self, tmp_path: Path
    ) -> None:
        """No marker and cwd is NOT an ancestor of the app dir: use the app dir.

        Mirrors ``cd /tmp && streamlit run /proj/app.py`` — the unrelated cwd
        must never become the install root.
        """
        unrelated = tmp_path / "elsewhere"
        unrelated.mkdir()
        app_dir = tmp_path / "proj" / "app"
        app_dir.mkdir(parents=True)
        with (
            patch("pathlib.Path.cwd", return_value=unrelated),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._find_project_root(app_dir)
        assert result == app_dir

    def test_does_not_fall_back_to_home_even_when_cwd_is_home_ancestor(
        self, tmp_path: Path
    ) -> None:
        """No marker and cwd is home (an ancestor of the app dir): use the app
        dir, never install project-local skills into the home directory.
        """
        home = tmp_path / "home"
        app_dir = home / "proj" / "app"
        app_dir.mkdir(parents=True)
        with (
            patch("pathlib.Path.cwd", return_value=home),
            patch("pathlib.Path.home", return_value=home),
        ):
            result = skills._find_project_root(app_dir)
        assert result == app_dir


class TestGetProjectTargetDirs:
    """Tests for _get_project_target_dirs."""

    def test_always_includes_agents_skills(self, tmp_path: Path) -> None:
        """Always includes .agents/skills/ in targets."""
        with patch("pathlib.Path.home", return_value=tmp_path / "home"):
            result = skills._get_project_target_dirs(tmp_path)
        assert tmp_path / ".agents" / "skills" in result

    @pytest.mark.parametrize(
        ("claude_home_exists", "expected_in_result"),
        [(True, True), (False, False)],
        ids=["claude-exists", "claude-missing"],
    )
    def test_claude_skills_conditional_on_claude_home(
        self, tmp_path: Path, claude_home_exists: bool, expected_in_result: bool
    ) -> None:
        """Includes .claude/skills/ only when ~/.claude exists."""
        home = tmp_path / "home"
        home.mkdir(parents=True)
        if claude_home_exists:
            (home / ".claude").mkdir()

        with patch("pathlib.Path.home", return_value=home):
            result = skills._get_project_target_dirs(tmp_path)

        assert (tmp_path / ".claude" / "skills" in result) == expected_in_result


class TestGetGlobalTargetDirs:
    """Tests for _get_global_target_dirs."""

    def test_always_includes_home_agents_skills(self, tmp_path: Path) -> None:
        """Always includes ~/.agents/skills/ in targets."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with patch("pathlib.Path.home", return_value=home):
            result = skills._get_global_target_dirs()

        assert home / ".agents" / "skills" in result

    @pytest.mark.parametrize(
        ("claude_home_exists", "expected_in_result"),
        [(True, True), (False, False)],
        ids=["claude-exists", "claude-missing"],
    )
    def test_claude_skills_conditional_on_claude_home(
        self, tmp_path: Path, claude_home_exists: bool, expected_in_result: bool
    ) -> None:
        """Includes ~/.claude/skills/ only when ~/.claude exists."""
        home = tmp_path / "home"
        home.mkdir(parents=True)
        if claude_home_exists:
            (home / ".claude").mkdir()

        with patch("pathlib.Path.home", return_value=home):
            result = skills._get_global_target_dirs()

        assert (home / ".claude" / "skills" in result) == expected_in_result


class TestAreSkillsInstalled:
    """Tests for are_skills_installed."""

    def test_returns_false_when_not_installed(self, tmp_path: Path) -> None:
        """Returns False when no skill is found in any target directory."""
        project_dir = tmp_path / "project" / ".agents" / "skills"
        global_dir = tmp_path / "home" / ".agents" / "skills"

        with (
            patch.object(skills, "_find_project_root", return_value=tmp_path),
            patch.object(
                skills, "_get_project_target_dirs", return_value=[project_dir]
            ),
            patch.object(skills, "_get_global_target_dirs", return_value=[global_dir]),
        ):
            assert skills.are_skills_installed() is False

    def test_returns_true_when_installed_in_project(self, tmp_path: Path) -> None:
        """Returns True when the bundled skill exists in a project target dir."""
        project_dir = tmp_path / "project" / ".agents" / "skills"
        (project_dir / skills._GLOBAL_SKILL_NAME).mkdir(parents=True)
        global_dir = tmp_path / "home" / ".agents" / "skills"

        with (
            patch.object(skills, "_find_project_root", return_value=tmp_path),
            patch.object(
                skills, "_get_project_target_dirs", return_value=[project_dir]
            ),
            patch.object(skills, "_get_global_target_dirs", return_value=[global_dir]),
        ):
            assert skills.are_skills_installed() is True

    def test_returns_true_when_installed_as_symlink(self, tmp_path: Path) -> None:
        """Returns True when the bundled skill is a symlink (project install)."""
        _skip_if_symlinks_not_supported(tmp_path)

        source = tmp_path / "source-skill"
        source.mkdir()
        global_dir = tmp_path / "home" / ".agents" / "skills"
        global_dir.mkdir(parents=True)
        (global_dir / skills._GLOBAL_SKILL_NAME).symlink_to(source)

        with (
            patch.object(skills, "_find_project_root", return_value=tmp_path),
            patch.object(skills, "_get_project_target_dirs", return_value=[]),
            patch.object(skills, "_get_global_target_dirs", return_value=[global_dir]),
        ):
            assert skills.are_skills_installed() is True

    @pytest.mark.parametrize("error", [OSError("boom"), RuntimeError("no home")])
    def test_returns_false_when_target_resolution_errors(
        self, error: Exception
    ) -> None:
        """Returns False if target directories cannot be determined.

        ``RuntimeError`` is included because ``Path.home()`` raises it when the
        home directory cannot be resolved.
        """
        with (
            patch.object(skills, "_find_project_root", side_effect=error),
            patch.object(skills, "_get_global_target_dirs", return_value=[]),
        ):
            assert skills.are_skills_installed() is False

    def test_still_checks_project_dirs_when_global_resolution_errors(
        self, tmp_path: Path
    ) -> None:
        """Uses already-collected project dirs even if global lookup fails.

        Resolving the global target dirs can raise (e.g. ``Path.home()`` on an
        unusual filesystem). The already-collected project dirs must still be
        checked so an installed skill is detected.
        """
        project_dir = tmp_path / "project" / ".agents" / "skills"
        (project_dir / skills._GLOBAL_SKILL_NAME).mkdir(parents=True)

        with (
            patch.object(skills, "_find_project_root", return_value=tmp_path),
            patch.object(
                skills, "_get_project_target_dirs", return_value=[project_dir]
            ),
            patch.object(
                skills, "_get_global_target_dirs", side_effect=OSError("no home")
            ),
        ):
            assert skills.are_skills_installed() is True

    def test_still_checks_global_dirs_when_project_root_resolution_errors(
        self, tmp_path: Path
    ) -> None:
        """Uses global dirs even if project root lookup fails."""
        global_dir = tmp_path / "home" / ".agents" / "skills"
        (global_dir / skills._GLOBAL_SKILL_NAME).mkdir(parents=True)

        with (
            patch.object(skills, "_find_project_root", side_effect=OSError("no cwd")),
            patch.object(skills, "_get_global_target_dirs", return_value=[global_dir]),
        ):
            assert skills.are_skills_installed() is True

    def test_still_checks_global_dirs_when_project_target_resolution_errors(
        self, tmp_path: Path
    ) -> None:
        """Uses global dirs even if project target lookup fails."""
        global_dir = tmp_path / "home" / ".agents" / "skills"
        (global_dir / skills._GLOBAL_SKILL_NAME).mkdir(parents=True)

        with (
            patch.object(skills, "_find_project_root", return_value=tmp_path),
            patch.object(
                skills, "_get_project_target_dirs", side_effect=OSError("no home")
            ),
            patch.object(skills, "_get_global_target_dirs", return_value=[global_dir]),
        ):
            assert skills.are_skills_installed() is True


class TestInstallSkillSymlink:
    """Tests for _install_skill_symlink."""

    def test_creates_symlink(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Creates a symlink to the source skill directory."""
        _skip_if_symlinks_not_supported(tmp_path)
        target_dir = tmp_path / "project" / ".agents" / "skills"
        result = skills._InstallResult()

        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        target = target_dir / "developing-with-streamlit"
        assert success
        assert target.is_symlink()
        assert (
            target.resolve()
            == (mock_source_skills_dir / "developing-with-streamlit").resolve()
        )
        assert ".agents/skills/developing-with-streamlit" in result.installed

    def test_reports_up_to_date_for_existing_correct_symlink(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Reports 'up to date' for existing symlink pointing to same source."""
        _skip_if_symlinks_not_supported(tmp_path)
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        source = mock_source_skills_dir / "developing-with-streamlit"
        target.symlink_to(os.path.relpath(source, target.parent))

        result = skills._InstallResult()
        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert success
        assert ".agents/skills/developing-with-streamlit" in result.up_to_date
        assert len(result.installed) == 0

    def test_skips_existing_regular_file(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Skips and reports conflict for existing regular file."""
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.write_text("user file", encoding="utf-8")

        result = skills._InstallResult()
        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert success
        assert any("existing file or directory" in s for s in result.skipped)
        assert len(result.installed) == 0

    def test_skips_existing_directory(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Skips and reports conflict for existing directory."""
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()

        result = skills._InstallResult()
        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert success
        assert any("existing file or directory" in s for s in result.skipped)
        assert len(result.installed) == 0

    def test_replaces_broken_streamlit_owned_symlink(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Replaces broken symlinks that appear to be Streamlit-owned."""
        _skip_if_symlinks_not_supported(tmp_path)
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        # Create a broken symlink pointing to a Streamlit-like path
        target.symlink_to("../../old-env/.agents/skills/developing-with-streamlit")

        result = skills._InstallResult()
        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert success
        assert target.is_symlink()
        assert ".agents/skills/developing-with-streamlit" in result.installed
        # The replacement must RESOLVE to the real source, not recreate a
        # still-dangling link that reuses the old (broken) target string.
        assert (
            target.resolve()
            == (mock_source_skills_dir / "developing-with-streamlit").resolve()
        )


class TestInstallSkillCopy:
    """Tests for _install_skill_copy."""

    def test_copies_skill_directory(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Copies skill directory to target location."""
        target_dir = tmp_path / "target" / "skills"
        result = skills._InstallResult()

        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        target = target_dir / "developing-with-streamlit"
        assert target.is_dir()
        assert (target / "SKILL.md").is_file()
        assert len(result.installed) == 1

    def test_reports_up_to_date_for_matching_directory(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Reports up to date when copied skill matches source."""
        target_dir = tmp_path / "target" / "skills"
        target = target_dir / "developing-with-streamlit"
        target.mkdir(parents=True)
        (target / "SKILL.md").write_text("# Test Skill\n", encoding="utf-8")

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert len(result.installed) == 0
        assert len(result.up_to_date) == 1

    def test_replaces_existing_directory_with_skill_name(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Replaces existing directory with skill name."""
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "user-file.txt").write_text("user content", encoding="utf-8")

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert len(result.installed) == 1
        assert (target / "SKILL.md").is_file()
        # Old user file should be gone after replacement
        assert not (target / "user-file.txt").exists()

    def test_replaces_existing_directory_with_different_content(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Replaces existing directory even with different content."""
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "old-file.txt").write_text("old content", encoding="utf-8")

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert len(result.installed) == 1
        assert (target / "SKILL.md").is_file()
        assert not (target / "old-file.txt").exists()

    def test_skips_existing_regular_file(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Skips when target is a regular file (not directory)."""
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.write_text("some file content", encoding="utf-8")

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert any("existing file" in s for s in result.skipped)
        # Original file should be preserved
        assert target.is_file()
        assert target.read_text() == "some file content"


class TestIsStreamlitOwnedSymlink:
    """Tests for _is_streamlit_owned_symlink."""

    def test_returns_true_for_symlink_with_skill_name(self, tmp_path: Path) -> None:
        """Returns True for symlinks named developing-with-streamlit."""
        _skip_if_symlinks_not_supported(tmp_path)
        target = tmp_path / "target"
        target.mkdir()
        link = tmp_path / "developing-with-streamlit"
        link.symlink_to(target)

        assert skills._is_streamlit_owned_symlink(link, {"developing-with-streamlit"})

    def test_returns_false_for_symlink_with_different_name(
        self, tmp_path: Path
    ) -> None:
        """Returns False for symlinks with a different name."""
        _skip_if_symlinks_not_supported(tmp_path)
        target = tmp_path / "target"
        target.mkdir()
        link = tmp_path / "other-skill"
        link.symlink_to(target)

        assert not skills._is_streamlit_owned_symlink(
            link, {"developing-with-streamlit"}
        )

    def test_returns_true_for_symlink_in_bundled_set(self, tmp_path: Path) -> None:
        """Returns True for symlinks whose name is in the bundled skill set."""
        _skip_if_symlinks_not_supported(tmp_path)
        target = tmp_path / "target"
        target.mkdir()
        link = tmp_path / "my-custom-skill"
        link.symlink_to(target)

        # When the skill name is in the bundled set, it should return True
        assert skills._is_streamlit_owned_symlink(
            link, {"developing-with-streamlit", "my-custom-skill"}
        )

    def test_returns_false_for_non_symlink(self, tmp_path: Path) -> None:
        """Returns False for regular files or directories."""
        regular_file = tmp_path / "developing-with-streamlit"
        regular_file.write_text("content", encoding="utf-8")

        assert not skills._is_streamlit_owned_symlink(
            regular_file, {"developing-with-streamlit"}
        )


class TestInstallSkillsCli:
    """Integration tests for the `streamlit skills` CLI command."""

    def test_skills_command_exists(self, runner: CliRunner) -> None:
        """The 'skills' command is registered."""
        result = runner.invoke(cli.main, ["skills", "--help"])
        assert result.exit_code == 0
        assert "Install Streamlit AI-agent skills" in result.output

    def test_skills_help_shows_global_option(self, runner: CliRunner) -> None:
        """The --global option is documented in help."""
        result = runner.invoke(cli.main, ["skills", "--help"])
        assert result.exit_code == 0
        assert "--global" in result.output
        assert "Install globally" in result.output

    def test_skills_yes_flag_skips_prompts(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """The --yes flag skips all confirmation prompts."""
        _skip_if_symlinks_not_supported(tmp_path)
        project_dir = tmp_path / "project"
        project_dir.mkdir()
        (project_dir / ".git").mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code == 0
        assert "Installed:" in result.output

    def test_skills_global_flag_triggers_global_install(
        self, runner: CliRunner, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """The --global flag triggers global installation mode."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
        ):
            result = runner.invoke(cli.main, ["skills", "--global", "--yes"])

        assert result.exit_code == 0
        assert "Successfully installed globally" in result.output

    def test_skills_fails_without_tty_and_no_yes_flag(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Fails in non-interactive mode without --yes."""
        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("sys.stdin.isatty", return_value=False),
        ):
            result = runner.invoke(cli.main, ["skills"])

        assert result.exit_code != 0
        assert "Non-interactive" in result.output

    def test_skills_fails_when_no_skills_found(
        self, runner: CliRunner, tmp_path: Path
    ) -> None:
        """Fails when no installable skills are found."""
        empty_source = tmp_path / "empty"
        empty_source.mkdir()

        with patch.object(skills, "_get_source_skills_dir", return_value=empty_source):
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code != 0
        assert "No installable skills found" in result.output

    def test_skills_fails_when_source_dir_missing(
        self, runner: CliRunner, tmp_path: Path
    ) -> None:
        """Fails when bundled skills directory doesn't exist."""
        missing = tmp_path / "nonexistent"
        with patch.object(skills, "_get_source_skills_dir", return_value=missing):
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code != 0
        assert "not found" in result.output
        # The absolute server path must not leak into the error (the same message
        # is shown verbatim in the in-app nudge toast).
        assert str(missing) not in result.output

    def test_skills_installs_to_agents_skills(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Installs skills to .agents/skills/ directory."""
        _skip_if_symlinks_not_supported(tmp_path)
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code == 0
        target = project_dir / ".agents" / "skills" / "developing-with-streamlit"
        assert target.is_symlink()
        assert "Recommended .gitignore snippet" in result.output

    def test_skills_also_installs_to_claude_when_detected(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Also installs to .claude/skills/ when ~/.claude exists."""
        _skip_if_symlinks_not_supported(tmp_path)
        project_dir = tmp_path / "project"
        project_dir.mkdir()
        home = tmp_path / "home"
        (home / ".claude").mkdir(parents=True)

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=home),
        ):
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code == 0
        assert (
            project_dir / ".agents" / "skills" / "developing-with-streamlit"
        ).is_symlink()
        assert (
            project_dir / ".claude" / "skills" / "developing-with-streamlit"
        ).is_symlink()

    def test_skills_falls_back_to_global_when_symlinks_not_supported(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Falls back to global mode before creating project links."""
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch.object(
                skills, "_symlink_blocker", return_value="symlinks_unsupported"
            ),
            patch.object(skills, "_install_global_skills") as install_global_skills,
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code == 0
        assert "Symlinks not supported" in result.output
        install_global_skills.assert_called_once_with(yes=True)
        assert not (
            project_dir / ".agents" / "skills" / "developing-with-streamlit"
        ).exists()

    def test_skills_rerun_reports_up_to_date(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Re-running the command reports skills as up to date."""
        _skip_if_symlinks_not_supported(tmp_path)
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            # First run
            runner.invoke(cli.main, ["skills", "--yes"])
            # Second run
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code == 0
        assert "Up to date:" in result.output

    def test_skills_global_installs_to_home_dirs(
        self, runner: CliRunner, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """Global install copies the meta-skill to home directories."""
        home = tmp_path / "home"
        (home / ".claude").mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
        ):
            result = runner.invoke(cli.main, ["skills", "-g", "-y"])

        assert result.exit_code == 0
        agents_skill = home / ".agents" / "skills" / "developing-with-streamlit"
        claude_skill = home / ".claude" / "skills" / "developing-with-streamlit"
        assert agents_skill.is_dir()
        assert claude_skill.is_dir()
        # The version-agnostic meta-skill (SKILL.md + scripts/discover.py) is what
        # lands globally — not the version-matched content skill.
        assert (agents_skill / "SKILL.md").is_file()
        assert (agents_skill / "scripts" / "discover.py").is_file()
        assert (claude_skill / "scripts" / "discover.py").is_file()

    def test_skills_global_rerun_reports_up_to_date(
        self, runner: CliRunner, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """Global install reports up to date when managed copy is unchanged."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
        ):
            runner.invoke(cli.main, ["skills", "-g", "-y"])
            result = runner.invoke(cli.main, ["skills", "-g", "-y"])

        assert result.exit_code == 0
        assert "Up to date:" in result.output


class TestPromptInstallMode:
    """Tests for _prompt_install_mode."""

    @pytest.mark.parametrize(
        ("user_input", "expected"),
        [
            ("p", "project"),
            ("project", "project"),
            ("", "project"),
            ("g", "global"),
            ("global", "global"),
        ],
        ids=["p", "project", "empty-default", "g", "global"],
    )
    def test_accepts_valid_input(self, user_input: str, expected: str) -> None:
        """Accepts valid inputs and maps to correct mode."""
        with patch("click.prompt", return_value=user_input):
            result = skills._prompt_install_mode()
        assert result == expected


class TestConfirmProjectInstallation:
    """Tests for _confirm_project_installation."""

    def test_returns_false_when_user_declines(self, tmp_path: Path) -> None:
        """Returns False when user declines installation."""
        with patch("click.confirm", return_value=False):
            result = skills._confirm_project_installation(
                project_root=tmp_path,
                skills=["test-skill"],
                target_dirs=[tmp_path / ".agents" / "skills"],
            )
        assert result is False

    def test_returns_true_when_user_confirms(self, tmp_path: Path) -> None:
        """Returns True when user confirms installation."""
        with patch("click.confirm", return_value=True):
            result = skills._confirm_project_installation(
                project_root=tmp_path,
                skills=["test-skill"],
                target_dirs=[tmp_path / ".agents" / "skills"],
            )
        assert result is True


class TestConfirmGlobalInstallation:
    """Tests for _confirm_global_installation."""

    def test_returns_false_when_user_declines(self, tmp_path: Path) -> None:
        """Returns False when user declines installation."""
        with (
            patch("click.confirm", return_value=False),
            patch("pathlib.Path.home", return_value=tmp_path),
        ):
            result = skills._confirm_global_installation(
                target_dirs=[tmp_path / ".agents" / "skills"],
            )
        assert result is False


class TestInstallProjectSkillsConflicts:
    """Tests for conflicts in project skills installation."""

    def test_raises_when_all_skills_skipped_due_to_conflicts(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Raises ClickException when all skills are skipped due to conflicts."""
        _skip_if_symlinks_not_supported(tmp_path)
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        # Create conflicting user directory that will cause skip
        conflict_dir = project_dir / ".agents" / "skills" / "developing-with-streamlit"
        conflict_dir.mkdir(parents=True)
        (conflict_dir / "user-file.txt").write_text("user content", encoding="utf-8")

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code != 0
        # The error names the specific conflicting path, not a vague "conflicts".
        assert ".agents/skills/developing-with-streamlit" in result.output
        assert "already exist" in result.output


class TestInstallProjectSkillsCancellation:
    """Tests for installation cancellation."""

    def test_project_install_cancelled_by_user(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Returns early when user declines confirmation."""
        _skip_if_symlinks_not_supported(tmp_path)
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
            patch.object(skills, "sys") as mock_sys,
            patch.object(skills, "_prompt_install_mode", return_value="project"),
            patch.object(skills, "_confirm_project_installation", return_value=False),
        ):
            mock_sys.stdin.isatty.return_value = True
            result = runner.invoke(cli.main, ["skills"])

        assert result.exit_code == 1
        assert "Installation cancelled" in result.output
        assert not (
            project_dir / ".agents" / "skills" / "developing-with-streamlit"
        ).exists()


class TestSkillCopyMatches:
    """Tests for _skill_copy_matches."""

    def test_returns_false_when_target_missing(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Returns False when target directory doesn't exist."""
        source = mock_source_skills_dir / "developing-with-streamlit"
        target = tmp_path / "nonexistent"

        assert not skills._skill_copy_matches(source, target)

    def test_returns_false_when_files_differ(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Returns False when file contents differ."""
        source = mock_source_skills_dir / "developing-with-streamlit"
        target = tmp_path / "developing-with-streamlit"
        target.mkdir(parents=True)
        # Create file with different content
        (target / "SKILL.md").write_text("# Different Content\n", encoding="utf-8")

        assert not skills._skill_copy_matches(source, target)

    def test_returns_false_when_files_missing(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Returns False when target is missing files from source."""
        source = mock_source_skills_dir / "developing-with-streamlit"
        target = tmp_path / "developing-with-streamlit"
        target.mkdir(parents=True)
        # Don't create SKILL.md, leaving it missing

        assert not skills._skill_copy_matches(source, target)


class TestInstallSkillCopyEdgeCases:
    """Additional edge case tests for _install_skill_copy."""

    def test_replaces_existing_symlink_with_skill_name(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Replaces existing symlinks named developing-with-streamlit."""
        _skip_if_symlinks_not_supported(tmp_path)
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        # Create symlink pointing to unrelated location
        unrelated = tmp_path / "unrelated"
        unrelated.mkdir()
        target.symlink_to(unrelated)

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert len(result.installed) == 1
        assert target.is_dir()
        assert (target / "SKILL.md").is_file()

    def test_preserves_existing_symlink_on_copy_failure(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A failed replacement leaves an existing owned symlink usable.

        Replacing a Streamlit-owned symlink used to unlink it before copying, so a
        copy that failed (permissions, full disk, antivirus lock) deleted a working
        skill and left nothing in its place. The replacement now copies to a temp
        dir and swaps, so the old install survives a failure.
        """
        _skip_if_symlinks_not_supported(tmp_path)
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        # A working install: an owned symlink pointing at a real skill directory.
        existing_skill = tmp_path / "existing-skill"
        existing_skill.mkdir()
        (existing_skill / "SKILL.md").write_text(
            "# Working install\n", encoding="utf-8"
        )
        target = target_dir / "developing-with-streamlit"
        target.symlink_to(existing_skill, target_is_directory=True)

        result = skills._InstallResult()
        with (
            patch("pathlib.Path.home", return_value=tmp_path),
            patch.object(skills.shutil, "copytree", side_effect=OSError("Disk full")),
        ):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert target.is_symlink()
        assert (target / "SKILL.md").read_text() == "# Working install\n"
        assert any("copy failed" in entry for entry in result.errored)
        assert not result.installed

    def test_reports_copy_failure(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Reports error when copy operation fails."""
        target_dir = tmp_path / "target" / "skills"
        result = skills._InstallResult()

        with (
            patch("pathlib.Path.home", return_value=tmp_path),
            patch.object(skills.shutil, "copytree", side_effect=OSError("Disk full")),
        ):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert any("copy failed" in s for s in result.errored)
        # A write failure must land in ``errored``, never ``skipped`` - otherwise
        # the caller labels it reason="conflict".
        assert not result.skipped

    def test_preserves_existing_directory_on_copy_failure(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Preserves existing directory when copy to temp fails."""
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "SKILL.md").write_text("# Old version\n", encoding="utf-8")

        result = skills._InstallResult()

        with (
            patch("pathlib.Path.home", return_value=tmp_path),
            patch.object(skills.shutil, "copytree", side_effect=OSError("Disk full")),
        ):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        # Original should be preserved with old content
        assert target.is_dir()
        assert (target / "SKILL.md").read_text() == "# Old version\n"
        assert any("copy failed" in s for s in result.errored)
        assert not result.skipped

    def test_restores_old_install_when_final_swap_fails(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A failed swap restores the old install instead of stranding the copy.

        The copy succeeds, so the old target is moved aside — but if renaming the
        new copy into place then fails (a held handle, antivirus), deleting the old
        one outright would leave the fresh copy under a hidden dot-name with
        nothing at the path agents actually read.
        """
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "SKILL.md").write_text("# Old version\n", encoding="utf-8")

        result = skills._InstallResult()
        real_rename = skills.Path.rename
        calls = {"n": 0}

        def _fail_only_the_swap(self: Path, target_name: object) -> object:
            """Let the move-aside through and fail the swap; the restore then works.

            Blanket-patching ``rename`` would fail the move-aside instead, so the
            restore branch would never run and a broken restore would still pass.
            """
            calls["n"] += 1
            if calls["n"] == 2:
                raise OSError("Access is denied")
            return real_rename(self, target_name)  # type: ignore[arg-type]

        with (
            patch("pathlib.Path.home", return_value=tmp_path),
            patch.object(skills.Path, "rename", _fail_only_the_swap),
        ):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        # rename #1 moved the old install aside, #2 (the swap) failed, #3 restored it.
        assert calls["n"] == 3
        # The old install is back at the canonical path with its original content.
        assert target.is_dir()
        assert not target.is_symlink()
        assert (target / "SKILL.md").read_text() == "# Old version\n"
        # Reported as a failure, and the backup name is not left behind.
        assert result.errored
        assert not result.installed
        assert not list(target_dir.glob(f"{skills._STAGING_PREFIX}*"))

    def test_keeps_both_copies_when_swap_and_restore_both_fail(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """If the swap and the restore both fail, neither copy is discarded.

        Moving the old install aside succeeds, then both renaming the new copy in
        and putting the old one back fail. No atomic replace exists for a non-empty
        directory on POSIX or Windows, so this state cannot be avoided in code — but
        it must at least be non-destructive, leaving both copies recoverable on disk
        and reporting the install as failed rather than succeeded.
        """
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "SKILL.md").write_text("# Old version\n", encoding="utf-8")

        result = skills._InstallResult()
        real_rename = skills.Path.rename
        calls = {"n": 0}

        def _only_first_rename_works(self: Path, target_name: object) -> object:
            """Let the move-aside through; fail the swap and the restore after it."""
            calls["n"] += 1
            if calls["n"] == 1:
                return real_rename(self, target_name)  # type: ignore[arg-type]
            raise OSError("Access is denied")

        with (
            patch("pathlib.Path.home", return_value=tmp_path),
            patch.object(skills.Path, "rename", _only_first_rename_works),
        ):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        # Reported as a failure, never a success.
        assert result.errored
        assert not result.installed
        # Both copies survive inside the retained staging dir - nothing is destroyed.
        staged = list(target_dir.glob(f"{skills._STAGING_PREFIX}*"))
        assert len(staged) == 1
        assert (staged[0] / skills._STAGING_OLD / "SKILL.md").read_text() == (
            "# Old version\n"
        )
        assert (staged[0] / skills._STAGING_NEW / "SKILL.md").read_text() == (
            "# Test Skill\n"
        )

    def test_reports_success_when_only_backup_cleanup_fails(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A failed backup cleanup after a landed swap is still a success.

        Discarding the staging dir is bookkeeping that happens after the new skill
        is already at the target. If its error reached the write handler, a correct
        install would be reported as ``write_failed`` — a false failure in the nudge
        and a false reason in the telemetry.
        """
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "SKILL.md").write_text("# Old version\n", encoding="utf-8")

        result = skills._InstallResult()
        with (
            patch("pathlib.Path.home", return_value=tmp_path),
            # Every rmtree here is cleanup; none of it may affect the outcome.
            patch.object(
                skills.shutil, "rmtree", side_effect=OSError("Directory not empty")
            ),
        ):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        # The new skill landed, so this is a success...
        assert result.installed
        assert (target / "SKILL.md").read_text() == "# Test Skill\n"
        # ...and must not be booked as a write failure.
        assert not result.errored

    def test_reports_mkdir_failure_as_error(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A permission error creating the target dir is an error, not a skip.

        Regression: the mkdir/existence checks ran outside the copy try/except,
        so a permission-denied mkdir escaped as an uncaught OSError (which the
        handler could only classify as 'unknown'). It must land in ``errored``
        so it maps to reason='write_failed'.
        """
        target_dir = tmp_path / "target" / "skills"
        result = skills._InstallResult()

        with (
            patch("pathlib.Path.home", return_value=tmp_path),
            patch.object(
                skills.Path, "mkdir", side_effect=OSError("Permission denied")
            ),
        ):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert result.errored
        assert not result.skipped
        assert not result.installed


class TestInstallSkillSymlinkEdgeCases:
    """Additional edge case tests for _install_skill_symlink."""

    def test_replaces_existing_symlink_with_skill_name(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Replaces existing symlinks named developing-with-streamlit."""
        _skip_if_symlinks_not_supported(tmp_path)
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        # Create symlink pointing to unrelated location
        unrelated = tmp_path / "unrelated"
        unrelated.mkdir()
        target.symlink_to(unrelated)

        result = skills._InstallResult()
        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert success
        assert len(result.installed) == 1
        assert target.is_symlink()
        # The replacement resolves to the real source, not the unrelated dir.
        assert (
            target.resolve()
            == (mock_source_skills_dir / "developing-with-streamlit").resolve()
        )

    def test_returns_false_when_symlink_creation_fails(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Returns False when symlink creation raises OSError."""
        target_dir = tmp_path / "project" / ".agents" / "skills"
        result = skills._InstallResult()

        with (
            patch("pathlib.Path.cwd", return_value=tmp_path / "project"),
            patch("pathlib.Path.symlink_to", side_effect=OSError("Permission denied")),
        ):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert not success

    def test_returns_false_when_prework_fails_for_fallback(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A filesystem error in the symlink PRE-work returns False (-> fallback).

        The mkdir / existence-check / unlink steps used to run outside the guard, so
        an OSError there escaped as a hard write_failed and bypassed the
        symlink->global fallback. Whatever stops us laying the symlink, the caller
        should get the chance to fall back to a global copy.
        """
        target_dir = tmp_path / "project" / ".agents" / "skills"
        result = skills._InstallResult()

        with (
            patch("pathlib.Path.cwd", return_value=tmp_path / "project"),
            patch.object(
                skills.Path, "mkdir", side_effect=OSError("Permission denied")
            ),
        ):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert not success
        assert not result.errored
        assert not result.installed

    def test_keeps_replaced_symlink_when_link_creation_fails(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """An unmakeable symlink leaves the existing project install alone.

        ``symlink_to`` cannot overwrite, so replacing an owned link means removing
        it first — and "remove then re-create" loses a working install whenever the
        re-create fails. A restore attempt is no defence: the re-create only fails
        because this system won't make symlinks, so the restore fails identically.
        Hence the new link is staged under a temp name first, and nothing is removed
        until that has worked. Here every ``symlink_to`` fails, so the original must
        be exactly as it was.
        """
        _skip_if_symlinks_not_supported(tmp_path)
        existing_skill = tmp_path / "existing-skill"
        existing_skill.mkdir()
        (existing_skill / "SKILL.md").write_text(
            "# Working install\n", encoding="utf-8"
        )
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.symlink_to(existing_skill, target_is_directory=True)

        result = skills._InstallResult()

        def _always_fail(*args: object, **kwargs: object) -> None:
            raise OSError("A required privilege is not held by the client")

        with (
            patch("pathlib.Path.cwd", return_value=tmp_path / "project"),
            patch.object(skills.Path, "symlink_to", _always_fail),
        ):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        # False so the caller still falls back to a global copy...
        assert not success
        # ...but the working project install must survive, still pointing where it did.
        assert target.is_symlink()
        assert (target / "SKILL.md").read_text() == "# Working install\n"
        assert not result.installed

    def test_lays_link_directly_when_swap_rename_fails(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A failed swap recovers by creating the link at the canonical path.

        The staged link exists and the old one is removed, but the rename into place
        fails. Creating a symlink here is already proven to work — the staged one
        just succeeded — so it is laid directly rather than stranding the install
        under a dot-name that nothing reads.
        """
        _skip_if_symlinks_not_supported(tmp_path)
        existing_skill = tmp_path / "existing-skill"
        existing_skill.mkdir()
        (existing_skill / "SKILL.md").write_text("# Old link\n", encoding="utf-8")
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.symlink_to(existing_skill, target_is_directory=True)

        result = skills._InstallResult()
        with (
            patch("pathlib.Path.cwd", return_value=tmp_path / "project"),
            patch.object(skills.Path, "rename", side_effect=OSError("Access denied")),
        ):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert success
        assert result.installed
        # The link is where agents look, pointing at the new source...
        assert target.is_symlink()
        assert (target / "SKILL.md").read_text() == "# Test Skill\n"
        # ...and the staging name is cleaned up rather than left as clutter.
        assert not list(target_dir.glob(f"{skills._STAGING_PREFIX}*"))

    def test_keeps_old_link_when_unlink_fails_after_staging(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A failed unlink leaves the old link in place, staged copy or not.

        The staged link exists but the old one can't be removed, so the swap never
        starts. This is the branch where staging pays off: the existing install was
        never touched, so it is still exactly what it was.
        """
        _skip_if_symlinks_not_supported(tmp_path)
        existing_skill = tmp_path / "existing-skill"
        existing_skill.mkdir()
        (existing_skill / "SKILL.md").write_text(
            "# Working install\n", encoding="utf-8"
        )
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.symlink_to(existing_skill, target_is_directory=True)

        result = skills._InstallResult()
        with (
            patch("pathlib.Path.cwd", return_value=tmp_path / "project"),
            patch.object(
                skills.Path, "unlink", side_effect=OSError("Permission denied")
            ),
        ):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert not success
        assert not result.installed
        # The old install is untouched, still resolving to its original content.
        assert target.is_symlink()
        assert (target / "SKILL.md").read_text() == "# Working install\n"

    def test_keeps_staged_link_when_recovery_also_fails(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """When even the direct re-lay fails, the staged link is not deleted.

        Rename fails and so does creating the link at the canonical path, so the
        staged link is the only one left — deleting it would leave nothing at all.
        The caller still falls back to a global install.
        """
        _skip_if_symlinks_not_supported(tmp_path)
        existing_skill = tmp_path / "existing-skill"
        existing_skill.mkdir()
        (existing_skill / "SKILL.md").write_text("# Old link\n", encoding="utf-8")
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.symlink_to(existing_skill, target_is_directory=True)

        result = skills._InstallResult()
        real_symlink_to = skills.Path.symlink_to
        calls = {"n": 0}

        def _only_staged_link_works(
            self: Path, link_target: object, target_is_directory: bool = False
        ) -> None:
            """Let the staged link through; fail the direct re-lay after it."""
            calls["n"] += 1
            if calls["n"] == 1:
                real_symlink_to(
                    self, link_target, target_is_directory=target_is_directory
                )  # type: ignore[arg-type]
                return
            raise OSError("A required privilege is not held by the client")

        with (
            patch("pathlib.Path.cwd", return_value=tmp_path / "project"),
            patch.object(skills.Path, "rename", side_effect=OSError("Access denied")),
            patch.object(skills.Path, "symlink_to", _only_staged_link_works),
        ):
            success = skills._install_skill_symlink(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert not success
        assert not result.installed
        # The staged link is the only remaining copy, so its staging dir must survive.
        staged = list(target_dir.glob(f"{skills._STAGING_PREFIX}*"))
        assert len(staged) == 1
        assert (staged[0] / skills._STAGING_NEW).is_symlink()


class TestPromptInstallModeRetry:
    """Tests for _prompt_install_mode retry behavior."""

    def test_retries_on_invalid_then_accepts_valid(self) -> None:
        """Reprompts on invalid input until valid input is given."""
        # First return invalid, then valid
        with patch("click.prompt", side_effect=["invalid", "x", "p"]):
            result = skills._prompt_install_mode()
        assert result == "project"


class TestGlobalInstallationCancellation:
    """Tests for global installation cancellation."""

    def test_global_install_cancelled_by_user(
        self, runner: CliRunner, tmp_path: Path
    ) -> None:
        """Returns early when user declines global installation."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(skills, "sys") as mock_sys,
            patch.object(skills, "_prompt_install_mode", return_value="global"),
            patch.object(skills, "_confirm_global_installation", return_value=False),
        ):
            mock_sys.stdin.isatty.return_value = True
            result = runner.invoke(cli.main, ["skills"])

        assert result.exit_code == 1
        assert "Installation cancelled" in result.output


class TestGlobalInstallationConflicts:
    """Tests for global installation conflicts."""

    def test_raises_when_all_targets_skipped(
        self, runner: CliRunner, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """Raises ClickException when all targets are skipped due to conflicts."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        # Create conflicting regular file (not directory - directories are replaced)
        skills_dir = home / ".agents" / "skills"
        skills_dir.mkdir(parents=True)
        conflict_file = skills_dir / "developing-with-streamlit"
        conflict_file.write_text("existing file content", encoding="utf-8")

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
        ):
            result = runner.invoke(cli.main, ["skills", "--global", "--yes"])

        assert result.exit_code != 0
        # The error names the specific conflicting path, not a vague "conflicts".
        assert ".agents/skills/developing-with-streamlit" in result.output
        assert "already exist" in result.output

    def test_copy_failure_reports_write_failed_not_conflict(
        self, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """A filesystem copy failure raises reason='write_failed', not 'conflict'.

        An ``OSError`` during the global copy (permissions, disk space, locked dir)
        used to land in ``skipped`` and be labeled ``conflict``, so the nudge's
        failure telemetry misclassified write failures - the dominant residual
        Windows cause - as conflicts.
        """
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
            patch.object(
                skills.shutil, "copytree", side_effect=OSError("Permission denied")
            ),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills._install_global_skills(yes=True)

        assert exc.value.reason == "write_failed"
        # Must NOT be misclassified as a conflict.
        assert "already exist" not in exc.value.format_message()

    def test_reports_the_specific_write_cause_not_a_generic_failure(
        self, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """A permission error surfaces as write_denied, end to end.

        The point of the whole exercise: "a write failed" does not say what to do,
        while "permission denied" and "path too long" imply different fixes. The
        errno has to survive from the copy site out to the raised reason.
        """
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
            patch.object(
                skills.shutil,
                "copytree",
                side_effect=OSError(errno.EACCES, "Permission denied"),
            ),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills._install_global_skills(yes=True)

        assert exc.value.reason == "write_denied"

    def test_generalises_when_targets_fail_for_different_reasons(
        self, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """Disagreeing targets report the generic write_failed, not a guess.

        Claiming "permission denied" when one target was denied and the other was out
        of disk would send whoever reads the telemetry after half the problem.
        """
        home = tmp_path / "home"
        # ~/.claude present -> _get_global_target_dirs yields two targets.
        (home / ".claude").mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
            patch.object(
                skills.shutil,
                "copytree",
                side_effect=[
                    OSError(errno.EACCES, "Permission denied"),
                    OSError(errno.ENOSPC, "No space left"),
                ],
            ),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills._install_global_skills(yes=True)

        assert exc.value.reason == "write_failed"

    def test_partial_write_failure_reports_write_failed_not_success(
        self, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """One target succeeds, another OSErrors -> hard write_failed, not success.

        ``_get_global_target_dirs`` returns TWO targets when ``~/.claude`` exists. If
        ``~/.agents`` copies OK (result.installed non-empty) but ``~/.claude`` raises
        OSError (result.errored), the success branch used to win over the errored
        branch - so a half-installed system reported success and emitted no
        write_failed telemetry for exactly the locked-down cohort under study. Any
        errored target must fail loud.
        """
        home = tmp_path / "home"
        # ~/.claude present -> _get_global_target_dirs yields both targets.
        (home / ".claude").mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
            # First target (~/.agents) copies fine; second (~/.claude) fails.
            patch.object(
                skills.shutil,
                "copytree",
                side_effect=[None, OSError("Permission denied")],
            ),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills._install_global_skills(yes=True)

        assert exc.value.reason == "write_failed"


class TestInteractiveModeSelection:
    """Tests for interactive mode selection."""

    def test_interactive_selects_global_mode(
        self, runner: CliRunner, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """Interactive prompt can select global installation mode."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(skills, "sys") as mock_sys,
            patch.object(skills, "_prompt_install_mode", return_value="global"),
            patch.object(skills, "_confirm_global_installation", return_value=True),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
        ):
            mock_sys.stdin.isatty.return_value = True
            result = runner.invoke(cli.main, ["skills"])

        assert result.exit_code == 0
        assert "Successfully installed globally" in result.output


class TestIsStreamlitOwnedSymlinkErrorPaths:
    """Tests for error handling in _is_streamlit_owned_symlink."""

    def test_handles_broken_symlink(self, tmp_path: Path) -> None:
        """Returns True for broken symlink with the correct name."""
        _skip_if_symlinks_not_supported(tmp_path)
        link = tmp_path / "developing-with-streamlit"
        # Create broken symlink
        link.symlink_to("../nonexistent/target")

        # Should return True based on name check
        assert skills._is_streamlit_owned_symlink(link, {"developing-with-streamlit"})


def _evaluate_nudge(
    tmp_path: Path,
    *,
    headless: bool = False,
    hide_welcome: bool = False,
    agents: tuple[str, ...] = ("claude",),
    installed_skills: tuple[str, ...] = (),
    marker_exists: bool = False,
) -> bool:
    """Run ``should_show_skills_nudge`` with the given conditions patched in."""
    marker = tmp_path / ".skills_nudge_dismissed"
    if marker_exists:
        marker.touch()

    options = {"server.headless": headless, "logger.hideWelcomeMessage": hide_welcome}

    with (
        patch("streamlit.config.get_option", side_effect=options.__getitem__),
        patch.object(skills, "_nudge_dismissed_marker_path", return_value=marker),
        patch(
            "streamlit.web.skills.detect_installed_agents",
            return_value=list(agents),
        ),
        patch(
            "streamlit.web.skills.detect_installed_skills",
            return_value=list(installed_skills),
        ),
    ):
        return skills.should_show_skills_nudge()


def test_should_show_skills_nudge_when_all_conditions_met(tmp_path: Path) -> None:
    """The nudge is recommended when an agent is present and skills are absent."""
    assert _evaluate_nudge(tmp_path) is True


def test_should_show_skills_nudge_hidden_when_headless(tmp_path: Path) -> None:
    """No nudge in headless mode (deployments, CI, SiS)."""
    assert _evaluate_nudge(tmp_path, headless=True) is False


def test_should_show_skills_nudge_hidden_when_welcome_message_hidden(
    tmp_path: Path,
) -> None:
    """No nudge when the welcome message is suppressed via config."""
    assert _evaluate_nudge(tmp_path, hide_welcome=True) is False


def test_should_show_skills_nudge_hidden_when_marker_exists(tmp_path: Path) -> None:
    """No nudge once the user has permanently dismissed it."""
    assert _evaluate_nudge(tmp_path, marker_exists=True) is False


def test_should_show_skills_nudge_hidden_when_no_agent(tmp_path: Path) -> None:
    """No nudge when no agent harness is detected on the system."""
    assert _evaluate_nudge(tmp_path, agents=()) is False


def test_should_show_skills_nudge_hidden_when_skills_installed(tmp_path: Path) -> None:
    """No nudge when the bundled skills are already installed."""
    assert (
        _evaluate_nudge(
            tmp_path,
            installed_skills=("home:claude:developing-with-streamlit",),
        )
        is False
    )


def test_should_show_skills_nudge_returns_false_on_error() -> None:
    """A detection failure suppresses the nudge rather than raising."""
    with patch("streamlit.config.get_option", side_effect=RuntimeError("boom")):
        assert skills.should_show_skills_nudge() is False


def test_write_nudge_dismissed_marker_creates_file(tmp_path: Path) -> None:
    """Writing the marker creates the file (and any missing parent dirs)."""
    marker = tmp_path / ".streamlit" / ".skills_nudge_dismissed"
    with patch.object(skills, "_nudge_dismissed_marker_path", return_value=marker):
        skills.write_nudge_dismissed_marker()
        # A second call must not raise even though the marker already exists.
        skills.write_nudge_dismissed_marker()

    assert marker.is_file()


def test_nudge_dismissed_marker_path_under_streamlit_dir() -> None:
    """The marker lives under the user's ``.streamlit`` config directory."""
    path = skills._nudge_dismissed_marker_path()
    assert path.name == ".skills_nudge_dismissed"
    assert path.parent.name == ".streamlit"


class TestSummarizeInstall:
    """Tests for summarize_install (the user-facing in-app nudge summary)."""

    def test_reports_distinct_install_locations(self) -> None:
        """Newly installed skills are summarized by their parent directories."""
        result = skills._InstallResult(
            installed=[
                ".agents/skills/developing-with-streamlit",
                ".claude/skills/developing-with-streamlit",
            ]
        )
        assert (
            skills.summarize_install(result)
            == "Installed to .agents/skills, .claude/skills."
        )

    def test_deduplicates_and_sorts_locations(self) -> None:
        """Multiple skills under one directory collapse to a single location."""
        result = skills._InstallResult(
            installed=[
                ".claude/skills/b",
                ".agents/skills/a",
                ".agents/skills/b",
            ]
        )
        assert (
            skills.summarize_install(result)
            == "Installed to .agents/skills, .claude/skills."
        )

    def test_reports_already_up_to_date(self) -> None:
        """When nothing new was installed, report the up-to-date state."""
        result = skills._InstallResult(up_to_date=[".agents/skills/foo"])
        assert skills.summarize_install(result) == "Skills are already up to date."

    def test_installed_takes_precedence_over_up_to_date(self) -> None:
        """A mixed result leads with what was newly installed, not up-to-date."""
        result = skills._InstallResult(
            installed=[".agents/skills/foo"], up_to_date=[".claude/skills/foo"]
        )
        assert skills.summarize_install(result) == "Installed to .agents/skills."

    def test_empty_result_has_no_summary(self) -> None:
        """An empty result yields no summary text (nothing to report)."""
        assert skills.summarize_install(skills._InstallResult()) == ""

    def test_collapses_absolute_paths_to_harness_skills(self) -> None:
        """When install paths are absolute (app run from a subdirectory), the
        summary still collapses to the concise ``<harness>/skills`` label.
        """
        result = skills._InstallResult(
            installed=[
                "/home/user/repo/.agents/skills/developing-with-streamlit",
                "/home/user/repo/.claude/skills/developing-with-streamlit",
            ]
        )
        assert (
            skills.summarize_install(result)
            == "Installed to .agents/skills, .claude/skills."
        )

    def test_global_install_keeps_tilde_prefix(self) -> None:
        """A global (home) install keeps its ``~`` so it isn't mislabeled as
        project-local. (Global fallback display paths are home-relative.)
        """
        result = skills._InstallResult(
            installed=["~/.agents/skills/developing-with-streamlit"]
        )
        assert skills.summarize_install(result) == "Installed to ~/.agents/skills."

    def test_reports_skipped_alongside_installed(self) -> None:
        """A partial install (some installed, some skipped) is not presented as
        a clean success: the skipped skills are surfaced too.
        """
        result = skills._InstallResult(
            installed=[".agents/skills/foo"],
            skipped=[".claude/skills/foo (existing file or directory)"],
        )
        assert skills.summarize_install(result) == (
            "Installed to .agents/skills. 1 skill skipped due to conflicts."
        )

    def test_reports_skipped_alongside_up_to_date(self) -> None:
        """Skipped skills are surfaced even when nothing new was installed, so an
        up-to-date result with conflicts isn't mistaken for fully installed.
        """
        result = skills._InstallResult(
            up_to_date=[".agents/skills/foo"],
            skipped=[
                ".claude/skills/foo (existing symlink)",
                ".agents/skills/bar (existing file)",
            ],
        )
        assert skills.summarize_install(result) == (
            "Skills are already up to date. 2 skills skipped due to conflicts."
        )


class TestConflictError:
    """_conflict_error names the specific conflicting paths (the message the
    in-app nudge shows verbatim), collapsed so it never leaks an absolute path.
    """

    def test_names_paths_collapsed_to_harness_tail(self) -> None:
        """Absolute target paths collapse to the concise <harness>/skills/<skill>
        tail, and multiple conflicts read as a plural list."""
        err = skills._conflict_error(
            [
                (
                    "/abs/tmp/proj/.agents/skills/developing-with-streamlit "
                    "(existing file or directory)"
                ),
                (
                    "/abs/tmp/proj/.claude/skills/developing-with-streamlit "
                    "(existing file or directory)"
                ),
            ]
        )
        message = err.format_message()
        assert "/abs/tmp/proj" not in message
        assert ".agents/skills/developing-with-streamlit" in message
        assert ".claude/skills/developing-with-streamlit" in message
        assert "already exist." in message
        assert "Remove them and try again." in message

    def test_single_conflict_reads_singular(self) -> None:
        """A lone conflict uses singular phrasing ("exists" / "it")."""
        err = skills._conflict_error(
            [".agents/skills/developing-with-streamlit (existing symlink)"]
        )
        message = err.format_message()
        assert ".agents/skills/developing-with-streamlit already exists." in message
        assert "Remove it and try again." in message

    def test_conflict_error_carries_conflict_reason(self) -> None:
        """The conflict error is an ``_InstallError`` tagged ``reason="conflict"`` so
        the handler forwards it to install-failure telemetry."""
        err = skills._conflict_error(
            [".agents/skills/developing-with-streamlit (existing file or directory)"]
        )
        assert isinstance(err, skills._InstallError)
        assert err.reason == "conflict"


class TestInstallSkillsReturnsResult:
    """install_skills returns the structured result for callers (e.g. the nudge)."""

    def test_project_install_returns_installed_paths(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A project-mode install returns the newly created skill paths."""
        _skip_if_symlinks_not_supported(tmp_path)
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills.install_skills(yes=True)

        assert any("developing-with-streamlit" in path for path in result.installed)
        # A fresh install into an empty project skips nothing.
        assert result.skipped == []


class TestInstallDetectRoundtrip:
    """A successful one-click install must land where the nudge's skill
    detection scans, so ``should_show_skills_nudge`` returns ``False``
    afterwards and the nudge stops re-appearing — even when the install root is
    neither the app dir nor the git root.

    This is the regression guard for the install/detection project-root
    divergence. Detection now resolves its project root via the very same
    ``skills._find_project_root`` the installer uses, so the two cannot drift;
    this end-to-end test confirms the install->detect roundtrip closes. The
    pre-existing tests only covered the standard ``.git``-at-the-root layout,
    which masked the original bug.
    """

    @pytest.mark.parametrize("with_git", [True, False])
    def test_detection_sees_install_in_agent_config_ancestor(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, with_git: bool
    ) -> None:
        """Install lands in a ``.claude`` ancestor between the app dir and the
        (optional) git root; detection must still find it. ``with_git=True`` is
        the monorepo/per-package case; ``with_git=False`` is the no-git case.
        """

        _skip_if_symlinks_not_supported(tmp_path)

        # ``resolve()`` the base so the relative install symlink never dangles
        # through a symlinked ancestor (e.g. macOS /var -> /private/var).
        base = tmp_path.resolve()

        # Isolated HOME: an agent harness present, but no skills installed there.
        home = base / "home"
        (home / ".claude").mkdir(parents=True)
        monkeypatch.setenv("HOME", str(home))

        # Bundled source skill the installer symlinks to.
        source_dir = base / "pkg" / ".agents" / "skills"
        skill_dir = source_dir / "developing-with-streamlit"
        skill_dir.mkdir(parents=True)
        (skill_dir / "SKILL.md").write_text("# Skill\n", encoding="utf-8")

        # Layout: per-package ``.claude`` one level in, app nested below it. The
        # install root (the package) is neither the app dir nor the git root.
        repo = base / "repo"
        repo.mkdir()
        if with_git:
            (repo / ".git").mkdir()
        package = repo / "package"
        (package / ".claude").mkdir(parents=True)
        app_dir = package / "src"
        app_dir.mkdir()

        def clear_caches() -> None:
            skills._detect_installed_skills_cached.cache_clear()
            skills._detect_installed_agents_cached.cache_clear()

        with (
            patch.object(skills, "_get_source_skills_dir", return_value=source_dir),
            # Not headless / welcome message not hidden, so only detection gates.
            patch("streamlit.config.get_option", return_value=False),
        ):
            clear_caches()
            # Pre-install the nudge is recommended (agent present, no skills).
            assert skills.should_show_skills_nudge(str(app_dir)) is True

            skills.install_skills(global_mode=False, yes=True, app_dir=str(app_dir))

            # Mimic the in-app handler invalidating the detection cache.
            skills.clear_installed_skills_cache()
            clear_caches()

            # The install landed in the package's agent-config dirs...
            assert (
                package / ".claude" / "skills" / "developing-with-streamlit"
            ).exists()
            # ...and detection now sees it, so the nudge is suppressed. Without
            # the project-root unification, both of these would be the
            # pre-install values (empty / True) and the nudge would re-appear.
            assert skills.detect_installed_skills(str(app_dir)) != []
            assert skills.should_show_skills_nudge(str(app_dir)) is False


class TestGenerateGitignoreSnippetEdgeCases:
    """Edge cases for _generate_gitignore_snippet."""

    def test_target_dir_outside_project_root_uses_absolute_path(
        self, tmp_path: Path
    ) -> None:
        """Falls back to absolute path when target_dir is not relative to project_root."""
        project_root = tmp_path / "project"
        unrelated_dir = tmp_path / "elsewhere" / "skills"

        result = skills._generate_gitignore_snippet(
            ["my-skill"], [unrelated_dir], project_root
        )

        # Snippet should contain the absolute path of the unrelated dir
        assert f"{unrelated_dir}/my-skill" in result
        assert "my-skill/" not in result


class TestGetDisplayPath:
    """Tests for _get_display_path."""

    def test_returns_relative_path_when_under_base(self, tmp_path: Path) -> None:
        """Returns the path relative to base_path when nested."""
        target = tmp_path / "sub" / "file"
        result = skills._get_display_path(target, tmp_path)
        # Use as_posix-equivalent comparison to avoid OS-specific separator issues
        assert result.parts[-2:] == ("sub", "file")

    def test_returns_tilde_prefixed_path_when_under_home(self, tmp_path: Path) -> None:
        """Returns ~/<rel> when use_tilde=True and target is under base."""
        target = tmp_path / "sub" / "file"
        result = skills._get_display_path(target, tmp_path, use_tilde=True)
        assert result.parts[0] == "~"
        assert result.parts[-2:] == ("sub", "file")

    def test_returns_absolute_path_when_outside_base(self, tmp_path: Path) -> None:
        """Returns the original absolute target when not under base."""
        base = tmp_path / "base"
        target = tmp_path / "elsewhere" / "file"
        result = skills._get_display_path(target, base)
        assert result == target

    def test_returns_absolute_path_when_outside_base_with_tilde(
        self, tmp_path: Path
    ) -> None:
        """ValueError fallback returns the original path even when use_tilde=True."""
        base = tmp_path / "base"
        target = tmp_path / "elsewhere" / "file"
        result = skills._get_display_path(target, base, use_tilde=True)
        assert result == target


class TestAreSkillsInstalledErrorHandling:
    """Tests for OSError handling inside the directory-iteration loop."""

    def test_continues_when_skill_path_check_errors(self, tmp_path: Path) -> None:
        """Continues to next candidate dir when is_symlink/exists raise OSError."""
        first_dir = tmp_path / "first" / ".agents" / "skills"
        second_dir = tmp_path / "second" / ".agents" / "skills"
        (second_dir / skills._GLOBAL_SKILL_NAME).mkdir(parents=True)

        # Raise OSError when checking the first (nonexistent) candidate so the
        # loop must continue to the second (existing) one. Returning False for
        # all other paths is safe because none of them are real symlinks.
        first_skill = first_dir / skills._GLOBAL_SKILL_NAME

        def patched_is_symlink(self: Path) -> bool:
            if self == first_skill:
                raise OSError("Simulated filesystem failure")
            return False

        with (
            patch.object(skills, "_find_project_root", return_value=tmp_path),
            patch.object(
                skills,
                "_get_project_target_dirs",
                return_value=[first_dir, second_dir],
            ),
            patch.object(skills, "_get_global_target_dirs", return_value=[]),
            patch("pathlib.Path.is_symlink", patched_is_symlink),
        ):
            assert skills.are_skills_installed() is True


class TestConfirmProjectInstallationEdgeCases:
    """Edge cases for _confirm_project_installation."""

    def test_target_dir_outside_project_root_uses_absolute_path(
        self, tmp_path: Path
    ) -> None:
        """Shows absolute path when target_dir is not relative to project_root."""
        project_root = tmp_path / "project"
        unrelated_dir = tmp_path / "elsewhere" / "skills"

        with patch("click.confirm", return_value=True) as mock_confirm:
            result = skills._confirm_project_installation(
                project_root=project_root,
                skills=["my-skill"],
                target_dirs=[unrelated_dir],
            )

        assert result is True
        mock_confirm.assert_called_once()


class TestConfirmGlobalInstallationEdgeCases:
    """Edge cases for _confirm_global_installation."""

    def test_target_dir_outside_home_uses_absolute_path(self, tmp_path: Path) -> None:
        """Shows absolute path when target_dir is not relative to home."""
        home = tmp_path / "home"
        home.mkdir()
        unrelated_dir = tmp_path / "elsewhere" / "skills"

        with (
            patch("pathlib.Path.home", return_value=home),
            patch("click.confirm", return_value=True),
        ):
            result = skills._confirm_global_installation(target_dirs=[unrelated_dir])

        assert result is True


class TestInstallProjectSkillsNoFallback:
    """Tests for _install_project_skills with fallback_to_global=False."""

    @pytest.mark.parametrize(
        ("precheck_blocker", "install_skill_symlink_return"),
        [
            ("symlinks_unsupported", True),
            (None, False),
        ],
        ids=["symlinks_unsupported_globally", "individual_symlink_failed"],
    )
    def test_raises_clickexception_without_fallback(
        self,
        tmp_path: Path,
        mock_source_skills_dir: Path,
        precheck_blocker: str | None,
        install_skill_symlink_return: bool,
    ) -> None:
        """Raises ClickException when symlinks are unavailable and fallback disabled."""
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch.object(skills, "_symlink_blocker", return_value=precheck_blocker),
            patch.object(
                skills,
                "_install_skill_symlink",
                return_value=install_skill_symlink_return,
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            with pytest.raises(click.ClickException, match="Symlinks not supported"):
                skills._install_project_skills(yes=True, fallback_to_global=False)


class TestInstallProjectSkillsFallbackErrors:
    """Tests for fallback-to-global error handling in _install_project_skills."""

    @pytest.mark.parametrize(
        ("global_install_side_effect", "match"),
        [
            (click.exceptions.Abort(), "Installation incomplete"),
            (click.ClickException("global copy failure"), "global copy failure"),
        ],
        ids=["user_aborted_global_install", "global_install_click_exception"],
    )
    def test_fallback_to_global_surfaces_errors_as_clickexception(
        self,
        tmp_path: Path,
        mock_source_skills_dir: Path,
        global_install_side_effect: BaseException,
        match: str,
    ) -> None:
        """Errors from the global fallback install surface as a ClickException."""
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch.object(skills, "_symlink_blocker", return_value=None),
            patch.object(skills, "_install_skill_symlink", return_value=False),
            patch.object(
                skills,
                "_install_global_skills",
                side_effect=global_install_side_effect,
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            with pytest.raises(click.ClickException, match=match):
                skills._install_project_skills(yes=True)


class TestInstallProjectSkillsFallbackSignal:
    """fallback_reason names WHY an install took the symlink->global path."""

    @pytest.mark.parametrize(
        ("precheck_blocker", "expected_reason"),
        [
            ("symlinks_no_privilege", "symlinks_no_privilege"),
            ("symlinks_denied", "symlinks_denied"),
            ("symlinks_unsupported", "symlinks_unsupported"),
            (None, "symlink_failed"),
        ],
        ids=["dev_mode_off", "project_dir_denied", "no_symlink_support", "link_failed"],
    )
    def test_fallback_records_its_cause(
        self,
        tmp_path: Path,
        mock_source_skills_dir: Path,
        precheck_blocker: str | None,
        expected_reason: str,
    ) -> None:
        """Each fallback route is recorded distinctly, not collapsed into one flag.

        A project install that can't lay symlinks is silently rerouted to a global
        copy, so it looks identical to a project install in the success telemetry.
        Most Windows users land here and then succeed, which makes this the label
        carrying their diagnostic signal — and Developer Mode being off is a
        documentable user action, while the others are not.
        """
        project_dir = tmp_path / "project"
        project_dir.mkdir()
        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch.object(skills, "_symlink_blocker", return_value=precheck_blocker),
            # Force the per-skill symlink to fail (only reached when the pre-check
            # said symlinks work); harmless on the pre-check path.
            patch.object(skills, "_install_skill_symlink", return_value=False),
            patch.object(
                skills,
                "_install_global_skills",
                return_value=skills._InstallResult(
                    installed=["~/.agents/skills/developing-with-streamlit"]
                ),
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._install_project_skills(yes=True)

        assert result.fallback_reason == expected_reason

    def test_project_symlink_install_has_no_fallback_reason(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A normal project (symlink) install records no fallback reason."""
        project_dir = tmp_path / "project"
        project_dir.mkdir()
        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch.object(skills, "_symlink_blocker", return_value=None),
            patch.object(skills, "_install_skill_symlink", return_value=True),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
        ):
            result = skills._install_project_skills(yes=True)

        assert result.fallback_reason is None


class TestRaiseSiteReasons:
    """Every raise site reports the reason the telemetry vocabulary expects.

    mypy rejects an *invalid* reason but not a wrong *choice* among valid ones — so
    tagging the meta-skill check ``source_missing`` instead of ``source_incomplete``
    would type-check, ship, and quietly point a dashboard at the wrong packaging bug.
    The existing tests for these paths assert on user-facing messages, which a
    mis-tagged reason passes. These assert the reason itself.
    """

    def test_absent_skills_directory_is_source_missing(self, tmp_path: Path) -> None:
        """Nothing installed in the wheel at all -> missing package data."""
        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=tmp_path / "nope"
            ),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills._install_project_skills(yes=True)

        assert exc.value.reason == "source_missing"

    def test_incomplete_meta_skill_is_source_incomplete(self, tmp_path: Path) -> None:
        """Directory present but a required file missing -> too-narrow glob.

        Distinct from source_missing on purpose: "the wheel has no skills" and "the
        wheel has the folder but not scripts/discover.py" are different packaging
        bugs with different fixes.
        """
        meta_dir = tmp_path / "meta"
        skill_dir = meta_dir / "developing-with-streamlit"
        skill_dir.mkdir(parents=True)
        # SKILL.md present, scripts/discover.py absent - the router without its target.
        (skill_dir / "SKILL.md").write_text("# Meta\n", encoding="utf-8")

        with (
            patch.object(skills, "_get_meta_skill_dir", return_value=meta_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills._install_global_skills(yes=True)

        assert exc.value.reason == "source_incomplete"

    def test_empty_skills_directory_is_no_skills(self, tmp_path: Path) -> None:
        """The directory exists but discovery found nothing installable."""
        empty = tmp_path / "empty"
        empty.mkdir()
        with (
            patch.object(skills, "_get_source_skills_dir", return_value=empty),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills._install_project_skills(yes=True)

        assert exc.value.reason == "no_skills"

    def test_no_tty_without_yes_is_non_interactive(
        self, mock_source_skills_dir: Path
    ) -> None:
        """CLI-only: nothing to prompt on and --yes was not passed."""
        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch("sys.stdin.isatty", return_value=False),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills.install_skills()

        assert exc.value.reason == "non_interactive"

    def test_cancelled_global_fallback_is_incomplete(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Project symlinks failed and the user declined the global fallback."""
        project_dir = tmp_path / "project"
        project_dir.mkdir()
        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch.object(skills, "_symlink_blocker", return_value=None),
            patch.object(skills, "_install_skill_symlink", return_value=False),
            patch.object(
                skills, "_install_global_skills", side_effect=click.exceptions.Abort()
            ),
            patch("pathlib.Path.cwd", return_value=project_dir),
            patch("pathlib.Path.home", return_value=tmp_path / "home"),
            pytest.raises(skills._InstallError) as exc,
        ):
            skills._install_project_skills(yes=True)

        assert exc.value.reason == "incomplete"


class TestSymlinkBlocker:
    """_symlink_blocker names WHY symlinks are unavailable, not just that they are."""

    def test_returns_none_when_symlinks_work(self, tmp_path: Path) -> None:
        """A successful probe reports no blocker."""
        _skip_if_symlinks_not_supported(tmp_path)
        source = tmp_path / "source"
        source.mkdir()
        assert skills._symlink_blocker(tmp_path, source) is None

    def test_identifies_windows_developer_mode_off(self, tmp_path: Path) -> None:
        """ERROR_PRIVILEGE_NOT_HELD is reported as symlinks_no_privilege.

        This is the single most useful value in the vocabulary: it means the account
        lacks SeCreateSymbolicLinkPrivilege, i.e. Developer Mode is off — the one
        cause of a global-fallback install that a user can simply fix. Collapsing it
        into "unsupported" would hide a documentable action behind a dead end.
        """
        source = tmp_path / "source"
        source.mkdir()
        denied = OSError(errno.EPERM, "A required privilege is not held")
        denied.winerror = 1314  # type: ignore[attr-defined]

        with patch.object(skills.Path, "symlink_to", side_effect=denied):
            assert skills._symlink_blocker(tmp_path, source) == "symlinks_no_privilege"

    def test_distinguishes_a_denied_project_directory(self, tmp_path: Path) -> None:
        """A plain permission denial is an environment problem, not a missing feature."""
        source = tmp_path / "source"
        source.mkdir()
        with patch.object(
            skills.Path, "symlink_to", side_effect=OSError(errno.EACCES, "denied")
        ):
            assert skills._symlink_blocker(tmp_path, source) == "symlinks_denied"

    def test_reports_unsupported_for_a_filesystem_without_symlinks(
        self, tmp_path: Path
    ) -> None:
        """NotImplementedError means the platform has no directory symlinks at all."""
        source = tmp_path / "source"
        source.mkdir()
        with patch.object(skills.Path, "symlink_to", side_effect=NotImplementedError):
            assert skills._symlink_blocker(tmp_path, source) == "symlinks_unsupported"

    def test_reports_unsupported_when_the_link_silently_is_not_one(
        self, tmp_path: Path
    ) -> None:
        """A probe that "succeeds" without producing a symlink is not support.

        Some filesystems accept the call and create something else. Claiming support
        we could not verify would route the install down the symlink path and fail
        later, with a worse reason attached.
        """
        source = tmp_path / "source"
        source.mkdir()
        with (
            patch.object(skills.Path, "symlink_to"),
            patch.object(skills.Path, "is_symlink", return_value=False),
        ):
            assert skills._symlink_blocker(tmp_path, source) == "symlinks_unsupported"


class TestClassifyWriteError:
    """_classify_write_error maps OSError codes to actionable reasons."""

    @pytest.mark.parametrize(
        ("errno_name", "expected"),
        [
            ("EACCES", "write_denied"),
            ("EPERM", "write_denied"),
            ("EROFS", "write_denied"),
            ("ENOSPC", "write_no_space"),
            ("EBUSY", "write_locked"),
            ("ENAMETOOLONG", "write_name_too_long"),
        ],
    )
    def test_maps_posix_errnos(self, errno_name: str, expected: str) -> None:
        """Each POSIX code that implies a distinct fix gets its own reason."""
        code = getattr(errno, errno_name)
        assert skills._classify_write_error(OSError(code, "boom")) == expected

    def test_unrecognised_errno_stays_generic(self) -> None:
        """An unmapped code reports write_failed rather than being mis-bucketed.

        Guessing would be worse than admitting ignorance: a wrong specific reason
        sends whoever reads the telemetry after the wrong fix.
        """
        assert skills._classify_write_error(OSError(errno.EIO, "io")) == "write_failed"
        assert skills._classify_write_error(OSError()) == "write_failed"

    def test_winerror_takes_precedence_over_errno(self) -> None:
        """A Windows sharing violation is a lock, not a permissions problem.

        CPython maps ERROR_SHARING_VIOLATION (32) to EACCES, so trusting errno on
        Windows would report write_denied and point at folder ACLs — when the real
        cause is antivirus or a sync client holding the file, and the real fix is to
        retry. winerror is therefore consulted first.
        """
        locked = OSError(errno.EACCES, "in use")
        locked.winerror = 32  # type: ignore[attr-defined]
        assert skills._classify_write_error(locked) == "write_locked"

    def test_unrecognised_winerror_falls_back_to_errno(self) -> None:
        """An unmapped Windows code still uses whatever errno CPython supplied."""
        denied = OSError(errno.EACCES, "denied")
        denied.winerror = 1_000_000  # type: ignore[attr-defined]
        assert skills._classify_write_error(denied) == "write_denied"


class TestInstallSkillCopyStaging:
    """Staging behavior for _install_skill_copy replacements."""

    def test_sweeps_staging_dir_orphaned_by_an_interrupted_install(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """An old staging dir left by a crashed run is reclaimed."""
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        # Existing target with different content forces the staged-swap path.
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "stale-file.txt").write_text("old", encoding="utf-8")

        orphan = target_dir / f"{skills._STAGING_PREFIX}abc123"
        orphan.mkdir()
        (orphan / "leftover.txt").write_text("leftover", encoding="utf-8")
        # Backdate it well past the orphan threshold.
        old = time.time() - skills._STAGING_ORPHAN_AGE_S - 60
        os.utime(orphan, (old, old))

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert len(result.installed) == 1
        assert (target / "SKILL.md").is_file()
        assert not (target / "stale-file.txt").exists()
        # The orphan is gone, and this run's own staging dir left nothing behind.
        assert not orphan.exists()
        assert not list(target_dir.glob(f"{skills._STAGING_PREFIX}*"))

    def test_leaves_a_concurrent_installs_staging_dir_alone(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """A freshly-created staging dir belongs to a live install — do not touch it.

        Sweeping on name alone would delete a concurrent invocation's staging dir. That
        dir may already hold the old installation it moved aside, so the sweep would
        destroy both that and its replacement and leave the canonical path empty —
        orphan cleanup turned into data loss. Age separates live from abandoned without
        needing a lock.
        """
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "stale-file.txt").write_text("old", encoding="utf-8")

        # Stand in for another process mid-swap: its staging dir already holds the
        # only copy of the installation it displaced.
        live = target_dir / f"{skills._STAGING_PREFIX}live99"
        (live / skills._STAGING_OLD).mkdir(parents=True)
        (live / skills._STAGING_OLD / "SKILL.md").write_text(
            "# Their only copy\n", encoding="utf-8"
        )

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert len(result.installed) == 1
        # The other invocation's displaced installation must survive untouched.
        assert (live / skills._STAGING_OLD / "SKILL.md").read_text() == (
            "# Their only copy\n"
        )

    def test_never_deletes_a_directory_it_did_not_create(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Unrelated hidden directories in the target survive an install.

        Staging used to use predictable sibling names (``.<skill>.tmp`` /
        ``.<skill>.old``) and cleared them before use, so a directory the installer
        never created could be recursively deleted. Staging is now a fresh
        ``mkdtemp``, and the sweep matches only its own prefix, so nothing outside
        that prefix is ever touched.
        """
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "stale-file.txt").write_text("old", encoding="utf-8")

        # The exact names the old implementation would have wiped, plus a plain one.
        bystanders = [
            target_dir / ".developing-with-streamlit.tmp",
            target_dir / ".developing-with-streamlit.old",
            target_dir / ".developing-with-streamlit.newlink",
            target_dir / ".my-notes",
        ]
        for d in bystanders:
            d.mkdir()
            (d / "precious.txt").write_text("do not delete", encoding="utf-8")

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
                {"developing-with-streamlit"},
            )

        assert len(result.installed) == 1
        for d in bystanders:
            assert (d / "precious.txt").read_text() == "do not delete"


class TestGetMetaSkillDir:
    """Tests for _get_meta_skill_dir."""

    def test_returns_meta_skill_path_in_package(self) -> None:
        """Returns <streamlit package>/.agents/meta-skill, distinct from content."""
        result = skills._get_meta_skill_dir()
        assert result.name == "meta-skill"
        assert result.parent.name == ".agents"
        # The meta-skill dir must be separate from the version-matched content
        # skills dir, so project-mode discovery never treats it as a content skill.
        assert result != skills._get_source_skills_dir()


class TestInstallGlobalSkillsMetaSkill:
    """Global install copies the bundled meta-skill from local disk (no network)."""

    def test_global_install_never_hits_network(
        self, runner: CliRunner, tmp_path: Path, mock_meta_skill_dir: Path
    ) -> None:
        """A global install must not open a network connection (any transport).

        Regression guard for issue #15933: the old implementation downloaded the
        skill from GitHub, which failed ~12% of the time on locked-down Windows.
        Block the network at the socket layer (rather than patching one HTTP
        client) so a reintroduced download via urllib, requests, httpx, urllib3,
        etc. all fail the test; the copy-from-local-disk install must still
        succeed with zero connections.
        """
        import socket

        home = tmp_path / "home"
        home.mkdir(parents=True)

        def _blocked(*_args: object, **_kwargs: object) -> None:
            raise AssertionError("global install must not open a network connection")

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_meta_skill_dir", return_value=mock_meta_skill_dir
            ),
            patch.object(socket.socket, "connect", _blocked),
            patch.object(socket.socket, "connect_ex", _blocked),
        ):
            result = runner.invoke(cli.main, ["skills", "-g", "-y"])

        assert result.exit_code == 0
        assert (
            home
            / ".agents"
            / "skills"
            / "developing-with-streamlit"
            / "scripts"
            / "discover.py"
        ).is_file()

    def test_global_install_missing_meta_skill_errors_without_leaking_path(
        self, runner: CliRunner, tmp_path: Path
    ) -> None:
        """A missing bundled meta-skill fails with a generic, path-free message."""
        home = tmp_path / "home"
        home.mkdir(parents=True)
        missing = tmp_path / "nonexistent-meta-skill"

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(skills, "_get_meta_skill_dir", return_value=missing),
        ):
            result = runner.invoke(cli.main, ["skills", "-g", "-y"])

        assert result.exit_code != 0
        assert "was not found" in result.output
        # The server-side absolute path must not leak into the user-facing error.
        assert str(missing) not in result.output

    def test_global_install_requires_discover_py_not_just_skill_md(
        self, runner: CliRunner, tmp_path: Path
    ) -> None:
        """SKILL.md alone is not enough — discover.py must be present too.

        The meta-skill's SKILL.md is inert without scripts/discover.py (it just
        routes the agent into that script). If a stripped wheel or a too-narrow
        package-data glob shipped SKILL.md only, the install must error rather
        than report success for a skill that fails the moment an agent runs it.
        """
        home = tmp_path / "home"
        home.mkdir(parents=True)
        # Meta-skill dir with SKILL.md but NO scripts/discover.py.
        meta_dir = tmp_path / "meta-skill"
        (meta_dir / "developing-with-streamlit").mkdir(parents=True)
        (meta_dir / "developing-with-streamlit" / "SKILL.md").write_text(
            "# Meta Skill\n", encoding="utf-8"
        )

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(skills, "_get_meta_skill_dir", return_value=meta_dir),
        ):
            result = runner.invoke(cli.main, ["skills", "-g", "-y"])

        assert result.exit_code != 0
        assert "was not found" in result.output
        # Nothing should have been copied to the global target.
        assert not (home / ".agents" / "skills" / "developing-with-streamlit").exists()


class TestMetaSkillPackaging:
    """Guards that the vendored meta-skill files actually ship in the wheel."""

    def test_package_data_globs_cover_vendored_meta_skill(self) -> None:
        """The setuptools ``package-data`` globs must match both vendored files.

        Every other test reads the vendored files straight from the on-disk
        checkout, so they stay green even if the ``package-data`` globs were
        wrong or removed — the failure would only surface for real pip-installed
        users, exactly the "global install broken on a real machine" class this
        change exists to prevent. This asserts the declared globs, applied to the
        real package dir, include ``SKILL.md`` and ``scripts/discover.py``.
        """
        import glob as globmod

        import toml

        pyproject = Path(__file__).resolve().parents[3] / "pyproject.toml"
        if not pyproject.is_file():  # pragma: no cover - unusual layout
            pytest.skip("lib/pyproject.toml not found in this layout")

        globs = toml.load(pyproject)["tool"]["setuptools"]["package-data"]["streamlit"]
        # <streamlit pkg>/.agents/skills -> <streamlit pkg>
        pkg_dir = skills._get_source_skills_dir().parents[1]

        matched: set[str] = set()
        for pattern in globs:
            matched.update(
                Path(hit).as_posix()
                for hit in globmod.glob(pattern, root_dir=pkg_dir, recursive=True)
            )

        assert ".agents/meta-skill/developing-with-streamlit/SKILL.md" in matched
        assert (
            ".agents/meta-skill/developing-with-streamlit/scripts/discover.py"
            in matched
        )

    @pytest.mark.slow
    def test_built_wheel_contains_vendored_meta_skill(self, tmp_path: Path) -> None:
        """A real built wheel must contain SKILL.md AND scripts/discover.py.

        The glob-match test above checks the declared package-data patterns
        against on-disk files, but not that the build backend actually ships
        them in the wheel (MANIFEST/include-package-data/backend quirks could
        still drop a file). A missing ``discover.py`` would break every global
        install deterministically — the exact failure this change removes — so
        build the wheel and assert both files are inside it.
        """
        import zipfile

        lib_dir = Path(__file__).resolve().parents[3]  # .../lib
        if not (lib_dir / "pyproject.toml").is_file():  # pragma: no cover
            pytest.skip("lib/pyproject.toml not found in this layout")

        out_dir = tmp_path / "dist"
        # --no-isolation reuses the current env's build backend (setuptools is
        # already installed), so this is a fast file-copy+zip, not a full env
        # bootstrap. Skip gracefully if the build tooling is unavailable.
        build = subprocess.run(
            [
                sys.executable,
                "-m",
                "build",
                "--wheel",
                "--no-isolation",
                "--outdir",
                str(out_dir),
                str(lib_dir),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if build.returncode != 0:  # pragma: no cover - env-dependent
            pytest.skip(f"wheel build unavailable here: {build.stderr[-400:]}")

        wheels = list(out_dir.glob("*.whl"))
        assert wheels, "no wheel was produced"
        names = zipfile.ZipFile(wheels[0]).namelist()
        meta = "streamlit/.agents/meta-skill/developing-with-streamlit"
        assert f"{meta}/SKILL.md" in names
        assert f"{meta}/scripts/discover.py" in names


class TestVendoredMetaSkillDiscovery:
    """Compatibility contract: the vendored discover.py resolves bundled content."""

    def test_discover_py_resolves_bundled_content_skill(self, tmp_path: Path) -> None:
        """Running the vendored meta-skill ``discover.py`` resolves the installed
        Streamlit's bundled content ``SKILL.md``.

        This is the contract the global install (and any frozen external copy of
        the meta-skill) depends on: ``discover.py`` must find
        ``<streamlit>/.agents/skills/developing-with-streamlit/SKILL.md``. Runs
        under the test interpreter (which has Streamlit installed), so no network
        and no reliance on the download path.
        """
        discover_py = (
            skills._get_meta_skill_dir()
            / "developing-with-streamlit"
            / "scripts"
            / "discover.py"
        )
        content_skill = (
            skills._get_source_skills_dir() / "developing-with-streamlit" / "SKILL.md"
        )
        if not discover_py.is_file() or not content_skill.is_file():
            pytest.skip(
                "vendored meta-skill or bundled content not present in this install"
            )

        # Pin discover.py's interpreter detection to this test's own interpreter
        # (which has Streamlit) by pointing VIRTUAL_ENV at its venv root. discover.py
        # re-detects the project interpreter from VIRTUAL_ENV/PATH rather than
        # reusing the launching sys.executable, so without this the test would fail
        # (not skip) whenever the first python on PATH lacks Streamlit — e.g. when
        # run outside ``uv``.
        venv_root = os.path.dirname(os.path.dirname(sys.executable))
        result = subprocess.run(
            [sys.executable, str(discover_py), "--project-dir", str(tmp_path)],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
            env={**os.environ, "VIRTUAL_ENV": venv_root},
        )

        assert result.returncode == 0, result.stderr
        assert os.path.realpath(result.stdout.strip()) == os.path.realpath(
            content_skill
        )
