# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import base64
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
        # Close every figure between tests. ``plt.clf()`` only clears the current
        # figure's contents and leaves it registered with pyplot, so figures
        # created here accumulated across the session until matplotlib warned
        # about more than 20 being open.
        plt.close("all")
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

            if clear_figure in {True, None}:
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
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                "",
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -1,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                None,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
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

        assert expected_error_message in str(exc_info.value)

    @parameterized.expand([("lowercase", "svg"), ("uppercase", "SVG")])
    def test_st_pyplot_svg_format(self, _, fmt: str):
        """format="svg"/"SVG" yields an SVG data URI instead of crashing (#11489)."""
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig, format=fmt)

        # Assert SVG is served as a data URI (not routed through PIL).
        el = self.get_delta_from_queue().new_element
        url = el.imgs.imgs[0].url
        assert url.startswith("data:image/svg+xml;base64,")
        # Decode the payload so an empty or non-SVG body cannot pass on MIME alone.
        decoded = base64.b64decode(url.split(",", 1)[1]).decode("utf-8")
        assert "<svg" in decoded

    def test_st_pyplot_svg_via_rcparams(self):
        """SVG resolved from rcParams["savefig.format"] is also detected (#11489).

        Matplotlib resolves the format itself, so `format=None` with an rcParams
        default of "svg" produces SVG that the `format` kwarg alone would not
        reveal. The SVG must still avoid the PIL path.
        """
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [1, 2, 3])

        with mpl.rc_context({"savefig.format": "svg"}):
            st.pyplot(fig, format=None)

        el = self.get_delta_from_queue().new_element
        url = el.imgs.imgs[0].url
        assert url.startswith("data:image/svg+xml;base64,")
        decoded = base64.b64decode(url.split(",", 1)[1]).decode("utf-8")
        assert "<svg" in decoded

    @parameterized.expand([("lowercase", "svgz"), ("uppercase", "SVGZ")])
    def test_st_pyplot_svgz_format(self, _, fmt: str):
        """svgz is gzipped SVG, so it must be inflated onto the SVG path.

        Without inflation the gzip magic bytes reach PIL, which cannot identify
        them, so this crashed the same way plain SVG used to.
        """
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig, format=fmt)

        el = self.get_delta_from_queue().new_element
        url = el.imgs.imgs[0].url
        assert url.startswith("data:image/svg+xml;base64,")
        # Decode so a gzip blob mislabelled as SVG cannot pass on MIME alone.
        decoded = base64.b64decode(url.split(",", 1)[1]).decode("utf-8")
        assert "<svg" in decoded

    @parameterized.expand(
        [
            ("pdf", "pdf", "PDF"),
            ("eps", "eps", "PostScript"),
            ("ps", "ps", "PostScript"),
        ]
    )
    def test_st_pyplot_rejects_unrenderable_vector_format(
        self, _, fmt: str, expected_label: str
    ):
        """PDF/PostScript must fail with a message naming the format and a way out.

        These need an external rasteriser that Streamlit does not bundle. Left
        alone they reach PIL and surface an opaque ``UnidentifiedImageError`` /
        ``OSError`` from several frames deeper, naming neither the format nor a fix.
        """
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [1, 2, 3])

        with pytest.raises(StreamlitAPIException) as exc_info:
            st.pyplot(fig, format=fmt)

        message = str(exc_info.value)
        assert expected_label in message, "the error must name the offending format"
        assert 'format="png"' in message, "the error must offer a working alternative"
        assert 'format="svg"' in message

    def test_st_pyplot_png_is_unaffected_by_vector_guard(self):
        """The default raster path must still render, not trip the new guard."""
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig)

        el = self.get_delta_from_queue().new_element
        assert el.imgs.imgs[0].url.startswith(MEDIA_ENDPOINT)

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
