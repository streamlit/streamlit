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

"""st.pyplot unit tests."""

from __future__ import annotations

from unittest.mock import Mock, patch

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.web.server.server import MEDIA_ENDPOINT
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PyplotTest(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        if mpl.get_backend().lower() != "agg":
            plt.switch_backend("agg")

    def tearDown(self):
        # Clear the global pyplot figure between tests
        plt.clf()
        super().tearDown()

    def test_st_pyplot(self):
        """Test st.pyplot.

        Need to test:
        - Failed import of matplotlib.
        - Passing in a figure.
        """

        # Make this deterministic
        np.random.seed(19680801)
        data = np.random.randn(2, 20)

        # Generate a 2 inch x 2 inch figure
        fig, ax = plt.subplots(figsize=(2, 2))
        # Add 20 random points to scatter plot.
        ax.scatter(data[0], data[1])

        st.pyplot(fig)

        el = self.get_delta_from_queue().new_element
        assert el.width_config.use_stretch
        assert el.imgs.imgs[0].caption == ""
        assert el.imgs.imgs[0].url.startswith(MEDIA_ENDPOINT)

    @parameterized.expand([("true", True), ("false", False), ("none", None)])
    def test_st_pyplot_clear_global_figure(self, _, clear_figure: bool | None):
        """st.pyplot should clear the global figure if `clear_figure` is
        True *or* None.
        """
        plt.hist(np.random.normal(1, 1, size=100), bins=20)
        with patch.object(plt, "clf", wraps=plt.clf, autospec=True) as plt_clf:
            st.pyplot(clear_figure=clear_figure)

            if clear_figure in (True, None):
                plt_clf.assert_called_once()
            else:
                plt_clf.assert_not_called()

    @patch("streamlit.elements.pyplot.show_deprecation_warning")
    def test_global_object_deprecation_warning(self, show_warning_mock: Mock):
        """We show deprecation warnings when st.pyplot is called without a figure object."""
        plt.hist(np.random.normal(1, 1, size=100), bins=20)
        st.pyplot()

        show_warning_mock.assert_called_once()

    @parameterized.expand([("true", True), ("false", False), ("none", None)])
    def test_st_pyplot_clear_figure(self, _, clear_figure: bool | None):
        """st.pyplot should clear the passed-in figure if `clear_figure` is True."""
        fig = plt.figure()
        ax1 = fig.add_subplot(111)
        ax1.hist(np.random.normal(1, 1, size=100), bins=20)
        with patch.object(fig, "clf", wraps=fig.clf, autospec=True) as fig_clf:
            st.pyplot(fig, clear_figure=clear_figure)

            if clear_figure is True:
                fig_clf.assert_called_once()
            else:
                fig_clf.assert_not_called()

    @parameterized.expand([(True, "use_stretch"), (False, "use_content")])
    def test_st_pyplot_use_container_width(
        self, use_container_width: bool, expected_attribute: str
    ):
        """st.pyplot should set image width."""
        fig = plt.figure()
        ax1 = fig.add_subplot(111)
        ax1.hist(np.random.normal(1, 1, size=100), bins=20)

        st.pyplot(fig, use_container_width=use_container_width)

        el = self.get_delta_from_queue().new_element
        assert getattr(el.width_config, expected_attribute)

    def test_st_pyplot_width_stretch(self):
        """Test st.pyplot with width='stretch'."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig, width="stretch")

        el = self.get_delta_from_queue().new_element
        assert el.width_config.use_stretch

    def test_st_pyplot_width_content(self):
        """Test st.pyplot with width='content'."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig, width="content")

        el = self.get_delta_from_queue().new_element
        assert el.width_config.use_content

    def test_st_pyplot_width_pixel(self):
        """Test st.pyplot with integer pixel width."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig, width=400)

        el = self.get_delta_from_queue().new_element
        assert el.width_config.pixel_width == 400

    def test_st_pyplot_width_default(self):
        """Test st.pyplot default width behavior."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig)

        el = self.get_delta_from_queue().new_element
        # Default for pyplot is "stretch"
        assert el.width_config.use_stretch

    @parameterized.expand(
        [
            (
                "invalid",
                "Invalid width value: 'invalid'. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                "",
                "Invalid width value: ''. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Invalid width value: 0. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -1,
                "Invalid width value: -1. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                None,
                "Invalid width value: None. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
        ]
    )
    def test_st_pyplot_invalid_width(self, invalid_width, expected_error_message):
        """Test st.pyplot with invalid width values."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        with pytest.raises(StreamlitAPIException) as exc_info:
            st.pyplot(fig, width=invalid_width)

        assert str(exc_info.value) == expected_error_message

    @parameterized.expand(
        [
            (
                True,
                "content",
                "use_stretch",
            ),  # use_container_width=True overrides width="content"
            (
                False,
                "stretch",
                "use_content",
            ),  # use_container_width=False overrides width="stretch"
            (True, 400, "use_stretch"),  # use_container_width=True overrides width=400
            (
                False,
                400,
                "use_content",
            ),  # use_container_width=False overrides width=400
        ]
    )
    @patch("streamlit.elements.pyplot.show_deprecation_warning")
    def test_st_pyplot_use_container_width_overrides_width(
        self,
        use_container_width: bool,
        original_width,
        expected_attribute: str,
        show_warning_mock: Mock,
    ):
        """Test that use_container_width parameter overrides the width parameter."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig, width=original_width, use_container_width=use_container_width)

        # Should show deprecation warning
        show_warning_mock.assert_called_once()

        el = self.get_delta_from_queue().new_element
        assert getattr(el.width_config, expected_attribute)
