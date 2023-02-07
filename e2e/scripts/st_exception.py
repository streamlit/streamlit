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
from streamlit.errors import StreamlitAPIException

e = RuntimeError("This exception message is awesome!")
st.exception(e)

e = StreamlitAPIException(
    """
Cannot hash object of type `_thread.lock`, found in the return value of
`get_data()`.

While caching the return value of `get_data()`, Streamlit encountered an
object of type `_thread.lock`, which it does not know how to hash.

To address this, please try helping Streamlit understand how to hash that type
by passing the `hash_funcs` argument into `@st.cache`. For example:

```
@st.cache(hash_funcs={_thread.lock: my_hash_func_that_is_some_riduculously_long_name})
def my_func(...):
    ...
```

If you don't know where the object of type  `_thread.lock` is coming
from, try looking at the hash chain below for an object that you do recognize,
then pass that to `hash_funcs` instead:

```
Object of type _thread.lock: <unlocked _thread.lock object at 0x1392ad690>
Object of type builtins.tuple: ('I am another ridiculously long string that will take up space', <unlocked _thread.lock object at 0x1392ad690>)
Object of type builtins.dict: {'I am another ridiculously long string that will take up space': <unlocked _thread.lock object at 0x1392ad690>}
Object of type builtins.tuple: ('I am a ridiculously long string that will take up space', {'I am another ridiculously long string that will take up space': <unlocked _thread.lock object at 0x1392ad690>})
Object of type builtins.dict: {'I am a ridiculously long string that will take up space': {'I am another ridiculously long string that will take up space': <unlocked _thread.lock object at 0x1392ad690>}}

```

Please see the `hash_funcs` [documentation](https://docs.streamlit.io/library/advanced-features/caching#the-hash_funcs-parameter)
for more details.
            """.strip(
        "\n"
    )
)
st.exception(e)
