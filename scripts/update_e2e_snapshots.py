#!/usr/bin/env python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

"""Update e2e snapshots"""

import os
import sys
import subprocess
import requests
import tempfile
import shutil
import zipfile
import argparse
from typing import Any, Dict, List

SNAPSHOT_UPDATE_FOLDER = "snapshot-updates"
GITHUB_OWNER = "streamlit"
GITHUB_REPO = "streamlit"
GITHUB_WORKFLOW_FILE_NAME = "playwright.yml"
PLAYWRIGHT_RESULT_ARTIFACT_NAME = "playwright_test_results"


def get_token_from_credential_manager() -> str:
    cmd = ["git", "credential", "fill"]
    input_data = "protocol=https\nhost=github.com\n\n"
    result = subprocess.run(
        cmd, input=input_data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    if result.returncode != 0:
        print(
            f"Error getting credentials from git credential manager: {result.stderr.strip()}"
        )
        return ""
    output = result.stdout
    # Parse the output to get the password (token)
    for line in output.splitlines():
        if line.startswith("password="):
            return line[len("password=") :]
    return ""


def get_last_commit_sha() -> str:
    cmd = ["git", "rev-parse", "HEAD"]
    result = subprocess.run(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    if result.returncode != 0:
        raise Exception(f"Error getting last commit SHA: {result.stderr.strip()}")
    return result.stdout.strip()


def get_workflow_run(
    owner: str, repo: str, workflow_file_name: str, commit_sha: str, token: str
) -> Dict[str, Any]:
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_file_name}/runs"
    params = {"head_sha": commit_sha, "status": "completed"}
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
            f"No completed workflow runs found for {workflow_file_name} with head SHA {commit_sha}"
        )
        sys.exit(1)
    # Assuming the latest one is the first in the list
    return runs[0]  # type: ignore


def get_artifacts(
    owner: str, repo: str, run_id: int, token: str
) -> List[Dict[str, Any]]:
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
    artifacts = data.get("artifacts", [])
    return artifacts  # type: ignore


def download_artifact(artifact_url: str, token: str, download_path: str) -> None:
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
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)


def extract_and_merge_snapshots(zip_path: str, destination_folder: str) -> None:
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        namelist = zip_ref.namelist()
        snapshot_files = [
            name for name in namelist if name.startswith(SNAPSHOT_UPDATE_FOLDER)
        ]
        if not snapshot_files:
            print(f"'{SNAPSHOT_UPDATE_FOLDER}' folder not found in the artifact.")
            sys.exit(1)
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


def copy_tree(src: str, dst: str) -> None:
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
    parser.add_argument("--token", required=False, help="GitHub Personal Access Token")
    args = parser.parse_args()
    token = args.token

    if not token:
        print(
            "GitHub token not provided. Attempting to retrieve it from the Git credential manager..."
        )
        token = get_token_from_credential_manager()
        if not token:
            print(
                "GitHub token is required. Please provide it via --token or configure your git credential manager."
            )
            sys.exit(1)
        else:
            print("Token retrieved from git credential manager.")

    print("Updating e2e snapshots...")

    try:
        commit_sha = get_last_commit_sha()
        print(f"Current head SHA: {commit_sha}")

        # Get the latest completed workflow run for playwright.yml
        workflow_run = get_workflow_run(
            GITHUB_OWNER, GITHUB_REPO, GITHUB_WORKFLOW_FILE_NAME, commit_sha, token
        )
        run_id = workflow_run["id"]
        print(f"Found workflow run ID: {run_id}")

        # Get artifacts for this run
        artifacts = get_artifacts(GITHUB_OWNER, GITHUB_REPO, run_id, token)
        if not artifacts:
            print(f"No artifacts found for run ID {run_id}")
            sys.exit(1)
        # Find the correct artifact:
        artifact = next(
            (a for a in artifacts if a["name"] == PLAYWRIGHT_RESULT_ARTIFACT_NAME), None
        )
        if not artifact:
            print(
                f"Artifact '{PLAYWRIGHT_RESULT_ARTIFACT_NAME}' not found in run ID {run_id}"
            )
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
            destination_folder = os.path.join(
                os.getcwd(), "e2e_playwright", "__snapshots__"
            )
            print(
                f"Extracting '{SNAPSHOT_UPDATE_FOLDER}' and merging into {destination_folder}"
            )
            extract_and_merge_snapshots(zip_path, destination_folder)

        print("Artifact downloaded and snapshots merged successfully.")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
