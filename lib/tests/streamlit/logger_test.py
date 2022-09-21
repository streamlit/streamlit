# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""Logger Unittest."""

import logging
import unittest
from collections import OrderedDict

import pytest
from unittest.mock import patch
from parameterized import parameterized

from streamlit import logger
from streamlit import config


DUMMY_CONFIG_OPTIONS = OrderedDict()


class LoggerTest(unittest.TestCase):
    """Logger Unittest class."""

    # Need to fix this test:
    # https://trello.com/c/ZwNR7fWI
    # def test_set_log_level_by_name(self):
    #     """Test streamlit.logger.set_log_level."""
    #     data = {
    #         'critical': logging.CRITICAL,
    #         'error': logging.ERROR,
    #         'warning': logging.WARNING,
    #         'info': logging.INFO,
    #         'debug': logging.DEBUG,
    #     }
    #     for k, v in data.items():
    #         streamlit.logger.set_log_level(k)
    #         self.assertEqual(v, logging.getLogger().getEffectiveLevel())

    def test_set_log_level_by_constant(self):
        """Test streamlit.logger.set_log_level."""
        data = [
            logging.CRITICAL,
            logging.ERROR,
            logging.WARNING,
            logging.INFO,
            logging.DEBUG,
        ]
        for k in data:
            logger.set_log_level(k)
            self.assertEqual(k, logging.getLogger().getEffectiveLevel())

    def test_set_log_level_error(self):
        """Test streamlit.logger.set_log_level."""
        with pytest.raises(SystemExit) as e:
            logger.set_log_level(90)
        self.assertEqual(e.type, SystemExit)
        self.assertEqual(e.value.code, 1)

    # Need to fix this test:
    # https://trello.com/c/ZwNR7fWI
    # def test_set_log_level_resets(self):
    #     """Test streamlit.logger.set_log_level."""
    #     streamlit.logger.set_log_level('debug')
    #     test1 = streamlit.logger.get_logger('test1')
    #     self.assertEqual(logging.DEBUG, test1.getEffectiveLevel())
    #
    #     streamlit.logger.set_log_level('warning')
    #     self.assertEqual(logging.WARNING, test1.getEffectiveLevel())
    #
    #     streamlit.logger.set_log_level('critical')
    #     test2 = streamlit.logger.get_logger('test2')
    #     self.assertEqual(logging.CRITICAL, test2.getEffectiveLevel())

    @parameterized.expand(
        [
            ("%(asctime)s.%(msecs)03d %(name)s: %(message)s", None),
            ("%(asctime)s.%(msecs)03d %(name)s: %(message)s", DUMMY_CONFIG_OPTIONS),
            (None, None),
            (None, DUMMY_CONFIG_OPTIONS),
        ]
    )
    def test_setup_log_formatter(self, messageFormat, config_options):
        """Test streamlit.logger.setup_log_formatter."""

        LOGGER = logger.get_logger("test")

        config._set_option("logger.messageFormat", messageFormat, "test")
        config._set_option("logger.level", logging.DEBUG, "test")

        with patch.object(config, "_config_options", new=config_options):
            logger.setup_formatter(LOGGER)
            self.assertEqual(len(LOGGER.handlers), 1)
            if config_options:
                self.assertEqual(
                    LOGGER.handlers[0].formatter._fmt, messageFormat or "%(message)s"
                )
            else:
                self.assertEqual(
                    LOGGER.handlers[0].formatter._fmt, logger.DEFAULT_LOG_MESSAGE
                )

    def test_init_tornado_logs(self):
        """Test streamlit.logger.init_tornado_logs."""
        logger.init_tornado_logs()
        loggers = [x for x in logger._loggers.keys() if "tornado." in x]
        truth = ["tornado.access", "tornado.application", "tornado.general"]
        self.assertEqual(sorted(truth), sorted(loggers))

    # Need to fix this test:
    # https://trello.com/c/ZwNR7fWI
    # def test_get_logger(self):
    #     """Test streamlit.logger.get_logger."""
    #     # Test that get_logger with no args, figures out its caller
    #     logger = streamlit.logger.get_logger()
    #     self.assertTrue('.logger_test' in streamlit.logger.LOGGERS.keys())
