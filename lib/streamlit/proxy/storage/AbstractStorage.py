# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

"""Handles a connecton to an S3 bucket to send Report data."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import base58
import hashlib
import os

from tornado import gen

import streamlit
from streamlit import errors

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class AbstractStorage(object):
    """Abstract cloud storage class."""

    def __init__(self):
        """Constructor."""
        static_dir = _get_static_dir()
        static_files, md5 = _get_static_files(static_dir)

        self._static_dir = static_dir
        self._static_files = static_files
        self._release_hash = '%s-%s' % (
            streamlit.__version__,
            base58.b58encode(md5.digest()[:3]).decode("utf-8"))

    def _get_static_dir(self):
        """Return static directory location."""
        return self._static_dir

    @gen.coroutine
    def save_report_files(self, report_id, files, progress_coroutine=None):
        """Save files related to a given report.

        Parameters
        ----------
        report_id : str
            The report's id.

        files : list of tuples
            A list of pairs of the form:

            [
                (filename_1, raw_data_1),
                (filename_2, raw_data_2), etc..
            ]

            ...where filename_x is the relative path to a file, including the
            actual filename.

            The ordering is important! Files will be written in order according
            to this list.

        progress_coroutine : coroutine | None
            Coroutine that will be called successively with a number between 0
            and 100 as input, to indicate progress.

        Returns
        -------
        str
            the url for the saved report.

        """
        raise NotImplementedError()


def _get_static_dir():
    """Return the path to lib/streamlit/static.

    Returns
    -------
    str
        The path.

    """
    module_dir = os.path.dirname(os.path.normpath(__file__))
    streamlit_dir = os.path.normpath(
        os.path.join(module_dir, '..', '..'))

    return os.path.normpath(
        os.path.join(streamlit_dir, 'static'))


def _get_static_files(static_dir):
    """Get files from the static dir.

    Parameters
    ----------
    static_dir : str
        The path to lib/streamlit/static.

    Returns
    -------
    list of 2-tuples
        The 2-tuples are the relative path to a file and the data for that
        file.
    hashlib.HASH
        An MD5 hash of all files in static_dir.

    """
    # Load static files and compute the release hash
    static_files = []
    md5 = hashlib.md5()

    # Put index.html in this temporary variable rather than in static_files, so
    # we can add it to the END of static_files later on. This is because the
    # presence of index.html is used to verify whether ALL the files have been
    # successfully uploaded.
    index_tuple = None

    for root, dirnames, filenames in os.walk(static_dir):
        for filename in filenames:
            absolute_name = os.path.join(root, filename)
            relative_name = os.path.relpath(absolute_name, static_dir)
            with open(absolute_name, 'rb') as input:
                file_data = input.read()
                file_tuple = (relative_name, file_data)

                if relative_name == 'index.html':
                    index_tuple = file_tuple
                else:
                    static_files.append(file_tuple)

                md5.update(file_data)

    if index_tuple is not None:
        static_files.append(index_tuple)

    if not static_files:
        raise errors.NoStaticFiles(
            'Cannot find static files. Run "make build".')

    return static_files, md5
