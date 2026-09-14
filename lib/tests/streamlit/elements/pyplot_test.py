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
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitMissingRequiredParameterError,
)
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

    @parameterized.expand([("true", True), ("false", False)])
    def test_st_pyplot_clear_figure(self, _, clear_figure: bool):
        """st.pyplot calls fig.clf() only when clear_figure is True."""
        fig = plt.figure()
        ax1 = fig.add_subplot(111)
        ax1.hist(np.random.normal(1, 1, size=100), bins=20)
        with patch.object(fig, "clf", wraps=fig.clf, autospec=True) as fig_clf:
            st.pyplot(fig, clear_figure=clear_figure)

            if clear_figure:
                fig_clf.assert_called_once()
            else:
                fig_clf.assert_not_called()

    def test_st_pyplot_clear_figure_defaults_to_false(self):
        """Omitting clear_figure leaves the figure uncleared."""
        fig = plt.figure()
        ax1 = fig.add_subplot(111)
        ax1.hist(np.random.normal(1, 1, size=100), bins=20)
        with patch.object(fig, "clf", wraps=fig.clf, autospec=True) as fig_clf:
            st.pyplot(fig)

            fig_clf.assert_not_called()

    def test_st_pyplot_requires_fig_argument(self):
        """Omitting fig raises TypeError now that the argument is required."""
        with pytest.raises(TypeError):
            st.pyplot()  # type: ignore[call-arg]

    def test_st_pyplot_rejects_none_fig(self):
        """Passing fig=None raises StreamlitMissingRequiredParameterError."""
        with pytest.raises(StreamlitMissingRequiredParameterError) as exc_info:
            st.pyplot(None)  # type: ignore[arg-type]

        assert "The `fig` parameter is required." in str(exc_info.value)
        assert "st.pyplot(fig)" in str(exc_info.value)

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

    @patch("streamlit.elements.pyplot.show_deprecation_warning")
    def test_st_pyplot_savefig_kwargs_deprecation_warning(
        self, show_warning_mock: Mock
    ):
        """Passing savefig kwargs to st.pyplot shows a deprecation warning."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig, dpi=300, transparent=True)

        show_warning_mock.assert_called_once()
        warning_message = show_warning_mock.call_args.args[0]
        assert "savefig" in warning_message
        assert "deprecated" in warning_message
        assert "st.image" in warning_message
        assert show_warning_mock.call_args.kwargs["show_in_browser"] is True

    @patch("streamlit.elements.pyplot.show_deprecation_warning")
    def test_st_pyplot_without_kwargs_skips_savefig_deprecation_warning(
        self, show_warning_mock: Mock
    ):
        """st.pyplot without savefig kwargs does not show the kwargs warning."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig)

        show_warning_mock.assert_not_called()

    def test_st_pyplot_applies_default_savefig_options(self):
        """st.pyplot uses tight bbox, dpi=200, and png when no kwargs are passed."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        with patch.object(fig, "savefig", wraps=fig.savefig) as savefig_mock:
            st.pyplot(fig)

        savefig_mock.assert_called_once()
        savefig_kwargs = savefig_mock.call_args.kwargs
        assert savefig_kwargs["bbox_inches"] == "tight"
        assert savefig_kwargs["dpi"] == 200
        assert savefig_kwargs["format"] == "png"

    @patch("streamlit.elements.pyplot.show_deprecation_warning")
    def test_st_pyplot_kwargs_override_defaults(self, _show_warning_mock: Mock):
        """Deprecated kwargs still override Streamlit's savefig defaults."""
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot([1, 2, 3], [1, 2, 3])

        with patch.object(fig, "savefig", wraps=fig.savefig) as savefig_mock:
            st.pyplot(fig, dpi=50, transparent=True)

        savefig_mock.assert_called_once()
        savefig_kwargs = savefig_mock.call_args.kwargs
        assert savefig_kwargs["dpi"] == 50
        assert savefig_kwargs["transparent"] is True
        assert savefig_kwargs["bbox_inches"] == "tight"
        assert savefig_kwargs["format"] == "png"

    @parameterized.expand([("lowercase", "svg"), ("uppercase", "SVG")])
    @patch("streamlit.elements.pyplot.show_deprecation_warning")
    def test_st_pyplot_svg_format(self, _, fmt: str, show_warning_mock: Mock):
        """format="svg"/"SVG" yields an SVG data URI instead of crashing (#11489)."""
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [1, 2, 3])

        st.pyplot(fig, format=fmt)

        show_warning_mock.assert_called_once()
        # Assert SVG is served as a data URI (not routed through PIL).
        el = self.get_delta_from_queue().new_element
        url = el.imgs.imgs[0].url
        assert url.startswith("data:image/svg+xml;base64,")
        # Decode the payload so an empty or non-SVG body cannot pass on MIME alone.
        decoded = base64.b64decode(url.split(",", 1)[1]).decode("utf-8")
        assert "<svg" in decoded

    @patch("streamlit.elements.pyplot.show_deprecation_warning")
    def test_st_pyplot_svg_via_rcparams(self, show_warning_mock: Mock):
        """SVG resolved from rcParams["savefig.format"] is also detected (#11489).

        Matplotlib resolves the format itself, so `format=None` with an rcParams
        default of "svg" produces SVG that the `format` kwarg alone would not
        reveal. The SVG must still avoid the PIL path.
        """
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [1, 2, 3])

        with mpl.rc_context({"savefig.format": "svg"}):
            st.pyplot(fig, format=None)

        show_warning_mock.assert_called_once()
        el = self.get_delta_from_queue().new_element
        url = el.imgs.imgs[0].url
        assert url.startswith("data:image/svg+xml;base64,")
        decoded = base64.b64decode(url.split(",", 1)[1]).decode("utf-8")
        assert "<svg" in decoded

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
