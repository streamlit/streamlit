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

# Send a ForwardMsg to the client that's long enough that we cache it.
st.markdown(
    "\n\n".join(
        50
        * [
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis neque eu orci faucibus pellentesque. Vivamus dapibus pellentesque sem, vitae ultricies sem pharetra at. Curabitur eu congue magna, eu tempor libero. Donec vitae condimentum odio. Sed neque elit, porttitor eget laoreet volutpat, imperdiet et leo. Phasellus vel velit sit amet nulla hendrerit pharetra et non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit. In malesuada sem sit amet felis vestibulum, maximus imperdiet nibh mollis. Cras in ipsum at neque mollis facilisis nec et tortor. Duis fringilla tortor id urna laoreet lobortis."
        ]
    )
)
