# Copyright 2018-2021 Streamlit Inc.
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

import json
import typing
from typing import List

import tornado.web

from streamlit.server.routes import allow_cross_origin_requests


class Stat(typing.NamedTuple):
    provider_name: str
    item_name: str
    byte_length: int


class StatsProvider:
    def get_stats(self) -> List[Stat]:
        raise NotImplementedError


class StatsManager:
    def __init__(self):
        self._providers: List[StatsProvider] = []

    def register_provider(self, provider: StatsProvider) -> None:
        """Register a StatsProvider with the manager.
        This function is not thread-safe. Call it immediately after
        creation.
        """
        self._providers.append(provider)

    def get_stats(self) -> List[Stat]:
        """Return a list containing all stats from each registered provider."""
        all_stats: List[Stat] = []
        for provider in self._providers:
            all_stats.extend(provider.get_stats())
        return all_stats


class StatsHandler(tornado.web.RequestHandler):
    def initialize(self, manager: StatsManager) -> None:
        self._manager = manager

    def set_default_headers(self):
        if allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Content-Type", "application/json")

    def options(self):
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()

    def get(self) -> None:
        self.write(json.dumps(self._manager.get_stats()))
        self.set_status(200)
