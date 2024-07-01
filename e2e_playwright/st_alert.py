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

st.error("This is an error")
st.warning("This is a warning")
st.info("This is an info message")
st.success("This is a success message")

# This is here so we can test the distance between alert messages and
# elements above/below them.
st.write("Some non-alert text!")

st.error("This is an error", icon="🚨")
st.warning("This is a warning", icon="⚠️")
st.info("This is an info message", icon="👉🏻")
st.success("This is a success message", icon="✅")

# Verify that line-wrapping works as expected both with and without break words.
st.error("A" + 100 * "H")
st.error("If I repeat myself enough the line should " + 20 * "wrap ")

text = """
    This is an example error from caching.py

    This error can occur when your virtual environment lives in the same
    folder as your project, since that makes it hard for Streamlit to
    understand which files it should check. If you think that's what caused
    this, please add the following to `~/.streamlit/config.toml`:

    ```toml
    [server]
    folderWatchBlacklist = ['foldername']
    ```

    ...where `foldername` is the relative or absolute path to the folder
    where you put your virtual environment.

    Otherwise, please [file a bug
    here](https://github.com/streamlit/streamlit/issues/new/choose).

    To stop this warning from showing in the meantime, try one of the
    following:

    * **Preferred:** modify your code to avoid using this type of object.
    * Or add the argument `allow_output_mutation=True` to the `st.cache` decorator.
    """

st.error(text)
st.warning(text)
st.info(text)
st.success(text)

# Check resolution of issue #6394
text = """
Here is some code:

```
import streamlit as st
st.write("Hello world!")
# this is a very long comment just to demonstrate the overflowing behavior it goes on and on and on
```
"""

st.error(text, icon="🚨")
st.success(text)

st.error("This is an error with non emoji icon", icon=":material/running_with_errors:")

st.warning("This is a warning with non emoji icon", icon=":material/warning:")
st.info("This is an info message with non emoji icon", icon=":material/info:")
st.success(
    "This is a success message with non emoji icon",
    icon=":material/celebration:",
)
