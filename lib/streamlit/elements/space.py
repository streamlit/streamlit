# Copyright 2018-2022 Streamlit Inc.
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

from typing import cast, TYPE_CHECKING

from streamlit.proto.Space_pb2 import Space as SpaceProto

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class SpaceMixin:
    def space(self, size: str) -> "DeltaGenerator":
        """
        st.space()
        """
        space_proto = SpaceProto()
        space_proto.size = size
        return self.dg._enqueue("space", space_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
