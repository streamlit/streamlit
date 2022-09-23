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

import streamlit as st

text = """
    This is an example error from caching.py

    **More information:** to prevent unexpected behavior, Streamlit tries
    to detect mutations in cached objects defined in your local files so
    it can alert you when the cache is used incorrectly. However, something
    went wrong while performing this check.

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

st.info(text)
st.success(text)
st.warning(text)
st.error(text)
