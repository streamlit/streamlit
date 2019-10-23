# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

import tempfile
import shutil
import os

# We provide our own context managers for temporary file and directory
# that works in Windows as well.
# As documented in https://github.com/streamlit/streamlit/issues/301,
# Python `tempfile.NamedTemporaryFile` context manager does not behave
# as expected in Windows.


class TemporaryFile(object):
    """Temporary file context mananger.

    Create a temporary file that exists whithin the context manager scope.
    It returns the path to the file. The created file
    is closed and the user needs to open it to write/read.
    Wrapper on top of tempfile.mkstemp.

    Parameters
    ----------
    suffix : str or None
        Suffix to the filename.
    prefix : str or None
        Prefix to the filename.
    dir : str or None
        Enclosing directory.

    """

    def __init__(self, *args, **kwargs):
        self._args = args
        self._kwargs = kwargs

    """Context Manager """

    def __enter__(self):
        fd, self._path = tempfile.mkstemp(*self._args, **self._kwargs)
        # We close the file descriptor since mkstemp opens it by default.
        os.close(fd)
        return self._path

    def __exit__(self, *exec):
        os.remove(self._path)


class TemporaryDirectory(object):
    """Temporary directory context mananger.

    Creates a temporary directory that exists whithin the context manager scope.
    It returns the path to the created directory.
    Wrapper on top of tempfile.mkdtemp.

    Parameters
    ----------
    suffix : str or None
        Suffix to the filename.
    prefix : str or None
        Prefix to the filename.
    dir : str or None
        Enclosing directory.

    """

    def __init__(self, *args, **kwargs):
        self._args = args
        self._kwargs = kwargs

    def __enter__(self):
        self._path = tempfile.mkdtemp(*self._args, **self._kwargs)
        return self._path

    def __exit__(self, *exec):
        shutil.rmtree(self._path)
