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

from streamlit import config
from streamlit import util
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class MockMetric(object):
    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, *args, **kwargs):
        pass

    def labels(self, *args, **kwargs):
        return self

    def inc(self, *args, **kwargs):
        pass

    def dec(self, *args, **kwargs):
        pass

    def set(self, *args, **kwargs):
        pass


class Client(object):

    _singleton = None

    @classmethod
    def get(cls, metric):
        client = cls.get_current()
        return client._metrics.get(metric)

    @classmethod
    def get_current(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            Client()

        return Client._singleton

    def __init__(self):
        if Client._singleton is not None:
            raise RuntimeError("Client already initialized. Use .get_current() instead")

        Client._singleton = self

        # yapf: disable
        self._raw_metrics  = [
            ('Counter', 'streamlit_enqueue_deltas_total', 'Total deltas enqueued', ['type']),
        ]
        # yapf: enable

        self.toggle_metrics()

    def __repr__(self) -> str:
        return util.repr_(self)

    def toggle_metrics(self):
        self._metrics = {}

        if config.get_option("global.metrics"):
            try:
                import prometheus_client
            except ImportError as e:
                raise ImportError(
                    "prometheus-client is not installed. pip install prometheus-client"
                )
            self.generate_latest = prometheus_client.generate_latest

            existing_metrics = (
                prometheus_client.registry.REGISTRY._names_to_collectors.keys()
            )

            for kind, metric, doc, labels in self._raw_metrics:
                if metric in existing_metrics:
                    continue
                p = getattr(prometheus_client, kind)
                self._metrics[metric] = p(metric, doc, labels)
        else:
            self.generate_latest = lambda: ""
            for _, metric, _, _ in self._raw_metrics:
                self._metrics[metric] = MockMetric()
