#!/usr/bin/env python
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

"""Update e2e snapshots from a failed Playwright run.

`make update-snapshots` waits until the run for the current commit fails, then
downloads it. CI passes ``--run-id`` so it downloads a finished run directly.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from typing import Any, cast

import requests

SNAPSHOT_UPDATE_FOLDER = "snapshot-updates"
GITHUB_OWNER = "streamlit"
GITHUB_REPO = "streamlit"
GITHUB_WORKFLOW_FILE_NAME = "playwright.yml"
GITHUB_WORKFLOW_FILE_NAME_CHANGED_FILES = "playwright-changed-files.yml"
PLAYWRIGHT_RESULT_ARTIFACT_NAME_PREFIX = "playwright_test_results_"
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def get_token_from_credential_manager() -> str:
    """Get the GitHub token from the git credential manager.
    The token can also be provided via the --token argument.
    """
    cmd = ["git", "credential", "fill"]
    input_data = "protocol=https\nhost=github.com\n\n"
    result = subprocess.run(
        cmd, input=input_data, capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        print(
            f"Error getting credentials from git credential manager: {result.stderr.strip()}"
        )
        return ""
    output = result.stdout
    # Parse the output to get the token
    for line in output.splitlines():
        if line.startswith("password="):
            return line[len("password=") :]
    return ""


def get_last_commit_sha(repo_root: str) -> str:
    """Get the HEAD SHA of a repository checkout."""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise Exception(f"Error getting last commit SHA: {result.stderr.strip()}")
    return result.stdout.strip()


def snapshots_dir_for(repo_root: str) -> str:
    """Directory of committed e2e snapshots inside a checkout."""
    return os.path.join(repo_root, "e2e_playwright", "__snapshots__")


def artifact_name_for_commit(commit_sha: str) -> str:
    """Artifact name Playwright uploads for a pull request head SHA.

    Must match the ``playwright_test_results_<short sha>`` upload in
    ``.github/workflows/playwright.yml``, which uses the first 6 characters of
    the pull request head SHA.
    """
    return f"{PLAYWRIGHT_RESULT_ARTIFACT_NAME_PREFIX}{commit_sha[:6]}"


def select_snapshot_artifact(
    artifacts: list[dict[str, Any]], commit_sha: str
) -> dict[str, Any] | None:
    """Pick the newest Playwright result artifact for this commit."""
    expected_name = artifact_name_for_commit(commit_sha)
    matches = [artifact for artifact in artifacts if artifact["name"] == expected_name]
    if not matches:
        print(
            f"Artifact '{expected_name}' not found. "
            f"Available artifacts: {[artifact['name'] for artifact in artifacts]}"
        )
        return None
    # A re-run can leave more than one artifact with the same name.
    matches.sort(key=lambda artifact: artifact.get("created_at") or "", reverse=True)
    return matches[0]


def get_latest_workflow_run(
    owner: str, repo: str, workflow_file_name: str, commit_sha: str, token: str
) -> dict[str, Any]:
    """Get the latest workflow run for a given workflow file name and commit SHA."""
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_file_name}/runs"
    params = {"head_sha": commit_sha}
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"token {token}",
    }
    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        raise Exception(
            f"Error getting workflow runs: {response.status_code} {response.text}"
        )
    data = response.json()
    runs = data.get("workflow_runs", [])
    if not runs:
        print(
            f"No workflow runs found for {workflow_file_name} with head SHA {commit_sha}"
        )
        sys.exit(1)
    # Assuming the latest one is the first in the list
    return runs[0]  # type: ignore


def wait_for_workflow_completion(
    owner: str, repo: str, workflow_file_name: str, commit_sha: str, token: str
) -> dict[str, Any]:
    """Wait for the workflow to complete, checking every few seconds."""
    while True:
        workflow_run = get_latest_workflow_run(
            owner, repo, workflow_file_name, commit_sha, token
        )
        status = workflow_run.get("status")
        conclusion = workflow_run.get("conclusion")

        if status == "completed":
            if conclusion == "failure":
                # Only failed runs are expected to have updated snapshots.
                return workflow_run
            print(
                f"The latest workflow run completed with status: {conclusion}. "
                "The snapshot update is only working on failed runs."
            )
            sys.exit(1)
        print(
            f"Workflow is still {status}. Waiting 60 seconds before checking again..."
        )
        time.sleep(60)


def get_artifacts(
    owner: str, repo: str, run_id: int, token: str
) -> list[dict[str, Any]]:
    """Get the artifacts for a given workflow run ID."""
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"token {token}",
    }
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(
            f"Error getting artifacts: {response.status_code} {response.text}"
        )
    data = response.json()
    return cast("list[dict[str, Any]]", data.get("artifacts", []))


def download_artifact(artifact_url: str, token: str, download_path: str) -> None:
    """Download an artifact from a given URL."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"token {token}",
    }
    response = requests.get(artifact_url, headers=headers, stream=True)
    if response.status_code != 200:
        raise Exception(
            f"Error downloading artifact: {response.status_code} {response.text}"
        )

    with open(download_path, "wb") as f:
        f.writelines(response.iter_content(chunk_size=8192))


def extract_and_merge_snapshots(zip_path: str, destination_folder: str) -> bool:
    """Extract and merge the 'snapshot-updates/' folder from an artifact into the destination folder.

    Returns False when the artifact has no snapshot updates, which happens when
    Playwright failed for a reason other than a snapshot mismatch.
    """
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        namelist = zip_ref.namelist()
        snapshot_files = [
            name for name in namelist if name.startswith(SNAPSHOT_UPDATE_FOLDER)
        ]
        if not snapshot_files:
            print(f"'{SNAPSHOT_UPDATE_FOLDER}' folder not found in the artifact.")
            return False
        # Extract the 'snapshot-updates/' folder to a temp directory
        temp_extract_dir = tempfile.mkdtemp()
        for file in snapshot_files:
            zip_ref.extract(file, temp_extract_dir)
        # Merge the extracted files into the destination folder
        source_folder = os.path.join(temp_extract_dir, SNAPSHOT_UPDATE_FOLDER)
        if not os.path.exists(destination_folder):
            os.makedirs(destination_folder)
        copy_tree(source_folder, destination_folder)
        # Clean up temp directory
        shutil.rmtree(temp_extract_dir)
        return True


def copy_tree(src: str, dst: str) -> None:
    """Copy a directory tree from src to dst."""
    for root, _, files in os.walk(src):
        rel_path = os.path.relpath(root, src)
        dest_dir = os.path.join(dst, rel_path)
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)
        for file in files:
            src_file = os.path.join(root, file)
            dst_file = os.path.join(dest_dir, file)
            shutil.copy2(src_file, dst_file)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download GitHub Action Artifact")
    parser.add_argument(
        "--token",
        required=False,
        help="GitHub Personal Access Token (only requires the repo/public_repo scope)",
    )
    parser.add_argument(
        "--changed",
        action="store_true",
        help="Only update snapshots for changed files",
    )
    parser.add_argument(
        "--run-id",
        type=int,
        required=False,
        help=(
            "Download snapshots from this finished workflow run instead of "
            "waiting for one. Used by CI."
        ),
    )
    parser.add_argument(
        "--repo-root",
        required=False,
        help="Checkout whose snapshots should be updated. Defaults to this repo.",
    )
    args = parser.parse_args()
    if args.run_id is not None and args.changed:
        print("--run-id cannot be combined with --changed.")
        sys.exit(1)
    repo_root = os.path.abspath(args.repo_root) if args.repo_root else BASE_DIR
    if not os.path.isdir(repo_root):
        print(f"Repository root does not exist: {repo_root}")
        sys.exit(1)
    token: str | None = args.token

    if not token:
        print(
            "GitHub token not provided via argument. Attempting to retrieve it from the Git credential manager..."
        )
        token = get_token_from_credential_manager()
        if not token:
            # Add interactive prompt for token
            try:
                token = input(
                    "Please enter your GitHub Personal Access Token (only requires the repo/public_repo scope): "
                ).strip()
            except (KeyboardInterrupt, EOFError):
                token = None

            if not token:
                print(
                    "GitHub token is required. Please provide it via --token or configure your git credential manager."
                )
                sys.exit(1)
        else:
            print("Token retrieved from git credential manager.")
    token = str(token)

    if args.run_id is None:
        print("Retrieving latest workflow run...")

    try:
        commit_sha = get_last_commit_sha(repo_root)
        snapshots_dir = snapshots_dir_for(repo_root)
        print(f"Current head SHA: {commit_sha}")
        print(f"Expected artifact name: {artifact_name_for_commit(commit_sha)}")

        if args.run_id is not None:
            # The caller already picked a finished run. Polling would treat
            # "Playwright has not started" as a hard failure.
            run_id = args.run_id
            print(f"Using workflow run ID: {run_id}")
        else:
            # Wait for the workflow to complete with status 'failure'.
            workflow_file_name = (
                GITHUB_WORKFLOW_FILE_NAME_CHANGED_FILES
                if args.changed
                else GITHUB_WORKFLOW_FILE_NAME
            )
            workflow_run = wait_for_workflow_completion(
                GITHUB_OWNER, GITHUB_REPO, workflow_file_name, commit_sha, token
            )
            run_id = workflow_run["id"]
            print(f"Found completed workflow run with ID: {run_id}")

        # Get artifacts for this run
        artifacts = get_artifacts(GITHUB_OWNER, GITHUB_REPO, run_id, token)
        if not artifacts:
            print(f"No artifacts found for workflow run with ID {run_id}")
        artifact = (
            select_snapshot_artifact(artifacts, commit_sha) if artifacts else None
        )
        if artifact is None:
            # CI passes --run-id. A missing results artifact means Playwright
            # failed before it could upload snapshots. Exit 10 so the workflow
            # leaves the label in place instead of posting a failure comment.
            # API errors raise above and stay real failures. Local runs still
            # exit 1.
            if args.run_id is not None:
                print("SNAPSHOT_RESULT=no-snapshot-updates")
                sys.exit(10)
            sys.exit(1)

        artifact_id = artifact["id"]
        print(f"Found artifact ID: {artifact_id}")

        # Download the artifact
        download_url = artifact["archive_download_url"]
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, "artifact.zip")
            print(f"Downloading artifact to {zip_path}")
            download_artifact(download_url, token, zip_path)

            # Extract and merge 'snapshot-updates' folder
            print(
                f"Extracting '{SNAPSHOT_UPDATE_FOLDER}' and merging into {snapshots_dir}"
            )
            # 10, plus the marker: the run failed, but not because snapshots
            # differed. 2 is argparse/uv's usage-error code, so CI cannot use it
            # to mean "nothing to update."
            if not extract_and_merge_snapshots(zip_path, snapshots_dir):
                print("SNAPSHOT_RESULT=no-snapshot-updates")
                sys.exit(10)

        print("Artifact downloaded and snapshots merged successfully.")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
