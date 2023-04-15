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


from typing import Any, Collection, Dict


def extract_from_dict(
    keys: Collection[str], source_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """Extract the specified keys from source_dict and return them in a new dict.

    Parameters
    ----------
    keys : Collection[str]
        The keys to extract from source_dict.
    source_dict : Dict[str, Any]
        The dict to extract keys from. Note that this function mutates source_dict.

    Returns
    -------
    Dict[str, Any]
        A new dict containing the keys/values extracted from source_dict.
    """
    d = {}

    for k in keys:
        if k in source_dict:
            d[k] = source_dict.pop(k)

    return d
