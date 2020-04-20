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
import mimetypes
import os
from typing import Any, Dict, Optional, Type, Union

import tornado.web

import streamlit as st  # plugins_test relies on this import name, for patching
import streamlit.server.routes
from streamlit import type_util
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.DeltaGenerator import NoValue
from streamlit.DeltaGenerator import _get_widget_ui_value
from streamlit.elements import arrow_table
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.proto.Element_pb2 import Element
from streamlit.proto.PluginInstance_pb2 import ArgsDataframe


LOGGER = get_logger(__name__)


class MarshallPluginException(StreamlitAPIException):
    pass


def plugin(name: str, path: str) -> None:
    """Register a new plugin."""

    # Register this plugin with our global registry.
    plugin_id = PluginRegistry.instance().register_plugin(path)

    # Build our plugin function.
    def plugin_instance(dg: DeltaGenerator, *args, **kwargs) -> Optional[Any]:
        if len(args) > 0:
            raise MarshallPluginException("Argument '%s' needs a label" % args[0])

        args_json = {}
        args_df = {}
        for key, value in kwargs.items():
            if type_util.is_dataframe_compatible(value):
                args_df[key] = value
            else:
                args_json[key] = value

        try:
            serialized_args_json = json.dumps(args_json)
        except BaseException as e:
            raise MarshallPluginException("Could not convert plugin args to JSON", e)

        # If args["default"] is set, then it's the default widget value we
        # return when the user hasn't interacted yet.
        default_value = kwargs.get("default", None)

        # If args["key"] is set, it is the user_key we use to generate our
        # widget ID.
        user_key = kwargs.get("key", None)

        def marshall_plugin(element: Element) -> Union[Any, Type[NoValue]]:
            element.plugin_instance.args_json = serialized_args_json
            element.plugin_instance.plugin_id = plugin_id

            for key, value in args_df.items():
                new_args_dataframe = ArgsDataframe()
                new_args_dataframe.key = key
                arrow_table.marshall(new_args_dataframe.value.data, value)
                element.plugin_instance.args_dataframe.append(new_args_dataframe)

            widget_value = _get_widget_ui_value(
                "plugin_instance", element, user_key=user_key
            )

            if widget_value is None:
                widget_value = default_value

            # widget_value will be either None or whatever the plugin's most
            # recent setWidgetValue value is. We coerce None -> NoValue,
            # because that's what _enqueue_new_element_delta expects.
            return widget_value if widget_value is not None else NoValue

        result = dg._enqueue_new_element_delta(
            marshall_element=marshall_plugin, delta_type="plugin"
        )

        return result

    # Build st.[plugin_name], which just calls plugin_instance with the
    # main DeltaGenerator.
    def plugin_instance_main(*args, **kwargs):
        return plugin_instance(streamlit._main, *args, **kwargs)

    # Register the plugin as a member function of DeltaGenerator, and as
    # a standalone function in the streamlit namespace.
    # TODO: disallow collisions with important streamlit functions!
    setattr(DeltaGenerator, name, plugin_instance)
    setattr(st, name, plugin_instance_main)


class PluginRequestHandler(tornado.web.RequestHandler):
    def initialize(self, registry: "PluginRegistry"):
        self._registry = registry

    def get(self, path: str) -> None:
        parts = path.split("/")
        plugin_id = parts[0]
        plugin_root = self._registry.get_plugin_path(plugin_id)
        if plugin_root is None:
            self.write("%s not found" % path)
            self.set_status(404)
            return

        filename = "/".join(parts[1:])
        abspath = os.path.join(plugin_root, filename)

        LOGGER.debug("PluginFileManager: GET: %s -> %s", path, abspath)

        try:
            with open(abspath, "r") as file:
                contents = file.read()
        except OSError as e:
            self.write("%s read error: %s" % (path, e))
            self.set_status(404)
            return

        self.write(contents)
        self.set_header("Content-Type", self.get_content_type(abspath))

        self.set_extra_headers(path)

    def set_extra_headers(self, path):
        """Disable cache for HTML files.

        Other assets like JS and CSS are suffixed with their hash, so they can
        be cached indefinitely.
        """
        is_index_url = len(path) == 0

        if is_index_url or path.endswith(".html"):
            self.set_header("Cache-Control", "no-cache")
        else:
            self.set_header("Cache-Control", "public")

    def set_default_headers(self) -> None:
        if streamlit.server.routes.allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def options(self) -> None:
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()

    @staticmethod
    def get_content_type(abspath):
        """Returns the ``Content-Type`` header to be used for this request.
        From tornado.web.StaticFileHandler.
        """
        mime_type, encoding = mimetypes.guess_type(abspath)
        # per RFC 6713, use the appropriate type for a gzip compressed file
        if encoding == "gzip":
            return "application/gzip"
        # As of 2015-07-21 there is no bzip2 encoding defined at
        # http://www.iana.org/assignments/media-types/media-types.xhtml
        # So for that (and any other encoding), use octet-stream.
        elif encoding is not None:
            return "application/octet-stream"
        elif mime_type is not None:
            return mime_type
        # if mime_type not detected, use application/octet-stream
        else:
            return "application/octet-stream"

    @staticmethod
    def get_url(file_id: str) -> str:
        """Return the URL for a plugin file with the given ID."""
        return "plugins/{}".format(file_id)


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

    def register_plugin(self, path: str) -> str:
        """Register a filesystem path as a plugin.

        If the path has already been registered, this is a no-op.

        Parameters
        ----------
        path : str
            The path to the directory that contains the plugin's contents.

        Returns
        -------
        str
            The plugin's ID.
        """
        abspath = os.path.abspath(path)
        if not os.path.isdir(abspath):
            raise StreamlitAPIException("No such plugin directory: '%s'" % abspath)
        id = self._get_id(abspath)
        self._plugins[id] = abspath
        return id

    def get_plugin_path(self, id: str) -> Optional[str]:
        """Return the javascript for the plugin with the given ID.
        If no such plugin is registered, None will be returned instead.
        """
        return self._plugins.get(id, None)

    @staticmethod
    def _get_id(path: str) -> str:
        """Compute the ID of a plugin."""
        # TODO: For this to be useful, we need to cache something in the
        # contents. We probably want to just use Watchdog instead, and let
        # a plugin's ID be its name!
        hasher = hashlib.new("md5")
        hasher.update(path.encode())
        return hasher.hexdigest()
