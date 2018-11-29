# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""Handles a connecton to an S3 bucket to send Report data."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import math
import os

from tornado import gen, concurrent

from streamlit import config
from streamlit import errors
from streamlit.proxy.storage.AbstractStorage import AbstractStorage

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class FileStorage(AbstractStorage):
    """Class to store reports in local storage, for testing."""

    def __init__(self):
        """Constructor."""
        LOGGER.debug(f'FileStorage __init__')
        super(FileStorage, self).__init__()
        LOGGER.debug(f'FileStorage post super')
        self._dir = self._mkdir()
        LOGGER.debug(f'mkdir')

    def _mkdir(self):
        cwd = os.getcwd()
        reports_dir = os.path.join(cwd, 'streamlit-storage')
        if not os.path.exists(reports_dir):
            os.mkdir(reports_dir)
        return reports_dir

    @gen.coroutine
    def _save_report_files(self, report_id, files, progress_coroutine=None,
            manifest_save_order=None):
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

            LOGGER.debug(f'Writing file {full_filename}')

            with open(full_filename, 'wb') as f:
                f.write(data)

                if progress_coroutine:
                    yield progress_coroutine(
                        math.ceil(100 * (i + 1) / len(files)))
                else:
                    yield

        LOGGER.debug(f'Done writing files!')
        raise gen.Return(report_path)


def _recursively_create_folder(path):
    try:
        os.makedirs(path)
    except OSError as e:
        if e.errno == os.errno.EEXIST and os.path.isdir(path):
            pass
        else:
            raise e
