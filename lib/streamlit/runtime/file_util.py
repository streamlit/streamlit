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
    """
    Read a file from the local filesystem.

    Parameters
    ----------
    path : str
        Path to the local file

    Returns
    -------
    bytes
        File content as bytes

    Raises
    ------
    FileNotFoundError
        File does not exist
    IOError
        File cannot be read
    """
    with open(path, "rb") as f:
        return f.read()


def s3_file_down(link: str) -> bytes:
    """
    Download file from S3.

    Parameters
    ----------
    link : str
        S3 URI as string

    Returns
    -------
    bytes
        The S3 content as bytes

    Raises
    ------
    ImportError
        If boto3 not installed
    ValueError
        If S3 URI is missing
    FileNotFound
        If S3 object not exist
    """
    try:
        from urllib.parse import urlparse

        import boto3
        from botocore.exceptions import ClientError
    except ImportError as e:
        raise ImportError("boto3 is missing") from e

    parsed = urlparse(link)
    bucket = parsed.netloc
    key = parsed.path.lstrip("/")

    if not key:
        raise ValueError("Invalid S3 link or no key specified")

    try:
        s3 = boto3.client("s3")
        res = s3.get_object(Bucket=bucket, Key=key)
        return res["Body"].read()
    except ClientError as e:
        raise FileNotFoundError(f"S3 file not found: {link}") from e


def http_down(link: str) -> bytes:
    """
    Download file from HTTP/HTTPS URL.

    Parameters
    ----------
    link : str
        http link of the file

    Returns
    -------
    bytes
        content of file as bytes

    Raises
    ------
    ValueError
        If the url is not http or https
    urllib.error.URLError
    If the url fails or timeouts
    """
    import urllib.request
    from urllib.parse import urlparse

    parsed = urlparse(link)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid url scheme: {parsed.scheme}")

    with urllib.request.urlopen(link, timeout=30) as res:  # noqa: S310
        return res.read()
