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


import streamlit as st


def display():
    st.sidebar.page_link("app.py", label="🏠 Main")
    st.sidebar.title("This ia a blog page.")
    st.sidebar.header("Click a post.")
    st.sidebar.page_link("pages/cookbook/multipages.py", label="◀️ Multipages")

    clicked_once = False
    for post_name in _titles.keys():
        title = _titles[post_name]
        clicked = st.sidebar.button(title)
        if clicked:
            clicked_once = True
            selected = post_name
    if clicked_once:
        content = _posts[selected]
        st.markdown(content)
    else:
        content = _posts[selected]
        st.markdown(content)


_titles = {
    ".main_post": "Main Page",
    "post1": "Post 1",
    "post2": "Post 2",
}

_posts = {
    ".main_post": """\
# Post Main

Write your main post for your blog here.

## Sorted Posts

Posts are sorted alphabetically.
To place the main page on the top, the name of the main page is .main_post.md. It will show the main page on the top regardless of its name.

## Code Optimization

Implementation codes are not optimized.
Therefore, I recommend you to just refer to the structure rather than to take all the design as they are.\
""",
    "post1": """\
# Title

Instruction

## Session1

Some text

## Session2

Some text\
""",
    "post2": """\
# Title

Another Post

## Session1

Some text

## Session2

Some text\
""",
}
