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

import os
from typing import TYPE_CHECKING
from unittest.mock import patch

import click
import pytest
from click.testing import CliRunner

from streamlit.web import cli, skills

if TYPE_CHECKING:
    from pathlib import Path


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

        assert "# Streamlit agent skills" in result
        assert ".agents/skills/developing-with-streamlit/" in result

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

        assert ".agents/skills/developing-with-streamlit/" in result
        assert ".claude/skills/developing-with-streamlit/" in result

    def test_generates_snippet_for_multiple_skills(self, tmp_path: Path) -> None:
        """Generates entries for all discovered skills."""
        project_root = tmp_path / "project"
        target_dirs = [project_root / ".agents" / "skills"]
        skill_names = ["developing-with-streamlit", "debugging-apps"]

        result = skills._generate_gitignore_snippet(
            skill_names, target_dirs, project_root
        )

        assert ".agents/skills/developing-with-streamlit/" in result
        assert ".agents/skills/debugging-apps/" in result


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
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """The --global flag triggers global installation mode."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
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
        with patch.object(
            skills, "_get_source_skills_dir", return_value=tmp_path / "nonexistent"
        ):
            result = runner.invoke(cli.main, ["skills", "--yes"])

        assert result.exit_code != 0
        assert "not found" in result.output

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
            patch.object(skills, "_symlinks_supported", return_value=False),
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
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Global install copies skills to home directories."""
        home = tmp_path / "home"
        (home / ".claude").mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
        ):
            result = runner.invoke(cli.main, ["skills", "-g", "-y"])

        assert result.exit_code == 0
        assert (home / ".agents" / "skills" / "developing-with-streamlit").is_dir()
        assert (home / ".claude" / "skills" / "developing-with-streamlit").is_dir()

    def test_skills_global_rerun_reports_up_to_date(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Global install reports up to date when managed copy is unchanged."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
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

        assert any("copy failed" in s for s in result.failed)

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
        assert any("copy failed" in s for s in result.failed)


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
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
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
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
        ):
            result = runner.invoke(cli.main, ["skills", "--global", "--yes"])

        assert result.exit_code != 0
        # The error names the specific conflicting path, not a vague "conflicts".
        assert ".agents/skills/developing-with-streamlit" in result.output
        assert "already exist" in result.output


class TestInteractiveModeSelection:
    """Tests for interactive mode selection."""

    def test_interactive_selects_global_mode(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
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
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
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

    def test_reports_failed_alongside_installed(self) -> None:
        """A partial global install (one target written, another failed to write,
        e.g. Windows MAX_PATH or a permission error) is not presented as a clean
        success: the failed target is surfaced too.
        """
        result = skills._InstallResult(
            installed=[".agents/skills/developing-with-streamlit"],
            failed=[
                (
                    ".claude/skills/developing-with-streamlit "
                    "(copy failed: [Errno 13] Permission denied)"
                )
            ],
        )
        assert skills.summarize_install(result) == (
            "Installed to .agents/skills. 1 skill failed to install."
        )


class TestGlobalInstallFailureReasons:
    """The bundled-copy global install (and the Windows symlink->global fallback
    that reaches it) tags failures with a machine-readable ``reason`` the handler
    forwards to install telemetry, so the post-fix residual stays measurable."""

    def test_copy_failure_reports_copy_failed_reason(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """An OSError while writing the copy (permissions, disk, or the Windows
        260-char path limit) raises ``reason="copy_failed"`` - not the
        pre-existing-path ``"conflict"`` it used to be mislabeled as."""
        home = tmp_path / "home"
        home.mkdir()
        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch.object(
                skills.shutil, "copytree", side_effect=OSError("Filename too long")
            ),
        ):
            with pytest.raises(skills._InstallError) as exc:
                skills._install_global_skills(yes=True)
        assert exc.value.reason == "copy_failed"

    def test_missing_bundled_skill_reports_source_missing_reason(
        self, tmp_path: Path
    ) -> None:
        """When the package ships no bundled skill the install fails fast with
        ``reason="source_missing"`` - there is no network fetch to fall back on."""
        home = tmp_path / "home"
        home.mkdir()
        empty_source = tmp_path / "empty" / ".agents" / "skills"
        empty_source.mkdir(parents=True)
        with (
            patch("pathlib.Path.home", return_value=home),
            patch.object(skills, "_get_source_skills_dir", return_value=empty_source),
        ):
            with pytest.raises(skills._InstallError) as exc:
                skills._install_global_skills(yes=True)
        assert exc.value.reason == "source_missing"


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


class TestCopyFailedError:
    """_copy_failed_error reports a failed *write* (not a pre-existing conflict)
    and, like _conflict_error, collapses paths so the in-app nudge never shows an
    absolute server path."""

    def test_carries_copy_failed_reason_and_collapses_paths(self) -> None:
        """Tagged ``reason="copy_failed"``; the absolute target path collapses to
        the concise <harness>/skills/<skill> tail and the raw OS error (which may
        contain an absolute path) is dropped entirely."""
        err = skills._copy_failed_error(
            [
                (
                    "/abs/home/.agents/skills/developing-with-streamlit "
                    "(copy failed: [Errno 13] Permission denied: '/abs/home/x')"
                )
            ]
        )
        assert isinstance(err, skills._InstallError)
        assert err.reason == "copy_failed"
        message = err.format_message()
        assert "/abs/home" not in message
        assert ".agents/skills/developing-with-streamlit" in message


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
        assert f"{unrelated_dir}/my-skill/" in result


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
        ("symlinks_supported", "install_skill_symlink_return"),
        [
            (False, True),
            (True, False),
        ],
        ids=["symlinks_unsupported_globally", "individual_symlink_failed"],
    )
    def test_raises_clickexception_without_fallback(
        self,
        tmp_path: Path,
        mock_source_skills_dir: Path,
        symlinks_supported: bool,
        install_skill_symlink_return: bool,
    ) -> None:
        """Raises ClickException when symlinks are unavailable and fallback disabled."""
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        with (
            patch.object(
                skills, "_get_source_skills_dir", return_value=mock_source_skills_dir
            ),
            patch.object(
                skills, "_symlinks_supported", return_value=symlinks_supported
            ),
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
            (click.ClickException("global install failed"), "global install failed"),
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
            patch.object(skills, "_symlinks_supported", return_value=True),
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


class TestInstallSkillCopyTempCleanup:
    """Tests for temp file cleanup paths in _install_skill_copy."""

    def test_removes_leftover_temp_before_copying(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Removes leftover temp directory from a previous failed copy."""
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        # Existing target directory with different content forces use of the
        # temp-swap path.
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / "stale-file.txt").write_text("old", encoding="utf-8")

        # Leftover temp directory from a previous failed run.
        leftover_temp = target_dir / ".developing-with-streamlit.tmp"
        leftover_temp.mkdir()
        (leftover_temp / "leftover.txt").write_text("leftover", encoding="utf-8")

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
        # New target must replace the old one and contain only the source content.
        assert (target / "SKILL.md").is_file()
        assert not (target / "stale-file.txt").exists()
        # Temp directory must be cleaned up after the swap.
        assert not leftover_temp.exists()
