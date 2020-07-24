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

"""Handles a connecton to an S3 bucket to send Report data."""

import errno
import math
import os

from tornado import gen

from streamlit.storage.abstract_storage import AbstractStorage
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class FileStorage(AbstractStorage):
    """Class to store reports in local storage, for testing."""

    def __init__(self):
        """Constructor."""
        super(FileStorage, self).__init__()
        self._dir = self._mkdir()

    def _mkdir(self):
        cwd = os.getcwd()
        reports_dir = os.path.join(cwd, "frontend/public")
        if not os.path.exists(reports_dir):
            os.mkdir(reports_dir)
        return reports_dir

    @gen.coroutine
    def _save_report_files(
        self, report_id, files, progress_coroutine=None, manifest_save_order=None
    ):
        """Save files related to a given report.

        See AbstractStorage for docs.
        """
        report_path = None

        for i, file_info in enumerate(files):
            relative_filename, data = file_info
            full_filename = os.path.join(self._dir, relative_filename)

            if report_path is None:
                report_path = os.path.dirname(full_filename)
                _recursively_create_folder(report_path)

            LOGGER.debug("Writing file %s", full_filename)

            with open(full_filename, "wb") as f:
                f.write(data)

                if progress_coroutine:
                    yield progress_coroutine(math.ceil(100 * (i + 1) / len(files)))
                else:
                    yield

        LOGGER.debug("Done writing files!")
        raise gen.Return("index.html?id=%s" % report_id)


def _recursively_create_folder(path):
    try:
        os.makedirs(path)
    except OSError as e:
        if e.errno == errno.EEXIST and os.path.isdir(path):
            pass
        else:
            raise e
