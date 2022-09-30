#!/usr/bin/env python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""Send slack notifications"""
import json
import os
import requests
import sys


def send_notification():
    """Create a slack message"""

    webhook = os.getenv("SLACK_WEBHOOK")

    if not webhook:
        raise Exception("Unable to retrieve SLACK_WEBHOOK")

    nightly_slack_messages = {
        "tag": "to create a tag",
        "python": "on python tests",
        "js": "on javascript tests",
        "py_prod": "on python prod dependencies test",
        "cypress": "on cypress tests",
        "build": "to release",
    }

    workflow = sys.argv[1]
    message_key = sys.argv[2]

    if workflow == "nightly":
        failure = nightly_slack_messages[message_key]
        message = {"text": ":blobonfire: Nightly build failed %s" % failure}

    if workflow == "candidate":
        if message_key == "success":
            message = {"text": ":rocket: Release Candidate was successful!"}
        else:
            message = {"text": ":blobonfire: Release Candidate failed"}

    payload = json.dumps(message)

    response = requests.post(webhook, payload)

    if response.status_code != 200:
        raise Exception(
            "Unable to send slack message, HTTP response: %s" % response.text
        )


def main():
    """Run main loop."""

    send_notification()


if __name__ == "__main__":
    main()
