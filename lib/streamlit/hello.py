# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A "Hello World" app."""

import streamlit as st
import inspect
from collections import OrderedDict


def intro():
    st.markdown(
        """
## Intro...

text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
text text text text text text text text text text text text text text text text
"""
    )


def demo_1():
    """
    Welcome to Streamlit! we're generating a bunch of random numbers in a loop
    for around 10 seconds. Enjoy!.
    """
    import time
    import numpy as np

    progress_bar, success = None, None
    status_text = st.empty()
    chart = st.line_chart(np.random.randn(10, 1))
    for i in range(1, 101):
        new_rows = np.random.randn(10, 1)
        status_text.text("The latest random number is: %s" % new_rows[-1, 0])
        chart.add_rows(new_rows)
        if progress_bar is None:
            progress_bar = st.progress(0)
            success = st.empty()
        progress_bar.progress(i)
        time.sleep(0.1)
    progress_bar.empty()
    success.success("Complete!")
    st.button("Re-run")


def demo_2():
    """
    In this demo, we ask you to enter your name in the input box below.
    Streamlit will print it out with a number of repetitions given by a
    slider that you can control.
    """
    name = st.text_input("Your name")
    repetitions = st.slider("Repetitions", 1, 100, 10)
    st.write(name + "".join((" %s" % name) * (repetitions - 1)))


def demo_3():
    """
    This demo shows how to use Streamlit to implement a progress bar.
    """
    import time

    progress_text = st.text("0%")
    progress_bar = st.progress(0)
    success = st.empty()
    for percent_complete in range(1, 101):
        progress_text.text("%d%%" % percent_complete)
        progress_bar.progress(percent_complete)
        time.sleep(0.1)
    progress_bar.empty()
    success.success("Complete!")
    st.balloons()
    st.button("Re-run")

IMAGE_URL = "https://unsplash.com/photos/k0rVudBoB4c/download?force=true"

def demo_4():
    """
    Blur the image! Use the slider in the sidebar to control the amount of
    blur.
    """
    from PIL import Image, ImageFilter
    import requests
    from io import BytesIO

    @st.cache(show_spinner=False)
    def load_image():
        return Image.open(BytesIO(requests.get(IMAGE_URL).content))

    @st.cache
    def blur(image):
        return image.filter(ImageFilter.BLUR)

    # @st.cache
    # def blur(image, n):
    #     blurred = image
    #     for i in range(n):
    #         blurred = blurred.filter(ImageFilter.BLUR)
    #     return blurred

    # image = load_image()
    blurs = st.sidebar.slider("How much blur?", 0, 100, 0)
    image = Image.open("markus-spiske.jpg")
    st.markdown("#### Image blurred %d times" % blurs)
    blurred = image
    for i in range(blurs):
        blurred = blur(blurred)
    # st.image(blur(image, blurs))
    st.image(blurred)


# Data for demo_5 derived from
# https://www.kaggle.com/rounakbanik/the-movies-dataset
DATASET_URL = (
    "https://streamlit-demo-data.s3-us-west-2.amazonaws.com/movies-revenue.csv.gz"
)


def demo_5():
    """
    Discover the gross revenue of a movie of your liking!
    Note that the network loading and preprocessing of the data is cached
    by using Streamlit st.cache annotation.
    """
    import pandas as pd

    @st.cache
    def load_dataframe_from_url():
        return pd.read_csv(DATASET_URL).transform(
            {"title": lambda x: x, "revenue": lambda x: round(x / 1000 / 1000)}
        )

    df = load_dataframe_from_url()
    movie = st.text_input("Search movie titles")
    df = df[df.title.str.contains(movie, case=False)].sort_values(
        ascending=False, by="revenue"
    )
    st.markdown("#### Result dataframe for %d movie(s)" % df.shape[0])
    st.dataframe(df.rename(columns={"title": "Title", "revenue": "Revenue [$1M]"}))


DEMOS = OrderedDict(
    {
        "---": intro,
        "Number Generator": demo_1,
        "Simple Interaction": demo_2,
        "Animation": demo_3,
        "Sidebar": demo_4,
        "Caching": demo_5,
    }
)


def run():
    st.title("Welcome to Streamlit!")
    st.write(
        """
        Streamlit is the best way to create bespoke apps.
        """
    )

    demo_name = st.selectbox("Choose a demo", list(DEMOS.keys()), 0)
    demo = DEMOS[demo_name]

    if demo_name != "---":
        st.markdown("## %s Demo" % demo_name)
        st.write(inspect.getdoc(demo))
        st.markdown("---")
        demo()
        st.markdown("---\n ### Code")
        sourcelines, n_lines = inspect.getsourcelines(demo)
        sourcelines = reset_indentation(remove_docstring(sourcelines))
        st.code("".join(sourcelines))
    else:
        demo()


# This function parses the lines of the function and removes the docstring
# if found.
def remove_docstring(lines):
    if len(lines) < 3 and '"""' not in lines[1]:
        return lines
    #  lines[2] is the first line of the docstring, past the inital """
    index = 2
    while '"""' not in lines[index]:
        index += 1
        # limit to ~100 lines
        if index > 100:
            return lines
    # lined[index] is the closing """
    return lines[index + 1 :]


# This function remove the common leading indentation from a code block
def reset_indentation(lines):
    if len(lines) == 0:
        return []
    spaces = len(lines[0]) - len(lines[0].lstrip())
    return [line[spaces:] if len(line) > spaces else "\n" for line in lines]


if __name__ == "__main__":
    run()
