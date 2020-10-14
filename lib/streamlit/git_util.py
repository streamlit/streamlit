import git  # type: ignore[import]
import os
import re

# Github has two URLs, one that is https and one that is ssh
GITHUB_HTTP_URL = r"^https://(www\.)?github.com/(.+)/(.+).git$"
GITHUB_SSH_URL = r"^git@github.com:(.+)/(.+).git$"


class GitRepo:
    def __init__(self, path):
        try:
            self.repo = git.Repo(path, search_parent_directories=True)
            git_root = self.repo.git.rev_parse("--show-toplevel")
            self.module = os.path.relpath(path, git_root)
        except:
            # The git repo must be invalid for the following reasons:
            #  * No .git folder
            #  * Corrupted .git folder
            #  * Path is invalid
            self.repo = None

    def is_valid(self):
        return self.repo is not None

    @property
    def tracking_branch(self):
        return self.repo.active_branch.tracking_branch()

    def get_tracking_branch_remote(self):
        tracking_branch = self.tracking_branch
        if tracking_branch is None:
            return None

        remote_name, *branch = tracking_branch.name.split("/")
        branch_name = "/".join(branch)

        return self.repo.remote(remote_name), branch_name

    def is_github_repo(self):
        if not self.is_valid():
            return False

        remote_info = self.get_tracking_branch_remote()
        if remote_info is None:
            return None

        remote, _branch = remote_info

        for url in remote.urls:
            if (
                re.match(GITHUB_HTTP_URL, url) is not None
                or re.match(GITHUB_SSH_URL, url) is not None
            ):
                return True

        return False

    def get_repo_info(self):
        if not self.is_valid():
            return None

        remote_info = self.get_tracking_branch_remote()
        if remote_info is None:
            return None

        remote, branch = remote_info

        repo = None
        for url in remote.urls:
            https_matches = re.match(GITHUB_HTTP_URL, url)
            ssh_matches = re.match(GITHUB_SSH_URL, url)
            if https_matches is not None:
                repo = f"{https_matches.group(2)}/{https_matches.group(3)}"
                break

            if ssh_matches is not None:
                repo = f"{ssh_matches.group(1)}/{ssh_matches.group(2)}"
                break

        if repo is None:
            return None

        return repo, branch, self.module
