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

import itertools
from typing import TYPE_CHECKING, Final, NamedTuple, Protocol, runtime_checkable

CACHE_MEMORY_FAMILY: Final = "cache_memory_bytes"
SESSION_EVENTS_FAMILY: Final = "session_events_total"
SESSION_DURATION_FAMILY: Final = "session_duration_seconds_total"
ACTIVE_SESSIONS_FAMILY: Final = "active_sessions"

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from streamlit.proto.openmetrics_data_model_pb2 import (
        Metric as MetricProto,
    )
    from streamlit.proto.openmetrics_data_model_pb2 import (
        MetricType,
    )


@runtime_checkable
class Stat(Protocol):
    """Protocol for a stat that can be serialized to OpenMetrics format.

    All stats must have these fields to identify the metric family they belong to
    and provide metadata for OpenMetrics serialization.
    """

    @property
    def family_name(self) -> str:
        """The name of the metric family (e.g. 'cache_memory_bytes')."""

    @property
    def type(self) -> str:
        """The OpenMetrics type (e.g. 'gauge', 'counter')."""

    @property
    def unit(self) -> str:
        """The unit of the metric (e.g. 'bytes')."""

    @property
    def help(self) -> str:
        """A description of the metric."""

    def to_metric_str(self) -> str:
        """Convert this stat to an OpenMetrics-formatted string."""

    def marshall_metric_proto(self, metric: MetricProto) -> None:
        """Fill an OpenMetrics `Metric` protobuf object."""


# TODO(vdonato): Could we use GaugeStat below and get rid of this class?
# We'd have to make some minor changes to use the other class, but overall the
# changes should be relatively minor.
class CacheStat(NamedTuple):
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

    # Stat Protocol fields with default values for cache metrics
    @property
    def family_name(self) -> str:
        return CACHE_MEMORY_FAMILY

    @property
    def type(self) -> str:
        return "gauge"

    @property
    def unit(self) -> str:
        return "bytes"

    @property
    def help(self) -> str:
        return "Total memory consumed by a cache."

    def to_metric_str(self) -> str:
        return f'{self.family_name}{{cache_type="{self.category_name}",cache="{self.cache_name}"}} {self.byte_length}'

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


def group_cache_stats(stats: list[CacheStat]) -> list[CacheStat]:
    """Group a list of CacheStats by category_name and cache_name and sum byte_length."""

    def key_function(individual_stat: CacheStat) -> tuple[str, str]:
        return individual_stat.category_name, individual_stat.cache_name

    result: list[CacheStat] = []

    sorted_stats = sorted(stats, key=key_function)
    grouped_stats = itertools.groupby(sorted_stats, key=key_function)

    for (category_name, cache_name), single_group_stats in grouped_stats:
        result.append(
            CacheStat(
                category_name=category_name,
                cache_name=cache_name,
                byte_length=sum(item.byte_length for item in single_group_stats),
            )
        )
    return result


class CounterStat(NamedTuple):
    """A counter stat.

    Properties
    ----------
    family_name : str
        The name of the metric family (e.g. 'session_events_total').
    value : int
        The current count value.
    labels : dict[str, str] | None
        Labels to identify this specific counter (e.g. {"type": "connection"}).
    unit : str
        The unit of the metric (e.g. '' for unitless).
    help : str
        A description of the metric.
    """

    family_name: str
    value: int
    labels: dict[str, str] | None = None
    unit: str = ""
    help: str = ""

    @property
    def type(self) -> str:
        return "counter"

    def to_metric_str(self) -> str:
        if self.labels:
            labels_str = ",".join(f'{k}="{v}"' for k, v in sorted(self.labels.items()))
            return f"{self.family_name}{{{labels_str}}} {self.value}"
        return f"{self.family_name} {self.value}"

    def marshall_metric_proto(self, metric: MetricProto) -> None:
        """Fill an OpenMetrics `Metric` protobuf object."""
        if self.labels:
            for name, value in sorted(self.labels.items()):
                label = metric.labels.add()
                label.name = name
                label.value = value

        metric_point = metric.metric_points.add()
        metric_point.counter_value.int_value = self.value


class GaugeStat(NamedTuple):
    """A gauge stat.

    Properties
    ----------
    family_name : str
        The name of the metric family (e.g. 'active_sessions').
    value : int
        The current gauge value.
    labels : dict[str, str] | None
        Optional labels to identify this specific gauge.
    unit : str
        The unit of the metric (e.g. '' for unitless).
    help : str
        A description of the metric.
    """

    family_name: str
    value: int
    labels: dict[str, str] | None = None
    unit: str = ""
    help: str = ""

    @property
    def type(self) -> str:
        return "gauge"

    def to_metric_str(self) -> str:
        if self.labels:
            labels_str = ",".join(f'{k}="{v}"' for k, v in sorted(self.labels.items()))
            return f"{self.family_name}{{{labels_str}}} {self.value}"
        return f"{self.family_name} {self.value}"

    def marshall_metric_proto(self, metric: MetricProto) -> None:
        """Fill an OpenMetrics `Metric` protobuf object."""
        if self.labels:
            for name, value in sorted(self.labels.items()):
                label = metric.labels.add()
                label.name = name
                label.value = value

        metric_point = metric.metric_points.add()
        metric_point.gauge_value.int_value = self.value


def metric_type_string_to_proto(type_string: str) -> MetricType.ValueType:
    """Convert a metric type string to its corresponding proto enum value."""
    from streamlit.proto.openmetrics_data_model_pb2 import (
        COUNTER,
        GAUGE,
        GAUGE_HISTOGRAM,
        HISTOGRAM,
        INFO,
        STATE_SET,
        SUMMARY,
        UNKNOWN,
    )

    type_map = {
        "gauge": GAUGE,
        "counter": COUNTER,
        "state_set": STATE_SET,
        "info": INFO,
        "histogram": HISTOGRAM,
        "gauge_histogram": GAUGE_HISTOGRAM,
        "summary": SUMMARY,
    }
    return type_map.get(type_string, UNKNOWN)


@runtime_checkable
class StatsProvider(Protocol):
    @property
    def stats_families(self) -> Sequence[str]:
        """The metric family names that this provider supports.

        The StatsManager uses this property to determine which providers to call
        when specific metric families are requested.
        """

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> Mapping[str, Sequence[Stat]]:
        """Return stats for the specified metric families.

        Parameters
        ----------
        family_names : Sequence[str] | None
            If provided, only stats for these metric families should be computed
            and returned. If None, stats for all families this provider supports
            should be returned. Providers should check this parameter and skip
            computing expensive stats for families that aren't requested.

        Returns
        -------
        Mapping[str, Sequence[Stat]]
            A mapping from metric family names to sequences of Stat objects.
        """
        raise NotImplementedError


class StatsManager:
    def __init__(self) -> None:
        self._providers_by_family: dict[str, list[StatsProvider]] = {}

    def register_provider(self, provider: StatsProvider) -> None:
        """Register a StatsProvider with the manager.

        This function is not thread-safe. Call it immediately after creation.

        Parameters
        ----------
        provider : StatsProvider
            The stats provider to register. The provider's `stats_families`
            property determines which metric families it will be called for.
        """
        for family in provider.stats_families:
            if family not in self._providers_by_family:
                self._providers_by_family[family] = []
            self._providers_by_family[family].append(provider)

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> Mapping[str, Sequence[Stat]]:
        """Return registered stats grouped by metric family name.

        Parameters
        ----------
        family_names : Sequence[str] | None
            If provided, only stats for these metric families will be returned.
            If None, stats for all registered families are returned.

        Returns
        -------
        Mapping[str, Sequence[Stat]]
            A mapping from metric family names to sequences of Stat objects
            from all providers.
        """
        result: dict[str, Sequence[Stat]] = {}

        families_to_query = family_names or list(self._providers_by_family.keys())

        # Track which providers we've already queried to avoid duplicates.
        # The same provider may be registered for multiple families, and we call
        # `provider.get_stats(family_names)` below to fetch all stat families for
        # a given stats provider at once.
        queried_providers: set[int] = set()

        for family in families_to_query:
            for provider in self._providers_by_family.get(family, []):
                provider_id = id(provider)
                if provider_id in queried_providers:
                    continue
                queried_providers.add(provider_id)

                provider_stats = provider.get_stats(family_names)
                for fname, stats in provider_stats.items():
                    if fname not in result:
                        result[fname] = []
                    # Use list() to convert Sequence to list for concatenation.
                    # This is needed for type covariance: providers return
                    # Mapping[str, Sequence[Stat]] but we build a dict of lists.
                    result[fname] = list(result[fname]) + list(stats)

        return result
