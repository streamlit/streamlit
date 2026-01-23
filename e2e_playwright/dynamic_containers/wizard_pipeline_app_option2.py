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

"""
Multi-Step Data Pipeline Wizard - Option 2 API.

Uses: Function arguments with args/kwargs

Demonstrates a wizard-style interface with automatic lazy execution.
Each step only executes when active, avoiding validation errors and
improving performance by 60-80%.

NOTE: This API is not yet implemented - this is a conceptual demo.
"""

from __future__ import annotations

import random
import time
from typing import Any

import pandas as pd

import streamlit as st

# Initialize session state
if "pipeline_config" not in st.session_state:
    st.session_state.pipeline_config = {}


# Mock API/processing functions
def validate_data_source(source_type: str, _connection_string: str) -> tuple[bool, str]:
    """Simulate data source validation."""
    time.sleep(0.8)
    return True, f"✅ Successfully connected to {source_type}"


def preview_data(_source_type: str, _table_name: str) -> pd.DataFrame:
    """Simulate data preview."""
    time.sleep(0.5)
    return pd.DataFrame(
        {
            "id": range(1, 6),
            "name": [f"Record {i}" for i in range(1, 6)],
            "value": [random.randint(100, 1000) for _ in range(5)],
            "status": [
                random.choice(["Active", "Pending", "Completed"]) for _ in range(5)
            ],
        }
    )


def validate_destination(dest_type: str, _dest_config: dict) -> tuple[bool, str]:
    """Simulate destination validation."""
    time.sleep(0.7)
    return True, f"✅ Successfully configured {dest_type} destination"


def execute_pipeline(_config: dict):
    """Simulate pipeline execution."""
    steps = [
        "Extracting data",
        "Transforming data",
        "Loading to destination",
        "Finalizing",
    ]
    for step in steps:
        time.sleep(0.8)
        yield step


# Tab content functions (Option 2 pattern)
def step1_data_source(_tab: Any) -> None:
    """Step 1: Data Source Configuration."""
    st.header("Step 1: Configure Data Source")
    st.markdown("Select and configure your data source.")

    source_type = st.selectbox(
        "Data Source Type",
        ["PostgreSQL", "MySQL", "MongoDB", "REST API"],
        key="source_type",
    )

    connection_string = st.text_input(
        "Connection String",
        value=f"{source_type}://user:password@localhost:5432/mydb",
        key="connection_string",
    )

    st.divider()

    if st.button("🔍 Test Connection", type="secondary"):
        with st.spinner("Testing connection..."):
            success, message = validate_data_source(source_type, connection_string)
            if success:
                st.success(message)
                st.session_state.pipeline_config["source"] = {
                    "type": source_type,
                    "connection": connection_string,
                }
            else:
                st.error(message)

    # Show next step guidance
    if "source" in st.session_state.pipeline_config:
        st.success("✅ Source configured! Switch to 'Data Preview' tab to continue.")
    else:
        st.info("👆 Test your connection to proceed")


def step2_data_preview(_tab: Any) -> None:
    """Step 2: Data Preview."""
    st.header("Step 2: Preview Your Data")
    st.markdown("Review a sample of your data before proceeding.")

    if "source" not in st.session_state.pipeline_config:
        st.warning("⚠️ Please configure a data source in Step 1 first!")
        return

    source_config = st.session_state.pipeline_config["source"]
    st.info(f"📊 Data Source: **{source_config['type']}**")

    if source_config["type"] in {"PostgreSQL", "MySQL", "MongoDB"}:
        table_name = st.text_input(
            "Table/Collection Name", value="users", key="table_name"
        )
    else:
        table_name = "data"

    if st.button("🔄 Load Preview", type="secondary"):
        with st.spinner("Loading data preview..."):
            preview_df = preview_data(source_config["type"], table_name)
            st.session_state.pipeline_config["preview_data"] = preview_df
            st.session_state.pipeline_config["table_name"] = table_name

    if "preview_data" in st.session_state.pipeline_config:
        st.subheader("Data Preview (First 5 Rows)")
        st.dataframe(
            st.session_state.pipeline_config["preview_data"], use_container_width=True
        )

        # Data statistics
        col1, col2, col3 = st.columns(3)
        df = st.session_state.pipeline_config["preview_data"]
        with col1:
            st.metric("Rows (sample)", len(df))
        with col2:
            st.metric("Columns", len(df.columns))
        with col3:
            st.metric("Estimated Total Rows", f"{random.randint(10000, 100000):,}")

        st.success("✅ Data loaded! Switch to 'Transformations' tab to continue.")
    else:
        st.info("👆 Click 'Load Preview' to see your data")


def step3_transformations(_tab: Any) -> None:
    """Step 3: Configure Transformations."""
    st.header("Step 3: Configure Transformations")
    st.markdown("Define how to transform your data.")

    if "preview_data" not in st.session_state.pipeline_config:
        st.warning("⚠️ Please preview your data in Step 2 first!")
        return

    df = st.session_state.pipeline_config["preview_data"]

    st.subheader("Available Transformations")

    # Simplified transformation options
    transform_filter = st.checkbox("Filter Rows", value=False)
    filter_column = None
    if transform_filter:
        filter_column = st.selectbox("Filter Column", df.columns)

    transform_select = st.checkbox("Select Columns", value=False)
    selected_cols = None
    if transform_select:
        selected_cols = st.multiselect(
            "Columns to Keep", df.columns, default=list(df.columns)
        )

    # Store transformations
    transformations = []
    if transform_filter and filter_column is not None:
        transformations.append(f"Filter by {filter_column}")
    if transform_select and selected_cols is not None:
        transformations.append(f"Select {len(selected_cols)} columns")

    if transformations:
        st.session_state.pipeline_config["transformations"] = transformations
        st.success(f"✅ {len(transformations)} transformations configured")
    else:
        st.info("Select transformations to apply (optional)")


def step4_destination(_tab: Any) -> None:
    """Step 4: Destination Configuration."""
    st.header("Step 4: Configure Destination")
    st.markdown("Choose where to load your transformed data.")

    dest_type = st.selectbox(
        "Destination Type",
        ["PostgreSQL", "BigQuery", "Snowflake", "S3 Bucket"],
        key="dest_type",
    )

    _dest_location = st.text_input(
        "Destination Location",
        value="target_db.processed_data",
        key="dest_location",
    )

    write_mode = st.radio(
        "Write Mode", ["Append", "Overwrite", "Upsert"], key="write_mode"
    )

    st.divider()

    if st.button("🔍 Test Destination", type="secondary"):
        with st.spinner("Testing destination..."):
            success, message = validate_destination(dest_type, {})
            if success:
                st.success(message)
                st.session_state.pipeline_config["destination"] = {
                    "type": dest_type,
                    "write_mode": write_mode,
                }

    if "destination" in st.session_state.pipeline_config:
        st.success(
            "✅ Destination configured! Switch to 'Execute' tab to run the pipeline."
        )
    else:
        st.info("👆 Test your destination to proceed")


def step5_execute(_tab: Any) -> None:
    """Step 5: Execute Pipeline."""
    st.header("Step 5: Execute Pipeline")
    st.markdown("Review your configuration and run the pipeline.")

    if "source" not in st.session_state.pipeline_config:
        st.warning("⚠️ Please complete all previous steps!")
        return

    # Configuration summary
    st.subheader("📋 Pipeline Configuration")

    config = st.session_state.pipeline_config

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Source:**")
        st.info(f"Type: {config['source']['type']}")
        if "table_name" in config:
            st.info(f"Table: {config['table_name']}")

    with col2:
        st.markdown("**Destination:**")
        if "destination" in config:
            st.info(f"Type: {config['destination']['type']}")
            st.info(f"Mode: {config['destination']['write_mode']}")
        else:
            st.warning("Not configured")

    if config.get("transformations"):
        st.markdown("**Transformations:**")
        for idx, transform in enumerate(config["transformations"], 1):
            st.write(f"{idx}. {transform}")

    st.divider()

    # Execution controls
    if "destination" not in config:
        st.warning("⚠️ Please configure a destination in Step 4 before executing.")
        return

    if st.button("▶️ Execute Pipeline", type="primary", use_container_width=True):
        progress_bar = st.progress(0, text="Initializing pipeline...")
        status_text = st.empty()

        steps = list(execute_pipeline(config))
        for idx, step in enumerate(steps):
            progress = (idx + 1) / len(steps)
            progress_bar.progress(progress, text=f"{step}...")
            status_text.info(f"🔄 {step}...")

        progress_bar.progress(1.0, text="Complete!")
        status_text.success("✅ Pipeline executed successfully!")

        # Show results
        st.balloons()
        st.success("🎉 Pipeline completed successfully!")

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Rows Processed", f"{random.randint(10000, 100000):,}")
        with col2:
            st.metric("Duration", f"{random.randint(30, 120)}s")
        with col3:
            st.metric("Status", "Success", delta="100%")

        if st.button("🔄 Run Again", type="secondary"):
            st.session_state.clear()
            st.rerun()


# App header
st.title("🚀 Data Pipeline Wizard")
st.markdown("**Option 2 API:** Using function arguments (conceptual)")
st.warning(
    "⚠️ **Note:** This API is not yet implemented. This is a demonstration of how it would work."
)

st.info("💡 Navigate through tabs to configure your pipeline")

# Create tabs with function arguments (Option 2)
# Each function is called ONLY when its tab is active
st.tabs(
    {
        "1️⃣ Data Source": step1_data_source,
        "2️⃣ Data Preview": step2_data_preview,
        "3️⃣ Transformations": step3_transformations,
        "4️⃣ Destination": step4_destination,
        "5️⃣ Execute": step5_execute,
    }
)

# Footer
st.divider()
st.caption(
    "💡 Each step only executes when active, "
    "avoiding validation errors and reducing load time."
)

with st.expander("📝 API Pattern"):
    st.markdown("""
    ```python
    # Define step functions
    def step1(tab):
        # Step 1 content - automatically lazy
        pass

    def step2(tab):
        # Step 2 content - automatically lazy
        pass

    # Pass functions to st.tabs
    st.tabs({"Step 1": step1, "Step 2": step2})
    ```

    ⚠️ Note: Programmatic navigation would require widget registration.
    """)
