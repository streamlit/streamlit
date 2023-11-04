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

from importlib import import_module

from streamlit import config
from streamlit.runtime.caching.storage import CacheStorageManager
from streamlit.runtime.caching.storage.local_disk_cache_storage import (
    LocalDiskCacheStorageManager,
)


def create_default_cache_storage_manager() -> CacheStorageManager:
    """
    Get the cache storage manager.
    It would be used both in server.py and in cli.py to have unified cache storage

    Returns
    -------
    CacheStorageManager
        The cache storage manager.

    """
    cache_storage_manager_class = LocalDiskCacheStorageManager

    if config.get_option("global.useCustomCacheStorageManager"):
        custom_cache_storage_manager_class_path = config.get_option(
            "global.customCacheStorageManagerClass"
        )
        module_name, class_name = custom_cache_storage_manager_class_path.rsplit(".", 1)
        try:
            custom_cache_storage_manager_module = import_module(module_name)
            custom_cache_storage_manager_class = getattr(
                custom_cache_storage_manager_module, class_name
            )
            cache_storage_manager_class = custom_cache_storage_manager_class
        except (AttributeError, ImportError):
            # TODO[kajarenc] Add logging here
            cache_storage_manager_class = LocalDiskCacheStorageManager

    if hasattr(cache_storage_manager_class, "from_secrets"):
        return cache_storage_manager_class.from_secrets()
    return cache_storage_manager_class()
