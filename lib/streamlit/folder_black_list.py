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
import os
import fnmatch

# The files in the folders below should always be blacklisted.
DEFAULT_FOLDER_BLACKLIST = [
    "**/.*",
    "**/anaconda2",
    "**/anaconda3",
    "**/miniconda2",
    "**/miniconda3",
]


class FolderBlackList(object):
    """
    Implement a black list object with globbing used to test whether a file is
    in a folder in the blacklist.
    """

    def __init__(self, folder_blacklist):
        self._folder_blacklist = list(folder_blacklist)
        self._folder_blacklist.extend(DEFAULT_FOLDER_BLACKLIST)

    # Test if filepath is in the blacklist.
    def is_blacklisted(self, filepath):
        return any(
            self._file_is_in_folder(filepath, blacklisted_folder)
            for blacklisted_folder in self._folder_blacklist
        )

    @staticmethod
    def _file_is_in_folder(filepath, folderpath_glob):
        # Strip trailing slash if it exists
        if folderpath_glob.endswith("/"):
            folderpath_glob = folderpath_glob[:-1]

        file_dir = os.path.dirname(filepath)
        return fnmatch.fnmatch(file_dir, folderpath_glob)
