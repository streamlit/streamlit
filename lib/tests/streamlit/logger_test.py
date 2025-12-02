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

"""Logger Unittest."""

from __future__ import annotations

import logging
import unittest
from collections import OrderedDict
from unittest.mock import patch

import pytest
from parameterized import parameterized

from streamlit import config, logger

DUMMY_CONFIG_OPTIONS = OrderedDict()


class LoggerTest(unittest.TestCase):
    """Logger Unittest class."""

    def setUp(self) -> None:
        """Set up test fixtures - store original logger state."""
        # Store original loggers to restore after test
        self._original_loggers = logger._loggers.copy()

    def tearDown(self) -> None:
        """Clean up test fixtures - restore original logger state."""
        # Restore original loggers dict (but don't remove from logging module)
        logger._loggers.clear()
        logger._loggers.update(self._original_loggers)

    def test_set_log_level_by_constant(self) -> None:
        """Test streamlit.logger.set_log_level with logging constants."""
        data = [
            logging.CRITICAL,
            logging.ERROR,
            logging.WARNING,
            logging.INFO,
            logging.DEBUG,
        ]
        for k in data:
            logger.set_log_level(k)
            assert k == logging.getLogger("streamlit").getEffectiveLevel()

    def test_set_log_level_by_string(self) -> None:
        """Test streamlit.logger.set_log_level with string values."""
        data = [
            ("critical", logging.CRITICAL),
            ("error", logging.ERROR),
            ("warning", logging.WARNING),
            ("info", logging.INFO),
            ("debug", logging.DEBUG),
            ("DEBUG", logging.DEBUG),  # Case insensitive
        ]
        for level_str, expected in data:
            logger.set_log_level(level_str)
            assert expected == logging.getLogger("streamlit").getEffectiveLevel()

    def test_set_log_level_error(self) -> None:
        """Test streamlit.logger.set_log_level with invalid level."""
        with pytest.raises(SystemExit) as e:
            logger.set_log_level(90)
        assert e.type is SystemExit
        assert e.value.code == 1

    @parameterized.expand(
        [
            ("%(asctime)s.%(msecs)03d %(name)s: %(message)s", None),
            ("%(asctime)s.%(msecs)03d %(name)s: %(message)s", DUMMY_CONFIG_OPTIONS),
            (None, None),
            (None, DUMMY_CONFIG_OPTIONS),
        ]
    )
    def test_setup_log_formatter(
        self, messageFormat: str | None, config_options: OrderedDict | None
    ) -> None:
        """Test streamlit.logger.setup_formatter for external loggers."""
        # Use a non-streamlit logger name to test external logger behavior
        # External loggers (not under streamlit.*) get their own handlers
        test_logger = logging.getLogger("test_external_logger")

        config._set_option("logger.messageFormat", messageFormat, "test")
        config._set_option("logger.level", logging.DEBUG, "test")

        with patch.object(config, "_config_options", new=config_options):
            logger.setup_formatter(test_logger)
            assert len(test_logger.handlers) == 1
            if config_options:
                assert test_logger.handlers[0].formatter._fmt == (
                    messageFormat or "%(message)s"
                )
            else:
                assert (
                    test_logger.handlers[0].formatter._fmt == logger.DEFAULT_LOG_MESSAGE
                )

        # Clean up
        test_logger.handlers.clear()

    def test_init_tornado_logs(self) -> None:
        """Test streamlit.logger.init_tornado_logs."""
        logger.init_tornado_logs()
        loggers = [x for x in logger._loggers if "tornado." in x]
        expected = ["tornado.access", "tornado.application", "tornado.general"]
        # Check that all expected tornado loggers are present
        for expected_logger in expected:
            assert expected_logger in loggers, f"{expected_logger} not in {loggers}"

    def test_streamlit_child_logger_propagates(self) -> None:
        """Test that streamlit.* child loggers propagate to root logger."""
        # Get a child logger
        child_logger = logger.get_logger("streamlit.test.child")
        root_logger = logging.getLogger("streamlit")

        # Child logger should propagate (default behavior)
        assert child_logger.propagate is True

        # Child logger should NOT have its own streamlit_console_handler
        assert not hasattr(child_logger, "streamlit_console_handler")

        # Root logger should have the handler
        assert hasattr(root_logger, "streamlit_console_handler")

    def test_root_logger_has_handler(self) -> None:
        """Test that the streamlit root logger has a handler configured."""
        # Request any streamlit logger to trigger root configuration
        logger.get_logger("streamlit.test")

        root_logger = logging.getLogger("streamlit")
        assert hasattr(root_logger, "streamlit_console_handler")
        assert root_logger.streamlit_console_handler in root_logger.handlers

    def test_root_logger_does_not_propagate(self) -> None:
        """Test that the streamlit root logger does not propagate to global root."""
        logger.get_logger("streamlit")
        root_logger = logging.getLogger("streamlit")
        # Root streamlit logger should NOT propagate to avoid duplicate logs
        assert root_logger.propagate is False

    def test_external_logger_has_own_handler(self) -> None:
        """Test that external loggers (like tornado) get their own handlers."""
        tornado_logger = logger.get_logger("tornado.test")

        # External loggers should have their own handler
        assert hasattr(tornado_logger, "streamlit_console_handler")
        assert tornado_logger.streamlit_console_handler in tornado_logger.handlers

        # External loggers should not propagate
        assert tornado_logger.propagate is False

    def test_get_logger_root_alias(self) -> None:
        """Test that get_logger('root') returns the streamlit root logger."""
        root_via_alias = logger.get_logger("root")
        root_direct = logging.getLogger("streamlit")
        assert root_via_alias is root_direct

    def test_standard_logging_configuration_works(self) -> None:
        """Test that users can configure streamlit logging using standard methods.

        This is the main improvement from GitHub issue #4742.
        """
        # Ensure root logger is configured
        logger.get_logger("streamlit")

        # User can access and configure the root logger using standard methods
        streamlit_logger = logging.getLogger("streamlit")

        # User can set level
        original_level = streamlit_logger.level
        streamlit_logger.setLevel(logging.DEBUG)
        assert streamlit_logger.level == logging.DEBUG

        # User can add custom handlers
        custom_handler = logging.NullHandler()
        streamlit_logger.addHandler(custom_handler)
        assert custom_handler in streamlit_logger.handlers

        # Clean up
        streamlit_logger.removeHandler(custom_handler)
        streamlit_logger.setLevel(original_level)
