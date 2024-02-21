# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import TYPE_CHECKING, Optional, cast

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto
from streamlit.proto.Skeleton_pb2 import SkeletonType
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class SkeletonMixin:
    @gather_metrics("skeleton")
    def skeleton(self, *, height: Optional[int] = None) -> None:
        """Insert a skeleton element into the app to indicate that content is loading.

        Parameters
        ----------
        height : int or None
            Desired height of the container expressed in pixels. If ``None`` (default)
            the container grows to fit its content. If a fixed height, scrolling is
            enabled for large content and a grey border is shown around the container
            to visually separate its scroll surface from the rest of the app.

        Example
        -------
        >>> st.skeleton()
        """
        skeleton_proto = SkeletonProto()
        if height is not None:
            skeleton_proto.height = height
        # Set the type to CUSTOM internally so that we can distinguish it from AppSkeleton
        skeleton_proto.type = SkeletonType.CUSTOM
        return self.dg._enqueue("skeleton", skeleton_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
