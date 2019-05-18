# Copyright 2019 Streamlit Inc. All rights reserved.

"""streamlit.LocalSourcesObserver unit test."""

import os
import pytest
import sys
import textwrap
import unittest

from mock import call, mock_open, patch

from streamlit import LocalSourcesObserver
from streamlit.Report import Report


class FileIsInFolderTest(unittest.TestCase):

    def test_file_in_folder(self):
        ret = LocalSourcesObserver._file_is_in_folder('/a/b/c/foo.py', '/a/b/c/')
        self.assertTrue(ret)

    def test_file_not_in_folder(self):
        ret = LocalSourcesObserver._file_is_in_folder('/a/b/c/foo.py', '/d/e/f/')
        self.assertFalse(ret)

    def test_rel_file_not_in_folder(self):
        ret = LocalSourcesObserver._file_is_in_folder('foo.py', '/d/e/f/')
        self.assertFalse(ret)


# These can be any module in the same foldr as this file.
import tests.streamlit.help_test as RANDOM_MODULE_1
import tests.streamlit.util_test as RANDOM_MODULE_2

REPORT_PATH = __file__
REPORT = Report(REPORT_PATH, [])
CALLBACK = lambda x: x

RANDOM_MODULE_1_FILE = os.path.abspath(RANDOM_MODULE_1.__file__)
RANDOM_MODULE_2_FILE = os.path.abspath(RANDOM_MODULE_2.__file__)

class LocalSourcesObserverTest(unittest.TestCase):
    def setUp(self):
        try:
            del sys.modules[RANDOM_MODULE_1.__name__]
        except:
            pass

        try:
            del sys.modules[RANDOM_MODULE_2.__name__]
        except:
            pass

        try:
            del sys.modules['RANDOM_MODULE_1']
        except:
            pass

        try:
            del sys.modules['RANDOM_MODULE_2']
        except:
            pass

    @patch('streamlit.LocalSourcesObserver.FileObserver')
    def test_just_script(self, fob):
        lso = LocalSourcesObserver.LocalSourcesObserver(REPORT, CALLBACK)

        fob.assert_called_once()
        args = fob.call_args.args
        self.assertEqual(args[0], REPORT_PATH)
        method_type = type(self.test_just_script)
        self.assertEqual(type(args[1]), method_type)

        fob.reset_mock()
        lso.update_watched_modules()
        lso.update_watched_modules()
        lso.update_watched_modules()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 0)

    @patch('streamlit.LocalSourcesObserver.FileObserver')
    def test_script_and_2_modules_at_once(self, fob):
        lso = LocalSourcesObserver.LocalSourcesObserver(REPORT, CALLBACK)

        fob.assert_called_once()

        sys.modules['RANDOM_MODULE_1'] = RANDOM_MODULE_1
        sys.modules['RANDOM_MODULE_2'] = RANDOM_MODULE_2

        fob.reset_mock()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 2)

        method_type = type(self.test_just_script)
        args = fob.call_args_list[0].args
        self.assertEqual(args[0], RANDOM_MODULE_1_FILE)
        self.assertEqual(type(args[1]), method_type)
        args = fob.call_args_list[1].args
        self.assertEqual(args[0], RANDOM_MODULE_2_FILE)
        self.assertEqual(type(args[1]), method_type)

        fob.reset_mock()
        lso.update_watched_modules()

        self.assertEqual(fob.call_count, 0)

    @patch('streamlit.LocalSourcesObserver.FileObserver')
    def test_script_and_2_modules_in_series(self, fob):
        lso = LocalSourcesObserver.LocalSourcesObserver(REPORT, CALLBACK)

        fob.assert_called_once()

        sys.modules['RANDOM_MODULE_1'] = RANDOM_MODULE_1
        fob.reset_mock()

        lso.update_watched_modules()

        fob.assert_called_once()

        method_type = type(self.test_just_script)

        args = fob.call_args.args
        self.assertEqual(args[0], RANDOM_MODULE_1_FILE)
        self.assertEqual(type(args[1]), method_type)

        sys.modules['RANDOM_MODULE_2'] = RANDOM_MODULE_2
        fob.reset_mock()
        lso.update_watched_modules()

        args = fob.call_args.args
        self.assertEqual(args[0], RANDOM_MODULE_2_FILE)
        self.assertEqual(type(args[1]), method_type)

        fob.assert_called_once()
