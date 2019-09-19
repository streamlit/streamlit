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
    This demo shows how you can use Streamlit to format text in a few different
    ways.
    """
    st.title("✨✨✨ Hello 🌍!!!! ✨✨✨")
    st.header("This is a header...")
    st.subheader("... and this is a subheader")
    st.write("We can write down something...")
    st.text("...as monospaced text...")
    st.markdown("... or maybe with _*markdown*_.")


def demo_2():
    """
    In this demo, we ask you to enter your name in the input box below.
    Streamlit will print it out with a number of repetitions given by a
    slider that you can control.
    """
    name = st.text_input("First name")
    repetitions = st.slider("Repetitions", 1, 100, 10)
    st.write(" ".join(name * repetitions))


def demo_3():
    """
    This demo shows how to use Streamlit to implement a progress bar.
    """
    import time

    progress_bar = st.progress(0)
    progress_text = st.text("0%")
    for percent_complete in range(1, 101):
        progress_bar.progress(percent_complete)
        progress_text.text("%d%%" % percent_complete)
        time.sleep(0.1)
    st.success("Complete!")


def demo_4():
    """
    <Demo Demo>.
    """
    st.write("something")


def demo_5():
    """
    <Demo Demo>.
    """
    st.write("something")


DEMOS = OrderedDict(
    {
        "---": intro,
        "Text Formatting": demo_1,
        "Print Your Name": demo_2,
        "Progress Bar": demo_3,
        "<Something>": demo_4,
        "<Else>": demo_5,
    }
)


# def get_docstring
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
        st.write("### Code")
        sourcelines, n_lines = inspect.getsourcelines(demo)
        sourcelines = reset_indentation(remove_docstring(sourcelines))
        st.code("".join(sourcelines))
        if st.checkbox("Run %s Demo" % demo_name):
            st.write("---\n### Execution")
            demo()
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
