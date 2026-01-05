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

from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
from streamlit.util import repr_


# We inherit from BaseException to avoid being caught by user code.
# For example, having it inherit from Exception might make st.rerun not
# work in a try/except block.
class ScriptControlException(BaseException):  # NOSONAR
    """Base exception for ScriptRunner."""

    pass


class StopException(ScriptControlException):
    """Silently stop the execution of the user's script."""

    pass


class RerunException(ScriptControlException):
    """Silently stop and rerun the user's script."""

    def __init__(self, rerun_data: RerunData) -> None:
        """Construct a RerunException.

        Parameters
        ----------
        rerun_data : RerunData
            The RerunData that should be used to rerun the script
        """
        self.rerun_data = rerun_data

    def __repr__(self) -> str:
        return repr_(self)
