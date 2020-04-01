# Copyright 2018-2020 Streamlit Inc.
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

"""A bunch of useful utilities for the watcher.

These are functions that only make sense within the watcher. In particular,
functions that use streamlit.config can go here to avoid a dependency cycle.
"""

import hashlib
import time


# How many times to try to grab the MD5 hash.
_MAX_RETRIES = 5

# How long to wait between retries.
_RETRY_WAIT_SECS = 0.1


def calc_md5_with_blocking_retries(file_path):
    """Calculate the MD5 checksum of the given file.

    IMPORTANT: This method calls time.sleep(), which blocks execution. So you
    should only use this outside the main thread.

    Parameters
    ----------
    file_path : str
        The path of the file to check.

    Returns
    -------
    str
        The MD5 checksum.

    """
    file_bytes = b""

    # There's a race condition where sometimes file_path no longer exists when
    # we try to read it (since the file is in the process of being written).
    # So here we retry a few times using this loop. See issue #186.
    for i in range(_MAX_RETRIES):
        try:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
                break
        except FileNotFoundError as e:
            if i >= _MAX_RETRIES - 1:
                raise e
            time.sleep(_RETRY_WAIT_SECS)

    md5 = hashlib.md5()
    md5.update(file_bytes)

    # Use hexdigest() instead of digest(), so it's easier to debug.
    return md5.hexdigest()
