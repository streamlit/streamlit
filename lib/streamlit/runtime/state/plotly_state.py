# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


class PlotlyState:
    plotly_state = {}

    def get_plotly_chart(self, id: str):
        print(f"Reading a plotly chart: {self.plotly_state[id]}")
        return self.plotly_state[id]

    def register_plotly_chart(self, id: str, value: dict):
        self.plotly_state[id] = value
        print(f"Registered a plotly chart: {self.plotly_state}")

    def update_plotly_chart(self, id: str, value: dict):
        self.plotly_state[id] = value
        print(f"Updated plotly chart: {self.plotly_state}")

    def delete_plotly_chart(self, id: str):
        del self.plotly_state[id]
        print(f"Deleted a plotly chart: {self.plotly_state}")
