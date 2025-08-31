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

import streamlit as st
from streamlit.errors import StreamlitAPIException

st.title("Test st.exception")

# Test a basic exception
basic_exception = RuntimeError("This exception message is awesome!")
st.exception(basic_exception)

# Test an exception with a long exception message (this sometimes happens in practice,
# e.g. if an exception message contains a URL)
long_exception = RuntimeError(
    "longlonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglonglong"
)
st.exception(long_exception)

# Test an exception with Markdown
markdown_exception = StreamlitAPIException(
    """
This exception contains Markdown, e.g. **bold text** or an emoji :wave: or :blue[colored text] or `code`.
It also has a code block that you can scroll through:

```
@st.cache(hash_funcs={_thread.lock: my_hash_func_that_is_some_riduculously_long_name})
def my_func(...):
    ...
```


    """
)
st.exception(markdown_exception)

# Test an exception with fixed pixel width
st.exception(RuntimeError("This exception has a fixed width of 200 pixels"), width=200)

# Test an exception with stretch width
st.exception(
    RuntimeError("This exception stretches to fill the container width"),
    width="stretch",
)

# Test an exception that is raised without explicitly calling st.exception. This also
# shows the stack trace (which `st.exception` doesn't show when called explicitly).
# We're hiding this behind a button so the script doesn't raise an exception when run,
# which would cause tests to fail.
if st.button("Raise exception"):
    raise basic_exception
