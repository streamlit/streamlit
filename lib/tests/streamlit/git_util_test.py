import re
import unittest
from unittest.mock import patch

from git.exc import InvalidGitRepositoryError

from streamlit.git_util import GITHUB_HTTP_URL, GITHUB_SSH_URL, GitRepo


class GitUtilTest(unittest.TestCase):
    def test_https_url_check(self):
        # standard https url with and without .git
        self.assertTrue(
            re.search(GITHUB_HTTP_URL, "https://github.com/username/repo.git")
        )
        self.assertTrue(re.search(GITHUB_HTTP_URL, "https://github.com/username/repo"))

        # with www with and without .git
        self.assertTrue(
            re.search(GITHUB_HTTP_URL, "https://www.github.com/username/repo.git")
        )
        self.assertTrue(
            re.search(GITHUB_HTTP_URL, "https://www.github.com/username/repo")
        )

        # not http
        self.assertFalse(
            re.search(GITHUB_HTTP_URL, "http://www.github.com/username/repo.git")
        )

    def test_ssh_url_check(self):
        # standard ssh url
        self.assertTrue(re.search(GITHUB_SSH_URL, "git@github.com:username/repo.git"))

        # no .git
        self.assertTrue(re.search(GITHUB_SSH_URL, "git@github.com:username/repo"))

    def test_git_repo_invalid(self):
        with patch("git.Repo") as mock:
            mock.side_effect = InvalidGitRepositoryError("Not a git repo")
            repo = GitRepo(".")
            self.assertFalse(repo.is_valid())

    def test_old_git_version(self):
        """If the installed git is older than 2.7, certain repo operations
        prompt the user for credentials. We don't want to do this, so
        repo.is_valid() returns False for old gits.
        """
        with patch("git.repo.base.Repo.GitCommandWrapperType") as git_mock, patch(
            "streamlit.git_util.os"
        ):
            git_mock.return_value.version_info = (1, 6, 4)  # An old git version
            repo = GitRepo(".")
            self.assertFalse(repo.is_valid())
            self.assertEqual((1, 6, 4), repo.git_version)

    def test_git_repo_valid(self):
        with patch("git.repo.base.Repo.GitCommandWrapperType") as git_mock, patch(
            "streamlit.git_util.os"
        ):
            git_mock.return_value.version_info = (2, 20, 3)  # A recent git version
            repo = GitRepo(".")
            self.assertTrue(repo.is_valid())
            self.assertEqual((2, 20, 3), repo.git_version)

    def test_gitpython_not_installed(self):
        with patch.dict("sys.modules", {"git": None}):
            repo = GitRepo(".")
            self.assertFalse(repo.is_valid())
