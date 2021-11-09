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

import typing
from abc import abstractmethod
from typing import List

import tornado.web

from streamlit.proto.openmetrics_data_model_pb2 import (
    Metric as MetricProto,
    MetricSet as MetricSetProto,
    GAUGE,
)


class CacheStat(typing.NamedTuple):
    """Describes a single cache entry.

    Properties
    ----------
    category_name : str
        A human-readable name for the cache "category" that the entry belongs
        to - e.g. "st.memo", "session_state", etc.
    cache_name : str
        A human-readable name for cache instance that the entry belongs to.
        For "st.memo" and other function decorator caches, this might be the
        name of the cached function. If the cache category doesn't have
        multiple separate cache instances, this can just be the empty string.
    byte_length : int
        The entry's memory footprint in bytes.
    """

    category_name: str
    cache_name: str
    byte_length: int

    def to_metric_str(self) -> str:
        return 'cache_memory_bytes{cache_type="%s",cache="%s"} %s' % (
            self.category_name,
            self.cache_name,
            self.byte_length,
        )

    def marshall_metric_proto(self, metric: MetricProto) -> None:
        """Fill an OpenMetrics `Metric` protobuf object."""
        label = metric.labels.add()
        label.name = "cache_type"
        label.value = self.category_name

        label = metric.labels.add()
        label.name = "cache"
        label.value = self.cache_name

        metric_point = metric.metric_points.add()
        metric_point.gauge_value.int_value = self.byte_length


class CacheStatsProvider:
    @abstractmethod
    def get_stats(self) -> List[CacheStat]:
        raise NotImplementedError


class StatsManager:
    def __init__(self):
        self._cache_stats_providers: List[CacheStatsProvider] = []

    def register_provider(self, provider: CacheStatsProvider) -> None:
        """Register a CacheStatsProvider with the manager.
        This function is not thread-safe. Call it immediately after
        creation.
        """
        self._cache_stats_providers.append(provider)

    def get_stats(self) -> List[CacheStat]:
        """Return a list containing all stats from each registered provider."""
        all_stats: List[CacheStat] = []
        for provider in self._cache_stats_providers:
            all_stats.extend(provider.get_stats())
        return all_stats


class StatsHandler(tornado.web.RequestHandler):
    def initialize(self, stats_manager: StatsManager) -> None:
        self._manager = stats_manager

    def set_default_headers(self):
        # Avoid a circular import
        from streamlit.server.routes import allow_cross_origin_requests

        if allow_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")

    def options(self):
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()

    def get(self) -> None:
        stats = self._manager.get_stats()

        # If the request asked for protobuf output, we return a serialized
        # protobuf. Else we return text.
        if self.request.headers.get("Content-Type", None) == "application/x-protobuf":
            self.write(self._stats_to_proto(stats).SerializeToString())
            self.set_header("Content-Type", "application/x-protobuf")
            self.set_status(200)
        else:
            self.write(self._stats_to_text(self._manager.get_stats()))
            self.set_header("Content-Type", "application/openmetrics-text")
            self.set_status(200)

    @staticmethod
    def _stats_to_text(stats: List[CacheStat]) -> str:
        metric_type = "# TYPE cache_memory_bytes gauge"
        metric_unit = "# UNIT cache_memory_bytes bytes"
        metric_help = "# HELP Total memory consumed by a cache."
        openmetrics_eof = "# EOF\n"

        # Format: header, stats, EOF
        result = [metric_type, metric_unit, metric_help]
        result.extend(stat.to_metric_str() for stat in stats)
        result.append(openmetrics_eof)

        return "\n".join(result)

    @staticmethod
    def _stats_to_proto(stats: List[CacheStat]) -> MetricSetProto:
        metric_set = MetricSetProto()

        metric_family = metric_set.metric_families.add()
        metric_family.name = "cache_memory_bytes"
        metric_family.type = GAUGE
        metric_family.unit = "bytes"
        metric_family.help = "Total memory consumed by a cache."

        for stat in stats:
            metric_proto = metric_family.metrics.add()
            stat.marshall_metric_proto(metric_proto)

        metric_set = MetricSetProto()
        metric_set.metric_families.append(metric_family)
        return metric_set
