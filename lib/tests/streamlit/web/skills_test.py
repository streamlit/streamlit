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
            )

        assert success
        assert target.is_symlink()
        assert ".agents/skills/developing-with-streamlit" in result.installed


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
            )

        target = target_dir / "developing-with-streamlit"
        assert target.is_dir()
        assert (target / "SKILL.md").is_file()
        assert (target / ".streamlit-skills").is_file()
        assert len(result.installed) == 1

    def test_reports_up_to_date_for_matching_streamlit_owned_directory(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Reports up to date when a managed copied skill matches source."""
        target_dir = tmp_path / "target" / "skills"
        target = target_dir / "developing-with-streamlit"
        target.mkdir(parents=True)
        (target / "SKILL.md").write_text("# Test Skill\n", encoding="utf-8")
        (target / ".streamlit-skills").write_text("", encoding="utf-8")

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
            )

        assert len(result.installed) == 0
        assert len(result.up_to_date) == 1

    def test_skips_existing_user_directory(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Skips and reports conflict for existing user directory."""
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
            )

        assert any("existing file or directory" in s for s in result.skipped)
        assert (target / "user-file.txt").is_file()

    def test_replaces_streamlit_owned_directory(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Replaces directories marked as Streamlit-owned."""
        target_dir = tmp_path / "target" / "skills"
        target_dir.mkdir(parents=True)
        target = target_dir / "developing-with-streamlit"
        target.mkdir()
        (target / ".streamlit-skills").write_text("", encoding="utf-8")
        (target / "old-file.txt").write_text("old content", encoding="utf-8")

        result = skills._InstallResult()
        with patch("pathlib.Path.home", return_value=tmp_path):
            skills._install_skill_copy(
                "developing-with-streamlit",
                mock_source_skills_dir,
                target_dir,
                result,
            )

        assert len(result.installed) == 1
        assert (target / "SKILL.md").is_file()
        assert not (target / "old-file.txt").exists()


class TestIsStreamlitOwnedSymlink:
    """Tests for _is_streamlit_owned_symlink."""

    def test_returns_true_for_symlink_to_source_dir(
        self, tmp_path: Path, mock_source_skills_dir: Path
    ) -> None:
        """Returns True for symlinks resolving to the source skills dir."""
        _skip_if_symlinks_not_supported(tmp_path)
        link = tmp_path / "link"
        target = mock_source_skills_dir / "developing-with-streamlit"
        link.symlink_to(target)

        assert skills._is_streamlit_owned_symlink(link, mock_source_skills_dir)

    def test_returns_true_for_agents_skills_pattern_in_target(
        self, tmp_path: Path
    ) -> None:
        """Returns True when raw target contains .agents/skills/<skill-name>."""
        _skip_if_symlinks_not_supported(tmp_path)
        link = tmp_path / "developing-with-streamlit"
        link.symlink_to("../../old-env/.agents/skills/developing-with-streamlit")

        # Use a different source dir to test pattern matching
        other_source = tmp_path / "other"
        other_source.mkdir()

        assert skills._is_streamlit_owned_symlink(link, other_source)

    def test_returns_false_for_unrelated_symlink(self, tmp_path: Path) -> None:
        """Returns False for symlinks pointing elsewhere."""
        _skip_if_symlinks_not_supported(tmp_path)
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


class TestIsStreamlitOwnedDirectory:
    """Tests for _is_streamlit_owned_directory."""

    def test_returns_true_for_directory_with_marker(self, tmp_path: Path) -> None:
        """Returns True for directories containing .streamlit-skills marker."""
        target = tmp_path / "skill"
        target.mkdir()
        (target / ".streamlit-skills").write_text("", encoding="utf-8")

        assert skills._is_streamlit_owned_directory(target)

    @pytest.mark.parametrize(
        "setup",
        ["dir_no_marker", "regular_file"],
        ids=["directory-without-marker", "non-directory"],
    )
    def test_returns_false_for_non_owned_paths(
        self, tmp_path: Path, setup: str
    ) -> None:
        """Returns False for directories without marker or regular files."""
        target = tmp_path / "target"
        if setup == "dir_no_marker":
            target.mkdir()
        else:
            target.write_text("content", encoding="utf-8")

        assert not skills._is_streamlit_owned_directory(target)


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
                skills,
                "_download_global_skill",
                return_value=mock_source_skills_dir / "developing-with-streamlit",
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
                skills,
                "_download_global_skill",
                return_value=mock_source_skills_dir / "developing-with-streamlit",
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
                skills,
                "_download_global_skill",
                return_value=mock_source_skills_dir / "developing-with-streamlit",
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
        assert "No skills were installed due to conflicts" in result.output


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

        assert result.exit_code == 0
        assert "Installation cancelled" in result.output
        assert not (
            project_dir / ".agents" / "skills" / "developing-with-streamlit"
        ).exists()
