# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Generate default public S3 policy."""

# Copyright 2018 Streamlit Inc. All rights reserved.

import sys

from textwrap import dedent


POLICY = dedent(
    """{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::%(bucket)s",
            "Condition": {
                "StringEquals": {
                    "s3:prefix": "",
                    "s3:delimiter": "/"
                }
            }
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::%(bucket)s",
            "Condition": {
                "StringNotLike": {
                    "s3:prefix": [
                        "*/reports",
                        "*/reports/"
                    ]
                }
            }
        },
        {
            "Sid": "VisualEditor2",
            "Effect": "Allow",
            "Action": "s3:PutObjectAcl",
            "Resource": [
                "arn:aws:s3:::%(bucket)s",
                "arn:aws:s3:::%(bucket)s/*"
            ]
        },
        {
            "Sid": "VisualEditor3",
            "Effect": "Allow",
            "Action": "s3:PutObject",
            "Resource": [
                "arn:aws:s3:::%(bucket)s/*/*.json",
                "arn:aws:s3:::%(bucket)s/*/*.js",
                "arn:aws:s3:::%(bucket)s/*/*.html",
                "arn:aws:s3:::%(bucket)s/*/*.ico",
                "arn:aws:s3:::%(bucket)s/*/*.svg",
                "arn:aws:s3:::%(bucket)s/*/emoji/*.png",
                "arn:aws:s3:::%(bucket)s/*/fonts/*.css",
                "arn:aws:s3:::%(bucket)s/*/fonts/*/*.txt",
                "arn:aws:s3:::%(bucket)s/*/fonts/*/*.ttf",
                "arn:aws:s3:::%(bucket)s/*/static/css/*.css",
                "arn:aws:s3:::%(bucket)s/*/static/js/*.js",
                "arn:aws:s3:::%(bucket)s/*/reports/*/manifest.json",
                "arn:aws:s3:::%(bucket)s/*/reports/*/*.delta"
            ]
        }
    ]
}"""
)
