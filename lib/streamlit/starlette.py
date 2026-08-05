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

"""Starlette integration for Streamlit.

This module provides the ASGI-compatible App class for running Streamlit
applications with any ASGI server (uvicorn, hypercorn, etc.).

Example
-------
>>> import streamlit as st
>>> def main():
...     st.title("My app")
>>> app = st.App(main)
>>> if __name__ == "__main__":
...     app.run()

Run the same file with Streamlit or Python (using ``uv`` here):

.. code-block:: bash

    streamlit run myapp.py
    uv run myapp.py

Or serve the ASGI app with uvicorn:

.. code-block:: bash

    uvicorn myapp:app --host 0.0.0.0 --port 8501

The callable object is retained for the lifetime of the app. Restart the
process after changing its definition.
"""

from streamlit.web.server.starlette.starlette_app import App

__all__ = ["App"]
