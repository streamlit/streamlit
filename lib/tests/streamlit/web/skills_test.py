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

import pytest
from click.testing import CliRunner

from streamlit.web import cli, skills

if TYPE_CHECKING:
    from pathlib import Path


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

    def test_excludes_finding_streamlit_skills(self, tmp_path: Path) -> None:
        """Excludes the meta skill 'finding-streamlit-skills' from project installs."""
        meta_skill = tmp_path / "finding-streamlit-skills"
        meta_skill.mkdir()
        (meta_skill / "SKILL.md").write_text("# Meta\n", encoding="utf-8")

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


class TestFindProjectRoot:
    """Tests for _find_project_root."""

    def test_uses_cwd_when_agents_exists(self, tmp_path: Path) -> None:
        """Uses cwd when .agents directory exists."""
        (tmp_path / ".agents").mkdir()
        with patch("pathlib.Path.cwd", return_value=tmp_path):
            result = skills._find_project_root()
        assert result == tmp_path

    def test_uses_cwd_when_claude_exists(self, tmp_path: Path) -> None:
        """Uses cwd when .claude directory exists."""
        (tmp_path / ".claude").mkdir()
        with patch("pathlib.Path.cwd", return_value=tmp_path):
            result = skills._find_project_root()
        assert result == tmp_path

    def test_finds_git_root(self, tmp_path: Path) -> None:
        """Walks up to find the nearest .git directory."""
        (tmp_path / ".git").mkdir()
        subdir = tmp_path / "sub" / "dir"
        subdir.mkdir(parents=True)

        with patch("pathlib.Path.cwd", return_value=subdir):
            result = skills._find_project_root()
        assert result == tmp_path

    def test_uses_cwd_when_no_git_found(self, tmp_path: Path) -> None:
        """Falls back to cwd when no .git is found."""
        subdir = tmp_path / "sub" / "dir"
        subdir.mkdir(parents=True)

        with patch("pathlib.Path.cwd", return_value=subdir):
            result = skills._find_project_root()
        assert result == subdir

    def test_prefers_local_agents_over_git_root(self, tmp_path: Path) -> None:
        """Prefers cwd with .agents over parent git root."""
        (tmp_path / ".git").mkdir()
        subdir = tmp_path / "sub"
        subdir.mkdir()
        (subdir / ".agents").mkdir()

        with patch("pathlib.Path.cwd", return_value=subdir):
            result = skills._find_project_root()
        assert result == subdir


class TestGetTargetDirs:
    """Tests for _get_target_dirs."""

    def test_always_includes_agents_skills(self, tmp_path: Path) -> None:
        """Always includes .agents/skills/ in targets."""
        with patch("pathlib.Path.home", return_value=tmp_path / "home"):
            result = skills._get_target_dirs(tmp_path)
        assert tmp_path / ".agents" / "skills" in result

    def test_includes_claude_skills_when_claude_home_exists(
        self, tmp_path: Path
    ) -> None:
        """Includes .claude/skills/ when ~/.claude exists."""
        home = tmp_path / "home"
        (home / ".claude").mkdir(parents=True)

        with patch("pathlib.Path.home", return_value=home):
            result = skills._get_target_dirs(tmp_path)

        assert tmp_path / ".claude" / "skills" in result

    def test_excludes_claude_skills_when_claude_home_missing(
        self, tmp_path: Path
    ) -> None:
        """Excludes .claude/skills/ when ~/.claude doesn't exist."""
        home = tmp_path / "home"
        home.mkdir(parents=True)

        with patch("pathlib.Path.home", return_value=home):
            result = skills._get_target_dirs(tmp_path)

        assert tmp_path / ".claude" / "skills" not in result


class TestInstallSkill:
    """Tests for _install_skill."""

    def test_creates_symlink(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Creates a symlink to the source skill directory."""
        target_dir = tmp_path / "project" / ".agents" / "skills"
        result = skills._InstallResult()

        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            skills._install_skill(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
            )

        target = target_dir / "developing-with-streamlit"
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
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        source = mock_source_skills_dir / "developing-with-streamlit"
        target.symlink_to(os.path.relpath(source, target.parent))

        result = skills._InstallResult()
        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            skills._install_skill(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
            )

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
            skills._install_skill(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
            )

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
            skills._install_skill(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
            )

        assert any("existing file or directory" in s for s in result.skipped)
        assert len(result.installed) == 0

    def test_replaces_broken_streamlit_owned_symlink(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Replaces broken symlinks that appear to be Streamlit-owned."""
        target_dir = tmp_path / "project" / ".agents" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        # Create a broken symlink pointing to a Streamlit-like path
        target.symlink_to("../../old-env/.agents/skills/developing-with-streamlit")

        result = skills._InstallResult()
        with patch("pathlib.Path.cwd", return_value=tmp_path / "project"):
            skills._install_skill(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
            )

        assert target.is_symlink()
        assert ".agents/skills/developing-with-streamlit" in result.installed


class TestIsStreamlitOwnedSymlink:
    """Tests for _is_streamlit_owned_symlink."""

    def test_returns_true_for_symlink_to_source_dir(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Returns True for symlinks resolving to the source skills dir."""
        link = tmp_path / "link"
        target = mock_source_skills_dir / "developing-with-streamlit"
        link.symlink_to(target)

        assert skills._is_streamlit_owned_symlink(link, mock_source_skills_dir)

    def test_returns_true_for_agents_skills_pattern_in_target(
        self, tmp_path: Path
    ) -> None:
        """Returns True when raw target contains .agents/skills/<skill-name>."""
        link = tmp_path / "developing-with-streamlit"
        link.symlink_to("../../old-env/.agents/skills/developing-with-streamlit")

        # Use a different source dir to test pattern matching
        other_source = tmp_path / "other"
        other_source.mkdir()

        assert skills._is_streamlit_owned_symlink(link, other_source)

    def test_returns_false_for_unrelated_symlink(self, tmp_path: Path) -> None:
        """Returns False for symlinks pointing elsewhere."""
        link = tmp_path / "link"
        target = tmp_path / "unrelated"
        target.mkdir()
        link.symlink_to(target)

        source = tmp_path / "source"
        source.mkdir()

        assert not skills._is_streamlit_owned_symlink(link, source)

    def test_returns_false_for_non_symlink(self, tmp_path: Path) -> None:
        """Returns False for regular files."""
        regular_file = tmp_path / "file.txt"
        regular_file.write_text("content", encoding="utf-8")

        source = tmp_path / "source"
        source.mkdir()

        assert not skills._is_streamlit_owned_symlink(regular_file, source)


class TestInstallSkillsCli:
    """Integration tests for the `streamlit skills` CLI command."""

    def test_skills_command_exists(self, runner: CliRunner) -> None:
        """The 'skills' command is registered."""
        result = runner.invoke(cli.main, ["skills", "--help"])
        assert result.exit_code == 0
        assert "Install Streamlit AI-agent skills" in result.output

    def test_skills_yes_flag_skips_prompts(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """The --yes flag skips all confirmation prompts."""
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

    def test_skills_also_installs_to_claude_when_detected(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Also installs to .claude/skills/ when ~/.claude exists."""
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

    def test_skills_rerun_reports_up_to_date(
        self, runner: CliRunner, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Re-running the command reports skills as up to date."""
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
