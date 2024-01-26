# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import TYPE_CHECKING, cast

from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

# Works just like an `empty` except animated by default.
class SkeletonMixin:
    def skeleton(self, width=None, height=None) -> "DeltaGenerator":
        """Insert a single-element container which displays a "skeleton" animation.

        Inserts a container into your app that can be used to hold a single element.
        This allows you to, for example, remove elements at any point, or replace
        several elements at once (using a child multi-element container).

        To insert/replace/clear an element on the returned container, you can
        use "with" notation or just call methods directly on the returned object.
        See examples below.

        Examples
        --------
        Overwriting elements in-place using "with" notation:

        >>> import streamlit as st
        >>> import time
        >>>
        >>> with st.skeleton():
        ...     for seconds in range(60):
        ...         st.write(f"⏳ {seconds} seconds have passed")
        ...         time.sleep(1)
        ...     st.write("✔️ 1 minute over!")

        Replacing several elements, then clearing them:

        >>> import streamlit as st
        >>>
        >>> placeholder = st.skeleton()
        >>>
        >>> # Replace the placeholder with some text:
        >>> placeholder.text("Hello")
        >>>
        >>> # Replace the text with a chart:
        >>> placeholder.line_chart({"data": [1, 5, 2, 6]})
        >>>
        >>> # Replace the chart with several elements:
        >>> with placeholder.container():
        ...     st.write("This is one element")
        ...     st.write("This is another")
        ...
        >>> # Clear all those elements and put the animation back:
        >>> placeholder.skeleton()


        ### MORE TRIAL CODE

        # Create a skeleton, then immediately take time to get data before replacing the skeleton
        # Functions like the "spinner" except that "spinner" displays until the end of it's block, even
        # as other elements are being rendered.

        block = st.skeleton(height=400)
        data = get_data_long_runtime()
        with block.container():
            st.write("Process Completed")
            st.dataframe(data)


        block = st.empty()
        block.skeleton(height=400)
        data = get_data_long_runtime()
        with block.container():
            st.write("Process Completed")
            st.dataframe(data)

        block = st.skeleton(height=400)
        data = get_data_long_runtime()
        block.write("Process Completed")
        block.dataframe(data)


        # Create an app "framework", with skeletons, then fill in the data

        charts = {
            "Chart Title 1": "chart1.dat",
            "Chart Title 2": "chart2.dat",
            "Chart Title 3": "chart3.dat",
        }
        skeletons = []

        for title in charts:
            st.title(title)
            skeletons.append(st.skeleton(height=100))

        do_some_other_stuff()

        for skeleton, chart_file in zip(skeletons, charts.values()):
            with skeleton.container()  # skeleton _is_ empty
                st.dataframe(load_data(chart_file))
                st.write("Source: ", chart_file)

        for skeleton, chart_file in zip(skeletons, charts.values()):
            with skeleton()  # skeleton _is_ container
                st.dataframe(load_data(chart_file))
                st.write("Source: ", chart_file)


        # Skeleton gets a "callback" and runs at end-of-page or async (hard)
        # there's probably __all__ kinds of nastiness hidden here

        def load_chart(chart_file):
            st.dataframe(load_data(chart_file))
            st.write("Source: ", chart_file)

        for title, chart_file in charts:.items()
            st.title(title)
            st.skeleton(load_chart, args=(chart_file))


        ### Distillation of the ideas above

        * st.skeleton is an st.empty with a future promise of additional content (typically one piece)
        * Width and height of the skeleton are configurable. Fractional values for width are treated as a percentage, while values >1
          are treated as a minimum pixel size.

        * The primary use case is to enable users to build Streamlit applications which render UI first and content second.
          This means you can replace

            # Draw UI
            st.write("Census Data")
            census_data_placeholder = st.empty()  # The empty is a collapsed element
            year = st.selectbox("Select Year", options=[2022, 2023, 2024])

            # Get data from source
            # assume function call takes a long time
            census_dataframe = get_census_data_from_database(year)

            # Draw the data, causing it to "pop" in above the year selectbox.
            census_data_placeholder.dataframe(census_dataframe)

          with

            # Draw UI
            st.write("Census Data")
            census_data_placeholder = st.skeleton(height=500px)  # The skeleton holds space for the future data
            year = st.selectbox("Select Year", options=[2022, 2023, 2024])

            # Get data from source, assume this takes a long time
            census_dataframe = get_census_data_from_database(year)

            # Draw the data, replacing the skeleton animation that was previously there
            census_data_placeholder.dataframe(census_dataframe)

        * st.skeleton() returns a special SkeletonDeltaGenerator context manager object
        * When you call skeleton.<dg_function>(), st.skeleton behaves like an empty -- it replaces whatever contents
          it had before with the new element:

            skeleton = st.skeleton()
            # User is shown a skeleton animation while data1 loads
            data1 = get_data_long_running_function()
            skeleton.dataframe(data1)

            # User sees data1 while data2 loads, then data1 is replaced
            data2 = get_data_another_long_running_function()
            skeleton.dataframe(data2)

        * When you use st.skeleton() in a `with` statement, it first places an st.container inside of itself
          and then sets that as the DeltaGenerator context, allowing you to write natural code like

            # Draw UI
            st.write("Census Data")
            census_data_placeholder = st.skeleton(height=500px)
            year = st.selectbox("Select Year", options=[2022, 2023, 2024])

            # Get data from source, assume this takes a long time
            census_dataframe = get_census_data_from_database(year)
            census_statistics = compute_statistics(census_dataframe)

            # Draw the data, replacing the skeleton animation that was previously there
            # Both the st.dataframe and the st.write are dispalyed inside of an st.container
            # inside of the skeleton
            with census_data_placeholder:
                st.dataframe(census_dataframe)
                st.write(census_statistics)

        * st.skeleton has a `callback` argument which allows you to queue up some function to be run at a later time.
        * The callback can be run by calling `.load(*args, **kwargs)` on the SkeletonDeltaGenerator
        * The callback function acts as if it were being run inside a `with skeleton:` block, e.g.

            skeleton.load(a, b, c)

          is equivalent to

            with skeleton:
              skeleton._callback(a, b, c)

        * .load() example:

            def render_census_data(year):
                # Get data from source, assume this takes a long time
                census_dataframe = get_census_data_from_database(year)
                census_statistics = compute_statistics(census_dataframe)

                # Draw the data
                st.dataframe(census_dataframe)
                st.write(census_statistics)

            # Draw UI
            st.write("Census Data")
            census_data_placeholder = st.skeleton(height=500px, callback=render_census_data)
            year = st.selectbox("Select Year", options=[2022, 2023, 2024])

            # Load the census data and display it in place of the skeleton by running
            # the callback function.
            census_data_placeholder.load(year)

        * st.skeleton also has an "autocallback" feature which will .load() all callbacks at the end of page execution
          for all skeletons which have _not_ already had their `.load()` function called at least once by the user.
        * NOTE: some work is required to figure out how to handle _replaced_ skeleton elements (i.e. those which were
          inside an st.empty and got overwritten at some point)
        * When autocallback is enabled (by default), the st.skeleton() also accepts `args` and `kwargs` parameters since
          there will be no calling of the `load` function.

            # Draw UI
            st.write("Census Data")
            year = st.selectbox("Select Year", options=[2022, 2023, 2024])
            census_data_placeholder = st.skeleton(height=500px, callback=render_census_data, args=[year])

            # The callback render_census_data is automatically called at the end of script execution with the argument `year`

        * Optional: the SkeletonDeltaGenerator also has a `.set_callback_arguments(*args, **kwargs)` method so that parameters
          can be set even after the SkeletonDeltaGenerator is created

            # Draw UI
            st.write("Census Data")
            census_data_placeholder = st.skeleton(height=500px, callback=render_census_data)
            year = st.selectbox("Select Year", options=[2022, 2023, 2024])
            census_data_placeholder.set_callback_args(year)

            # The callback render_census_data is automatically called at the end of script execution with the argument `year`

        * This can be turned off either globally via config.toml or via a keyword argument

            census_data_placeholder = st.skeleton(height=500px, callback=render_census_data, autocallback=False)


        """

        skeleton_proto = SkeletonProto()
        # TODO: it accepts width/height arguments
        # skeleton_proto.width = _get_width(width)
        # skeleton_proto.height = _get_height(height)
        return self.dg._enqueue("skeleton", skeleton_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
