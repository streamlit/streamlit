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
            print("PATH")
            print(self.module)
        except:
            self.repo = None

    def is_valid(self):
        return self.repo is not None

    def get_tracking_branch(self):
        return self.repo.active_branch.tracking_branch()

    def get_tracking_branch_remote(self):
        tracking_branch = self.get_tracking_branch()
        if tracking_branch is None:
            return None

        tracking_branch_name = tracking_branch.name.split("/")

        return self.repo.remote(tracking_branch_name[0])

    def is_github_repo(self):
        if not self.is_valid():
            return False

        remote = self.get_tracking_branch_remote()
        if remote is None:
            return False

        for url in remote.urls:
            if (
                re.match(GITHUB_HTTP_URL, url) is not None
                or re.match(GITHUB_SSH_URL, url) is not None
            ):
                return True

        return False

    def is_public_repo(self):
        if not self.is_valid():
            return False

    def get_repo_info(self):
        if not self.is_valid():
            return None

        tracking_branch = self.get_tracking_branch()
        if tracking_branch is None:
            return None

        remote_name, *branch = tracking_branch.name.split("/")
        branch_name = "/".join(branch)
        remote = self.repo.remote(remote_name)
        if remote is None:
            return None

        repo = None
        for url in remote.urls:
            https_matches = re.match(GITHUB_HTTP_URL, url)
            ssh_matches = re.match(GITHUB_SSH_URL, url)
            if https_matches is not None:
                repo = f"{https_matches.group(2)}/{https_matches.group(3)}"

            if ssh_matches is not None:
                repo = f"{ssh_matches.group(1)}/{ssh_matches.group(2)}"

        if repo is None:
            return None

        return repo, branch_name, self.module
