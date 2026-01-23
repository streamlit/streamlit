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
Multi-Step Data Pipeline Wizard - Option 1b API.

Uses: .open attribute + on_change="rerun"

Demonstrates a wizard-style interface with programmatic navigation.
Each step only executes when active, avoiding validation errors and
improving performance by 60-80%.
"""

from __future__ import annotations

import random
import time

import pandas as pd

import streamlit as st

# Initialize session state
if "wizard_step" not in st.session_state:
    st.session_state.wizard_step = "1️⃣ Data Source"  # Tab label
if "pipeline_config" not in st.session_state:
    st.session_state.pipeline_config = {}
if "validation_passed" not in st.session_state:
    st.session_state.validation_passed = {}


# Navigation callbacks
def goto_step(step_label: str) -> None:
    """Navigate to a specific step."""
    st.session_state.wizard_step = step_label


def next_step(current_step_label: str, next_step_label: str) -> None:
    """Validate and move to next step."""
    # Mark current step as validated
    st.session_state.validation_passed[current_step_label] = True
    st.session_state.wizard_step = next_step_label


def previous_step(prev_step_label: str) -> None:
    """Go back to previous step."""
    st.session_state.wizard_step = prev_step_label


# Mock API/processing functions
def validate_data_source(source_type: str, _connection_string: str) -> tuple[bool, str]:
    """Simulate data source validation."""
    time.sleep(0.8)
    # Mock validation
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


def apply_transformations(data: pd.DataFrame, _transformations: list) -> pd.DataFrame:
    """Simulate data transformations."""
    time.sleep(0.6)
    # Mock transformation
    return data.copy()


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


# App header
st.title("🚀 Data Pipeline Wizard")
st.markdown(
    "**Option 1b API:** Using `.open` attribute + `on_change='rerun'` with programmatic navigation"
)

# Progress indicator
step_names = [
    "1️⃣ Data Source",
    "2️⃣ Data Preview",
    "3️⃣ Transformations",
    "4️⃣ Destination",
    "5️⃣ Execute",
]
current_step_idx = step_names.index(st.session_state.wizard_step)
progress = (current_step_idx + 1) / len(step_names)

st.progress(
    progress, text=f"Progress: Step {current_step_idx + 1} of {len(step_names)}"
)

st.info(
    "💡 **Note:** This wizard demonstrates Option 1b with lazy execution. "
    "Navigate through the steps using the tab headers above. "
    "Each step only executes when you switch to it."
)
st.divider()

# Create tabs with lazy execution
tabs = st.tabs(
    [
        "1️⃣ Data Source",
        "2️⃣ Data Preview",
        "3️⃣ Transformations",
        "4️⃣ Destination",
        "5️⃣ Execute",
    ],
    key="wizard_step",
    on_change="rerun",
)

# Step 1: Data Source Configuration
if tabs[0].open:
    with tabs[0]:
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

        col1, col2 = st.columns([1, 4])
        with col1:
            if st.button(
                "🔍 Test Connection", type="secondary", use_container_width=True
            ):
                with st.spinner("Testing connection..."):
                    success, message = validate_data_source(
                        source_type, connection_string
                    )
                    if success:
                        st.success(message)
                        st.session_state.pipeline_config["source"] = {
                            "type": source_type,
                            "connection": connection_string,
                        }
                    else:
                        st.error(message)

        with col2:
            # Only allow next if connection tested
            if "source" in st.session_state.pipeline_config:
                st.button(
                    "Next: Data Preview →",
                    type="primary",
                    use_container_width=True,
                    on_click=next_step,
                    args=("1️⃣ Data Source", "2️⃣ Data Preview"),
                )
            else:
                st.button(
                    "Next: Data Preview →",
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                )
                st.caption("⚠️ Please test the connection first")

# Step 2: Data Preview
if tabs[1].open:
    with tabs[1]:
        st.header("Step 2: Preview Your Data")
        st.markdown("Review a sample of your data before proceeding.")

        if "source" not in st.session_state.pipeline_config:
            st.warning("⚠️ Please configure a data source in Step 1 first!")
        else:
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
                    st.session_state.pipeline_config["preview_data"],
                    use_container_width=True,
                )

                # Data statistics
                col1, col2, col3 = st.columns(3)
                df = st.session_state.pipeline_config["preview_data"]
                with col1:
                    st.metric("Rows (sample)", len(df))
                with col2:
                    st.metric("Columns", len(df.columns))
                with col3:
                    st.metric(
                        "Estimated Total Rows", f"{random.randint(10000, 100000):,}"
                    )

                st.divider()

                col1, col2 = st.columns(2)
                with col1:
                    st.button(
                        "← Previous",
                        use_container_width=True,
                        on_click=previous_step,
                        args=("1️⃣ Data Source",),
                    )
                with col2:
                    st.button(
                        "Next: Transformations →",
                        type="primary",
                        use_container_width=True,
                        on_click=next_step,
                        args=("2️⃣ Data Preview", "3️⃣ Transformations"),
                    )
            else:
                st.info("👆 Click 'Load Preview' to see your data")

# Step 3: Transformations
if tabs[2].open:
    with tabs[2]:
        st.header("Step 3: Configure Transformations")
        st.markdown("Define how to transform your data.")

        if "preview_data" not in st.session_state.pipeline_config:
            st.warning("⚠️ Please preview your data in Step 2 first!")
        else:
            df = st.session_state.pipeline_config["preview_data"]

            st.subheader("Available Transformations")

            transform_filter = st.checkbox("Filter Rows", value=False)
            if transform_filter:
                filter_column = st.selectbox("Filter Column", df.columns)

            transform_select = st.checkbox("Select Columns", value=False)
            if transform_select:
                selected_cols = st.multiselect(
                    "Columns to Keep", df.columns, default=list(df.columns)
                )

            # Store transformations
            transformations = []
            if transform_filter:
                transformations.append(f"Filter by {filter_column}")
            if transform_select:
                transformations.append(f"Select {len(selected_cols)} columns")

            if transformations:
                st.session_state.pipeline_config["transformations"] = transformations
                st.success(f"✅ {len(transformations)} transformations configured")

            st.divider()

            col1, col2 = st.columns(2)
            with col1:
                st.button(
                    "← Previous",
                    use_container_width=True,
                    on_click=previous_step,
                    args=("2️⃣ Data Preview",),
                )
            with col2:
                st.button(
                    "Next: Destination →",
                    type="primary",
                    use_container_width=True,
                    on_click=next_step,
                    args=("3️⃣ Transformations", "4️⃣ Destination"),
                )

# Step 4: Destination Configuration
if tabs[3].open:
    with tabs[3]:
        st.header("Step 4: Configure Destination")
        st.markdown("Choose where to load your transformed data.")

        dest_type = st.selectbox(
            "Destination Type",
            ["PostgreSQL", "BigQuery", "Snowflake", "S3 Bucket"],
            key="dest_type",
        )

        dest_location = st.text_input(
            "Destination Location",
            value="target_db.processed_data",
            key="dest_location",
        )

        write_mode = st.radio(
            "Write Mode", ["Append", "Overwrite", "Upsert"], key="write_mode"
        )

        st.divider()

        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            st.button(
                "← Previous",
                use_container_width=True,
                on_click=previous_step,
                args=("3️⃣ Transformations",),
            )

        with col2:
            if st.button(
                "🔍 Test Destination", type="secondary", use_container_width=True
            ):
                with st.spinner("Testing destination..."):
                    success, message = validate_destination(dest_type, {})
                    if success:
                        st.success(message)
                        st.session_state.pipeline_config["destination"] = {
                            "type": dest_type,
                            "write_mode": write_mode,
                        }

        with col3:
            if "destination" in st.session_state.pipeline_config:
                st.button(
                    "Next: Execute Pipeline →",
                    type="primary",
                    use_container_width=True,
                    on_click=next_step,
                    args=("4️⃣ Destination", "5️⃣ Execute"),
                )
            else:
                st.button(
                    "Next: Execute Pipeline →",
                    type="primary",
                    use_container_width=True,
                    disabled=True,
                )
                st.caption("⚠️ Please test the destination first")

# Step 5: Execute Pipeline
if tabs[4].open:
    with tabs[4]:
        st.header("Step 5: Execute Pipeline")
        st.markdown("Review your configuration and run the pipeline.")

        if "source" not in st.session_state.pipeline_config:
            st.warning("⚠️ Please complete all previous steps!")
        else:
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

            if config.get("transformations"):
                st.markdown("**Transformations:**")
                for idx, transform in enumerate(config["transformations"], 1):
                    st.write(f"{idx}. {transform}")

            st.divider()

            # Execution controls
            col1, col2 = st.columns([1, 2])
            with col1:
                st.button(
                    "← Previous",
                    use_container_width=True,
                    on_click=previous_step,
                    args=("4️⃣ Destination",),
                )

            with col2:
                if st.button(
                    "▶️ Execute Pipeline", type="primary", use_container_width=True
                ):
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
                        st.metric(
                            "Rows Processed", f"{random.randint(10000, 100000):,}"
                        )
                    with col2:
                        st.metric("Duration", f"{random.randint(30, 120)}s")
                    with col3:
                        st.metric("Status", "Success", delta="100%")

                    if st.button("🔄 Run Again", type="secondary"):
                        st.session_state.clear()
                        st.rerun()

# Footer
st.divider()
st.caption(
    "💡 Each step only executes when active, "
    "avoiding validation errors and reducing load time."
)

with st.expander("📝 API Pattern"):
    st.markdown("""
    ```python
    # Define navigation callback
    def goto_step_2():
        st.session_state.wizard = "Step 2"

    # Navigation button BEFORE tabs
    st.button("Next", on_click=goto_step_2)

    # Create tabs with key and on_change
    tabs = st.tabs(["Step 1", "Step 2"], key="wizard", on_change="rerun")

    # Only execute active step
    if tabs[0].open:
        with tabs[0]:
            # Step 1 content

    if tabs[1].open:
        with tabs[1]:
            # Step 2 content - only runs when active
    ```
    """)
