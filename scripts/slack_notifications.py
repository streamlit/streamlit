#!/usr/bin/env python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Send slack notifications."""

from __future__ import annotations

import os
import sys

import requests


def _build_patch_cherry_pick_text(
    *,
    repo: str,
    release_version: str,
    commit_sha: str,
    release_branch: str,
    run_id: str | None,
    header: str,
    error_reason: str | None = None,
) -> str:
    """Build the text for a patch cherry-pick notification."""

    lines = [
        header,
        f"- Version: {release_version}" if release_version else None,
        (
            f"- Commit: https://github.com/{repo}/commit/{commit_sha}"
            if repo and commit_sha
            else None
        ),
        (
            f"- Branch: https://github.com/{repo}/tree/{release_branch}"
            if repo and release_branch
            else None
        ),
        (
            f"- Run: https://github.com/{repo}/actions/runs/{run_id}"
            if repo and run_id
            else None
        ),
        (f"- Note: {error_reason}" if error_reason else None),
    ]
    return "\n".join([ln for ln in lines if ln])


def send_notification() -> None:
    """Create a slack message."""

    webhook = os.getenv("SLACK_WEBHOOK")

    if not webhook:
        raise Exception("Unable to retrieve SLACK_WEBHOOK")

    nightly_slack_messages = {
        "tag": "to create a tag",
        "python": "on python tests",
        "js": "on javascript tests",
        "py_prod": "on python prod dependencies test",
        "playwright": "on playwright tests",
        "build": "to release",
    }

    run_id = os.getenv("RUN_ID")
    workflow = sys.argv[1]
    message_key = sys.argv[2]
    payload = None

    if workflow == "nightly":
        failure = nightly_slack_messages[message_key]
        payload = {
            "text": f":blobonfire: Nightly build failed {failure} - "
            f"<https://github.com/streamlit/streamlit/actions/runs/{run_id}|Link to run>"
        }

    if workflow == "candidate":
        if message_key == "success":
            payload = {"text": ":rocket: Release Candidate was successful!"}
        else:
            payload = {
                "text": ":blobonfire: Release Candidate failed - "
                f"<https://github.com/streamlit/streamlit/actions/runs/{run_id}|Link to run>"
            }

    if workflow == "release":
        if message_key == "success":
            payload = {"text": ":rocket: Release was successful!"}
        else:
            payload = {
                "text": ":blobonfire: Release failed - "
                f"<https://github.com/streamlit/streamlit/actions/runs/{run_id}|Link to run>"
            }

    if workflow == "assets":
        if message_key == "new_icons":
            payload = {
                "text": ":symbols: New Material Symbols available. Please run `make update-material-icons` "
                "to update the material icons."
            }

        if message_key == "new_emojis":
            payload = {
                "text": ":symbols: New emojis available. Please run `./scripts/update_emojis.py` "
                "to update the emojis."
            }

    # OSS Release automation notifications
    if workflow == "release_automation":
        repo = os.getenv("REPO", os.getenv("GITHUB_REPOSITORY", ""))
        release_version = os.getenv("RELEASE_VERSION", "")
        release_branch = os.getenv("RELEASE_BRANCH", "")
        commit_sha = os.getenv("CHERRY_PICK_SHA", "")

        if message_key == "branch_created":
            nightly_tag = os.getenv("NIGHTLY_TAG", "")
            lines = [
                ":evergreen_tree: Release branch created",
                f"- Version: {release_version}" if release_version else None,
                (
                    f"- Branch: https://github.com/{repo}/tree/{release_branch}"
                    if repo and release_branch
                    else None
                ),
                f"- Based on nightly: {nightly_tag}" if nightly_tag else None,
                (
                    f"- Run: https://github.com/{repo}/actions/runs/{run_id}"
                    if repo and run_id
                    else None
                ),
            ]
            text = "\n".join([ln for ln in lines if ln])
            payload = {"text": text}

        elif message_key == "tag_pr_created":
            pr_url = os.getenv("PR_URL", "")
            tag_url = (
                f"https://github.com/{repo}/tree/{release_version}"
                if repo and release_version
                else ""
            )
            lines = [
                ":label: Release tag and PR created",
                f"- Version: {release_version}" if release_version else None,
                f"- Tag: {tag_url}" if tag_url else None,
                f"- PR: {pr_url}" if pr_url else None,
                (
                    f"- Run: https://github.com/{repo}/actions/runs/{run_id}"
                    if repo and run_id
                    else None
                ),
            ]
            text = "\n".join([ln for ln in lines if ln])
            payload = {"text": text}

        # OSS patch cherry-pick notifications
        elif message_key == "cherry_pick_to_release_branch_success":
            text = _build_patch_cherry_pick_text(
                repo=repo,
                release_version=release_version,
                commit_sha=commit_sha,
                release_branch=release_branch,
                run_id=run_id,
                header=":cherries: Cherry-pick succeeded",
            )
            payload = {"text": text}

        elif message_key == "cherry_pick_to_release_branch_failed":
            error_reason = os.getenv("ERROR_REASON", "")
            text = _build_patch_cherry_pick_text(
                repo=repo,
                release_version=release_version,
                commit_sha=commit_sha,
                release_branch=release_branch,
                run_id=run_id,
                header=":x: Cherry-pick failed",
                error_reason=error_reason or None,
            )
            payload = {"text": text}

    if payload:
        response = requests.post(webhook, json=payload)

        if response.status_code != 200:
            raise Exception(
                f"Unable to send slack message, HTTP response: {response.text}"
            )


def main() -> None:
    send_notification()


if __name__ == "__main__":
    main()
