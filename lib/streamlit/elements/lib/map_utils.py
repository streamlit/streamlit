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

import hashlib

from streamlit.util import HASHLIB_KWARGS


def get_hash_of_json_data(json_data: str) -> str:
    """
    Shared function to hash JSON data used in DeckGL/PyDeck paths.
    """

    json_bytes = json_data.encode("utf-8")
    return hashlib.md5(json_bytes, **HASHLIB_KWARGS).hexdigest()
