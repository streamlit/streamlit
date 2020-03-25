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
import json
from typing import Callable
from typing import Dict
from typing import Optional
from typing import Union

import tornado.web

import streamlit.server.routes
from streamlit import StreamlitAPIException
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.DeltaGenerator import NoValue
from streamlit.DeltaGenerator import _get_widget_ui_value
from streamlit.logger import get_logger
from streamlit.proto.Element_pb2 import Element

LOGGER = get_logger(__name__)

# TODO:
# - Allow multiple files to be registered in a single plugin
# - Allow actual files to be registered, instead of just strings
# - Add FileWatcher support, and emit a signal when a plugin is changed on disk
# - Attach plugin functions to the DeltaGenerator class


class MarshallPluginException(StreamlitAPIException):
    pass


def plugin(name: str, javascript: str) -> None:
    """Register a new plugin."""

    # Register this plugin with our global registry.
    plugin_id = PluginRegistry.instance().register_plugin(javascript)

    # Build our plugin function.
    def plugin_instance(dg: DeltaGenerator, args: Optional[Dict]) -> Optional[Dict]:
        try:
            args_json = json.dumps(args)
        except BaseException as e:
            raise MarshallPluginException("Could not convert plugin args to JSON", e)

        def marshall_plugin(element: Element) -> Union[Dict, NoValue]:
            element.plugin_instance.args_json = args_json
            element.plugin_instance.plugin_id = plugin_id
            widget_value = _get_widget_ui_value("plugin_instance", element)
            if widget_value is not None:
                try:
                    widget_value = json.loads(widget_value)
                except BaseException as e:
                    raise MarshallPluginException("Could not not parse plugin JSON", e)

            # Coerce None -> NoValue, which is what _enqueue_new_element_delta
            # expects.
            return widget_value if widget_value is not None else NoValue

        return dg._enqueue_new_element_delta(
            marshall_element=marshall_plugin, delta_type="plugin"
        )

    # Register the plugin as a member function of DeltaGenerator, and as
    # a standalone function in the streamlit namespace.
    # TODO: disallow collisions with important streamlit functions!
    setattr(DeltaGenerator, name, plugin_instance)
    setattr(streamlit, name, lambda args: plugin_instance(streamlit._main, args))


class PluginRequestHandler(tornado.web.RequestHandler):
    """Serves plugin files"""

    @staticmethod
    def get_url(file_id: str) -> str:
        """Return the URL for a plugin file with the given ID."""
        return "plugins/{}".format(file_id)

    def initialize(self, registry: "PluginRegistry") -> None:
        self._registry = registry

    def get(self, filename: str) -> None:
        LOGGER.debug("PluginFileManager: GET %s" % filename)
        file = self._registry.get_plugin(filename)
        if file is None:
            self.write("%s not found" % filename)
            self.set_status(404)
            return

        self.write(file)
        self.set_header("Content-Type", "text/javascript")

    def set_default_headers(self) -> None:
        if streamlit.server.routes.allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def options(self) -> None:
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()


class PluginRegistry:
    _instance = None  # type: Optional[PluginRegistry]

    @classmethod
    def instance(cls) -> "PluginRegistry":
        """Returns the singleton PluginRegistry"""
        if cls._instance is None:
            cls._instance = PluginRegistry()
        return cls._instance

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
