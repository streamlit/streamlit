# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from datetime import date

import streamlit as st

st.date_input(
    "Single date",
    date(1970, 1, 1),
    min_value=date(1970, 1, 1),
)

# Range mode with a min_value more than 2 years old, which is what enables the
# quick-select dropdown. Its preset labels are localized via
# Intl.RelativeTimeFormat, so they need coverage in every locale.
st.date_input(
    "Range with quick select",
    [date(2019, 7, 6), date(2019, 7, 8)],
    min_value=date(1970, 1, 1),
)
