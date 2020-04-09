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

"""Streamlit support for GraphViz charts."""

from streamlit import type_util
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


def marshall(proto, figure_or_dot, use_container_width):
    """Construct a GraphViz chart object.

    See DeltaGenerator.graphviz_chart for docs.
    """

    if type_util.is_graphviz_chart(figure_or_dot):
        dot = figure_or_dot.source
    elif isinstance(figure_or_dot, str):
        dot = figure_or_dot
    else:
        raise Exception("Unhandled type for graphviz chart: %s" % type(figure_or_dot))

    proto.spec = dot
    proto.use_container_width = use_container_width
