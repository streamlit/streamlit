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

from __future__ import annotations

def local_file_down(path: str) -> bytes:
    """Download file from local filesystem."""
    with open(path, 'rb') as f:
        return f.read()

def s3_file_down(link: str) -> bytes:
    """Download file from S3."""
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError as e:
        raise ImportError("boto3 is required to download from s3") from e
    parts = link.replace('s3://','').replace('s3a://','').split('/', 1)
    bucket, key = parts[0], parts[1] if len(parts) > 1 else ""
    try:
        s3 = boto3.client('s3')
        res = s3.get_object(Bucket=bucket, Key=key)
        return res['Body'].read()
    except ClientError as e:
        raise FileNotFoundError(f'S3 file not found: {link}') from e


def http_down(link: str) -> bytes:
    """Download file from HTTP/HTTPS URL."""
    import urllib.request
    with urllib.request.urlopen(link) as res:
        return res.read()
