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

from typing import Any, Dict


class AttributeDictionary(Dict[Any, Any]):
    """
    A dictionary subclass that supports attribute-style access.

    This class extends the functionality of a standard dictionary to allow items to be accessed
    via attribute-style dot notation in addition to the traditional key-based access. If a dictionary
    item is accessed and is itself a dictionary, it is automatically wrapped in another `AttributeDictionary`,
    enabling recursive attribute-style access.
    """

    def __getattr__(self, key):
        try:
            item = self.__getitem__(key)
            return AttributeDictionary(item) if isinstance(item, dict) else item
        except KeyError as err:
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{key}'"
            ) from err

    __setattr__ = dict.__setitem__
