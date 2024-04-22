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

import numpy as np

from streamlit import source_util
from streamlit.hello import Hello

# Set random seed to always get the same results in the plotting demo
np.random.seed(0)

# This is a trick to setup the MPA hello app programmatically

source_util._cached_pages = None
source_util._cached_pages = source_util.get_pages(Hello.__file__)
source_util._on_pages_changed.send()

# TODO(lukasmasuch): Once we migrate the hello app to the new programmatic
# MPA API, we can remove this workaround.

Hello.run()
