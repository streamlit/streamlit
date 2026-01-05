# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

from typing import TYPE_CHECKING, cast

import tornado.web

from streamlit.runtime.stats import metric_type_string_to_proto
from streamlit.web.server import allow_all_cross_origin_requests, is_allowed_origin
from streamlit.web.server.server_util import emit_endpoint_deprecation_notice

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from streamlit.proto.openmetrics_data_model_pb2 import MetricSet as MetricSetProto
    from streamlit.runtime.stats import Stat, StatsManager


class StatsRequestHandler(tornado.web.RequestHandler):
    def initialize(self, stats_manager: StatsManager) -> None:
        self._manager = stats_manager

    def set_default_headers(self) -> None:
        if allow_all_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")
        elif is_allowed_origin(origin := self.request.headers.get("Origin")):
            self.set_header("Access-Control-Allow-Origin", cast("str", origin))

    def options(self) -> None:
        """/OPTIONS handler for preflight CORS checks."""
        self.set_status(204)
        self.finish()

    def get(self) -> None:
        if self.request.uri and "_stcore/" not in self.request.uri:
            emit_endpoint_deprecation_notice(self, new_path="/_stcore/metrics")

        # Allow caller to request specific metric families via query parameter.
        # If no families are specified, all metrics are returned.
        # Example: /_stcore/metrics?families=session_events_total&families=active_sessions
        requested_families = self.get_arguments("families")
        stats = self._manager.get_stats(
            family_names=requested_families if requested_families else None
        )
        # If the request asked for protobuf output, we return a serialized
        # protobuf. Else we return text.
        if "application/x-protobuf" in self.request.headers.get_list("Accept"):
            self.write(self._stats_to_proto(stats).SerializeToString())
            self.set_header("Content-Type", "application/x-protobuf")
            self.set_status(200)
        else:
            self.write(self._stats_to_text(stats))
            self.set_header("Content-Type", "application/openmetrics-text")
            self.set_status(200)

    @staticmethod
    def _stats_to_text(stats_by_family: Mapping[str, Sequence[Stat]]) -> str:
        result: list[str] = []

        for stats in stats_by_family.values():
            if not stats:
                continue

            # All of the stats in a family will have the same family_name, type,
            # unit, and help text, so we can just use the first one to construct
            # our OpenMetrics comments.
            first_stat = stats[0]
            result.append(f"# TYPE {first_stat.family_name} {first_stat.type}")
            result.append(f"# UNIT {first_stat.family_name} {first_stat.unit}")
            result.append(f"# HELP {first_stat.help}")
            result.extend(stat.to_metric_str() for stat in stats)

        result.append("# EOF\n")
        return "\n".join(result)

    @staticmethod
    def _stats_to_proto(
        stats_by_family: Mapping[str, Sequence[Stat]],
    ) -> MetricSetProto:
        # Lazy load the import of this proto message for better performance:
        from streamlit.proto.openmetrics_data_model_pb2 import (
            MetricSet as MetricSetProto,
        )

        metric_set = MetricSetProto()

        for stats in stats_by_family.values():
            if not stats:
                continue

            # All of the stats in a family will have the same family_name, type,
            # unit, and help text, so we can just use the first one to fill in
            # these metric_family fields.
            first_stat = stats[0]
            metric_family = metric_set.metric_families.add()
            metric_family.name = first_stat.family_name
            metric_family.type = metric_type_string_to_proto(first_stat.type)
            metric_family.unit = first_stat.unit
            metric_family.help = first_stat.help

            for stat in stats:
                metric_proto = metric_family.metrics.add()
                stat.marshall_metric_proto(metric_proto)

        return metric_set
