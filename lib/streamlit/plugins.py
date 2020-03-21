# -*- coding: utf-8 -*-
# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import hashlib
from typing import Dict
from typing import Optional

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

# TODO:
# - Allow multiple files to be registered in a single plugin
# - Allow actual files to be registered, instead of just strings
# - Add FileWatcher support, and emit a signal when a plugin is changed on disk


class PluginRegistry:
    def __init__(self):
        self._plugins = {}  # type: Dict[str, str]

    def register_plugin(self, javascript: str) -> str:
        """Register a javascript string as a plugin.

        If the javascript has already been registered, this is a no-op.

        Parameters
        ----------
        javascript : str
            The contents of a javascript file.

        Returns
        -------
        str
            The plugin's ID.
        """
        id = self._get_id(javascript)
        self._plugins[id] = javascript
        return id

    def get_plugin(self, id: str) -> Optional[str]:
        """Return the javascript for the plugin with the given ID.
        If no such plugin is registered, None will be returned instead.
        """
        return self._plugins.get(id, None)

    @staticmethod
    def _get_id(javascript: str) -> str:
        """Compute the ID of a plugin."""
        hasher = hashlib.new("md5")
        hasher.update(javascript.encode())
        return hasher.hexdigest()
