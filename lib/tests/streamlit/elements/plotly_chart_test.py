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
from __future__ import annotations

from unittest.mock import MagicMock, patch

import plotly.express as px
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.caching import cached_message_replay
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PyDeckTest(DeltaGeneratorTestCase):
    def test_basic(self):
        """Test that plotly object works."""
        df = px.data.gapminder().query("country=='Canada'")
        fig = px.line(df, x="year", y="lifeExp", title="Life expectancy in Canada")
        st.plotly_chart(fig)

        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.spec != ""
        assert el.plotly_chart.config != ""

        # Check that deprecated properties are empty
        assert el.plotly_chart.figure.spec == ""
        assert el.plotly_chart.figure.config == ""
        assert not el.plotly_chart.HasField("url")

    @parameterized.expand(
        [
            ("streamlit", "streamlit"),
            (None, ""),
        ]
    )
    def test_theme(self, theme_value, proto_value):
        df = px.data.gapminder().query("country=='Canada'")
        fig = px.line(df, x="year", y="lifeExp", title="Life expectancy in Canada")
        st.plotly_chart(fig, theme=theme_value)

        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.theme == proto_value

    def test_bad_theme(self):
        df = px.data.gapminder().query("country=='Canada'")
        fig = px.line(df, x="year", y="lifeExp", title="Life expectancy in Canada")
        with pytest.raises(StreamlitAPIException) as exc:
            st.plotly_chart(fig, theme="bad_theme")

        assert str(exc.value) == (
            'You set theme="bad_theme" while Streamlit charts only support '
            "theme=”streamlit” or theme=None to fallback to the default library theme."
        )

    def test_st_plotly_chart_simple(self):
        """Test st.plotly_chart."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        st.plotly_chart(data)

        el = self.get_delta_from_queue().new_element
        assert not el.plotly_chart.HasField("url")
        assert el.plotly_chart.spec != ""
        assert el.plotly_chart.config != ""

    def test_works_with_element_replay(self):
        """Test that element replay works for plotly if used as non-widget element."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        @st.cache_data
        def cache_element():
            st.plotly_chart(data)

        with patch(
            "streamlit.runtime.caching.cache_utils.replay_cached_messages",
            wraps=cached_message_replay.replay_cached_messages,
        ) as replay_cached_messages_mock:
            cache_element()
            el = self.get_delta_from_queue().new_element.plotly_chart
            assert el.spec != ""
            # The first time the cached function is called, the replay function is not called
            replay_cached_messages_mock.assert_not_called()

            cache_element()
            el = self.get_delta_from_queue().new_element.plotly_chart
            assert el.spec != ""
            # The second time the cached function is called, the replay function is called
            replay_cached_messages_mock.assert_called_once()

            cache_element()
            el = self.get_delta_from_queue().new_element.plotly_chart
            assert el.spec != ""
            # The third time the cached function is called, the replay function is called
            replay_cached_messages_mock.assert_called()

    @parameterized.expand(
        [
            ("rerun", [0, 1, 2]),
            ("ignore", []),
            (lambda: None, [0, 1, 2]),
        ]
    )
    def test_st_plotly_chart_valid_on_select(self, on_select, proto_value):
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        st.plotly_chart(data, on_select=on_select)

        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.selection_mode == proto_value
        assert el.plotly_chart.form_id == ""

    def test_plotly_chart_on_select_initial_returns(self):
        """Test st.plotly_chart returns an empty selection as initial result."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        selection = st.plotly_chart(data, on_select="rerun", key="plotly_chart")

        assert selection.selection.points == []
        assert selection.selection.box == []
        assert selection.selection.lasso == []
        assert selection.selection.point_indices == []

        # Check that the selection state is added to the session state:
        assert st.session_state.plotly_chart.selection.points == []
        assert st.session_state.plotly_chart.selection.box == []
        assert st.session_state.plotly_chart.selection.lasso == []
        assert st.session_state.plotly_chart.selection.point_indices == []

    def test_st_plotly_chart_invalid_on_select(self):
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]
        with pytest.raises(StreamlitAPIException):
            st.plotly_chart(data, on_select="invalid")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form_on_select_rerun(self):
        """Test that form id is marshalled correctly inside of a form."""
        import plotly.graph_objs as go

        with st.form("form"):
            trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

            data = [trace0]
            st.plotly_chart(data, on_select="rerun")

        # 2 elements will be created: form block, plotly_chart
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        plotly_proto = self.get_delta_from_queue(1).new_element.plotly_chart
        assert plotly_proto.form_id == form_proto.form.form_id

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form_on_select_ignore(self):
        """Test that form id is marshalled correctly inside of a form."""
        import plotly.graph_objs as go

        with st.form("form"):
            trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

            data = [trace0]
            st.plotly_chart(data, on_select="ignore")

        # 2 elements will be created: form block, plotly_chart
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        plotly_proto = self.get_delta_from_queue(1).new_element.plotly_chart
        assert plotly_proto.form_id == form_proto.form.form_id

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this is used with selections activated
        inside a cached function."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]
        st.cache_data(lambda: st.plotly_chart(data, on_select="rerun"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_selection_mode_parsing(self):
        """Test that the selection_mode parameter is parsed correctly."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        st.plotly_chart(data, on_select="rerun", selection_mode="points")
        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.selection_mode == [0]

        st.plotly_chart(data, on_select="rerun", selection_mode=("points", "lasso"))
        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.selection_mode == [0, 2]

        st.plotly_chart(data, on_select="rerun", selection_mode={"box", "lasso"})
        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.selection_mode == [1, 2]

        # If selections are deactivated, the selection mode list should be empty
        # even if the selection_mode parameter is set.
        st.plotly_chart(data, on_select="ignore", selection_mode={"box", "lasso"})
        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.selection_mode == []

        st.plotly_chart(
            data, on_select=lambda: None, selection_mode=["points", "box", "lasso"]
        )
        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.selection_mode == [0, 1, 2]

        # Should throw an exception of the selection mode is parsed wrongly
        with pytest.raises(StreamlitAPIException):
            st.plotly_chart(data, on_select="rerun", selection_mode=["invalid", "box"])

    def test_plotly_config(self):
        """Test st.plotly_chart config dict parameter."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        config = {"displayModeBar": False, "responsive": True}
        st.plotly_chart(data, config=config)

        el = self.get_delta_from_queue().new_element
        assert el.plotly_chart.config != ""
        assert '"displayModeBar": false' in el.plotly_chart.config
        assert '"responsive": true' in el.plotly_chart.config

    def test_show_deprecation_warning_for_kwargs(self):
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        st.plotly_chart(data, sharing="streamlit")
        # Get the second to last element, which should be deprecation warning
        el = self.get_delta_from_queue(-2).new_element
        assert (
            "have been deprecated and will be removed in a future release"
            in el.alert.body
        )


class PlotlyChartWidthTest(DeltaGeneratorTestCase):
    """Test plotly_chart width parameter functionality."""

    @parameterized.expand(
        [
            # width, expected_width_spec, expected_width_value
            ("stretch", "use_stretch", True),
            ("content", "pixel_width", 700),  # Content width resolves to 700px default
            (500, "pixel_width", 500),
        ]
    )
    def test_plotly_chart_width_combinations(
        self,
        width: str | int,
        expected_width_spec: str,
        expected_width_value: bool | int,
    ):
        """Test plotly chart with various width combinations."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        st.plotly_chart(data, width=width)

        delta = self.get_delta_from_queue()
        el = delta.new_element

        # Check width_config on the element
        assert el.width_config.WhichOneof("width_spec") == expected_width_spec
        assert getattr(el.width_config, expected_width_spec) == expected_width_value

    @parameterized.expand(
        [
            # use_container_width, width, expected_width_spec, expected_width_value
            (True, None, "use_stretch", True),  # use_container_width=True -> stretch
            (
                False,
                None,
                "pixel_width",
                700,
            ),  # use_container_width=False, no width -> default 700
            (
                True,
                500,
                "use_stretch",
                True,
            ),  # use_container_width overrides width -> stretch
            (
                True,
                "content",
                "use_stretch",
                True,
            ),  # use_container_width overrides width -> stretch
            (
                False,
                "content",
                "pixel_width",
                700,
            ),  # content width resolves to 700px default when no figure width
            (
                False,
                500,
                "pixel_width",
                500,
            ),  # integer width -> pixel width
        ]
    )
    @patch("streamlit.elements.plotly_chart.show_deprecation_warning")
    def test_use_container_width_deprecation(
        self,
        use_container_width: bool,
        width: str | int | None,
        expected_width_spec: str,
        expected_width_value: bool | int,
        mock_show_warning,
    ):
        """Test deprecation warning and translation logic."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        kwargs = {"use_container_width": use_container_width}
        if width is not None:
            kwargs["width"] = width

        st.plotly_chart(data, **kwargs)

        # Check that deprecation warning was called
        mock_show_warning.assert_called_once()

        delta = self.get_delta_from_queue()
        el = delta.new_element

        # Check width_config reflects the expected width (NOT deprecated proto fields)
        assert el.width_config.WhichOneof("width_spec") == expected_width_spec
        assert getattr(el.width_config, expected_width_spec) == expected_width_value

    @parameterized.expand(
        [
            ("width", "invalid_width"),
            ("width", 0),  # width must be positive
            ("width", -100),  # negative width
        ]
    )
    def test_width_validation_errors(self, param_name: str, invalid_value: str | int):
        """Test that invalid width values raise validation errors."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        with pytest.raises(StreamlitAPIException):
            st.plotly_chart(data, width=invalid_value)

    def test_width_parameter_with_selections(self):
        """Test width parameter works correctly with selections activated."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        st.plotly_chart(data, width="content", on_select="rerun", key="test_key")

        delta = self.get_delta_from_queue()
        el = delta.new_element
        assert el.width_config.WhichOneof("width_spec") == "pixel_width"
        assert el.width_config.pixel_width == 700  # Content width defaults to 700px
        assert len(el.plotly_chart.selection_mode) > 0  # Selections are activated

    def test_width_defaults_to_stretch(self):
        """Test that width parameter defaults to stretch when not provided."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        st.plotly_chart(data)

        delta = self.get_delta_from_queue()
        el = delta.new_element
        assert el.width_config.WhichOneof("width_spec") == "use_stretch"
        assert el.width_config.use_stretch

    @parameterized.expand([(500, 500), (10, 10), (None, 700)])
    def test_content_width_behavior(
        self, figure_width: int | None, expected_width: int
    ):
        """Test that content width resolves figure layout width correctly."""
        import plotly.graph_objs as go

        fig = go.Figure()
        fig.add_trace(go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17]))

        if figure_width is not None:
            fig.update_layout(width=figure_width, height=300)

        st.plotly_chart(fig, width="content")

        delta = self.get_delta_from_queue()
        el = delta.new_element
        assert el.width_config.WhichOneof("width_spec") == "pixel_width"
        assert el.width_config.pixel_width == expected_width

    def test_content_width_with_various_data_types(self):
        """Test content width handling with different plotly-accepted data types."""
        import plotly.graph_objs as go

        with self.subTest("matplotlib_figure"):
            import matplotlib.pyplot as plt

            # Create a matplotlib figure
            fig, ax = plt.subplots(figsize=(8, 6))  # 8 inches * 100 dpi = 800px width
            ax.plot([1, 2, 3, 4], [10, 15, 13, 17])
            ax.set_title("Matplotlib Figure")

            st.plotly_chart(fig, width="content")
            plt.close(fig)  # Clean up

            delta = self.get_delta_from_queue()
            el = delta.new_element
            assert el.width_config.WhichOneof("width_spec") == "pixel_width"
            # Matplotlib figures get converted, may not preserve exact width
            # but should still resolve to a reasonable value
            assert el.width_config.pixel_width >= 100

        with self.subTest("data_list"):
            # Create plotly data as a list (no explicit width in layout)
            data = [go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])]
            st.plotly_chart(data, width="content")

            delta = self.get_delta_from_queue()
            el = delta.new_element
            assert el.width_config.WhichOneof("width_spec") == "pixel_width"
            # No explicit width, should default to 700
            assert el.width_config.pixel_width == 700

        with self.subTest("data_dict"):
            # Create plotly data as a dictionary (no explicit width)
            data_dict = {
                "data": [{"x": [1, 2, 3, 4], "y": [10, 15, 13, 17], "type": "scatter"}],
                "layout": {"title": "Dict Data"},
            }
            st.plotly_chart(data_dict, width="content")

            delta = self.get_delta_from_queue()
            el = delta.new_element
            assert el.width_config.WhichOneof("width_spec") == "pixel_width"
            # No explicit width, should default to 700
            assert el.width_config.pixel_width == 700

        with self.subTest("plotly_figure_with_width"):
            # Create plotly figure with explicit width
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17]))
            fig.update_layout(width=600, height=400, title="Figure with Width")
            st.plotly_chart(fig, width="content")

            delta = self.get_delta_from_queue()
            el = delta.new_element
            assert el.width_config.WhichOneof("width_spec") == "pixel_width"
            # Should use the explicit width from the figure
            assert el.width_config.pixel_width == 600
