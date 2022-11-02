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

"""st.pyplot unit tests."""

from unittest.mock import patch

import matplotlib
import matplotlib.pyplot as plt
import numpy as np

import streamlit as st
from streamlit.web.server.server import MEDIA_ENDPOINT
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PyplotTest(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        if matplotlib.get_backend().lower() != "agg":
            plt.switch_backend("agg")

    def test_st_pyplot(self):
        """Test st.pyplot.

        Need to test:
        * Failed import of matplotlib.
        * Passing in a figure.
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
        self.assertEqual(el.imgs.width, -2)
        self.assertEqual(el.imgs.imgs[0].caption, "")
        self.assertTrue(el.imgs.imgs[0].url.startswith(MEDIA_ENDPOINT))

    def test_st_pyplot_clear_figure(self):
        """st.pyplot should clear the passed-in figure."""
        # Assert that plt.clf() is called by st.pyplot() only if
        # clear_fig is True
        for clear_figure in [True, False, None]:
            plt.hist(np.random.normal(1, 1, size=100), bins=20)
            with patch.object(plt, "clf", wraps=plt.clf, autospec=True) as plt_clf:
                st.pyplot(clear_figure=clear_figure)

                if clear_figure is False:
                    plt_clf.assert_not_called()
                else:
                    plt_clf.assert_called_once()

            # Manually clear for the next loop iteration
            plt.clf()

        # Assert that fig.clf() is called by st.pyplot(fig) only if
        # clear_figure is True
        for clear_figure in [True, False, None]:
            fig = plt.figure()
            ax1 = fig.add_subplot(111)
            ax1.hist(np.random.normal(1, 1, size=100), bins=20)
            with patch.object(fig, "clf", wraps=fig.clf, autospec=True) as fig_clf:
                st.pyplot(fig, clear_figure=clear_figure)

                if clear_figure:
                    fig_clf.assert_called_once()
                else:
                    fig_clf.assert_not_called()
