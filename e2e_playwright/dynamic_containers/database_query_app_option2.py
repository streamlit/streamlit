# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
Database Query Application - Option 2 API.

Uses: Function arguments with args/kwargs

Demonstrates lazy execution for database queries across multiple tabs.
Only the active tab's query executes, reducing load time from ~5s to ~1s.

NOTE: This API is not yet implemented - this is a conceptual demo.
"""

from __future__ import annotations

import random
import time
from datetime import datetime
from typing import Any

import pandas as pd

import streamlit as st


# Mock database query functions
def query_sales_data() -> pd.DataFrame:
    """Simulate expensive sales data query."""
    with st.status("Executing sales query...", expanded=True) as status:
        time.sleep(1)  # Simulate query time

        dates = pd.date_range(end=datetime.now(), periods=100)
        data = pd.DataFrame(
            {
                "date": dates,
                "revenue": [random.randint(10000, 50000) for _ in range(100)],
                "orders": [random.randint(100, 500) for _ in range(100)],
            }
        )
        status.update(label="Sales query complete!", state="complete", expanded=False)
        return data


def query_customer_data() -> pd.DataFrame:
    """Simulate expensive customer data query."""
    with st.status("Executing customer query...", expanded=True) as status:
        time.sleep(1)

        data = pd.DataFrame(
            {
                "customer_id": range(1, 51),
                "name": [f"Customer {i}" for i in range(1, 51)],
                "lifetime_value": [random.randint(1000, 10000) for _ in range(50)],
                "segment": [
                    random.choice(["Premium", "Standard", "Basic"]) for _ in range(50)
                ],
            }
        )
        status.update(
            label="Customer query complete!", state="complete", expanded=False
        )
        return data


def query_inventory_data() -> pd.DataFrame:
    """Simulate expensive inventory query."""
    with st.status("Executing inventory query...", expanded=True) as status:
        time.sleep(1)

        data = pd.DataFrame(
            {
                "product_id": range(1, 31),
                "product_name": [f"Product {i}" for i in range(1, 31)],
                "stock": [random.randint(0, 1000) for _ in range(30)],
                "status": [
                    random.choice(["In Stock", "Low Stock", "Out of Stock"])
                    for _ in range(30)
                ],
            }
        )
        status.update(
            label="Inventory query complete!", state="complete", expanded=False
        )
        return data


def query_analytics_data() -> pd.DataFrame:
    """Simulate expensive analytics query."""
    with st.status("Executing analytics query...", expanded=True) as status:
        time.sleep(1)

        data = pd.DataFrame(
            {
                "metric": [
                    "Page Views",
                    "Unique Visitors",
                    "Bounce Rate",
                    "Avg Session Duration",
                    "Conversion Rate",
                ],
                "value": [
                    random.randint(10000, 100000),
                    random.randint(5000, 50000),
                    round(random.uniform(20, 60), 2),
                    round(random.uniform(60, 300), 2),
                    round(random.uniform(1, 10), 2),
                ],
                "change": [
                    f"+{random.randint(1, 20)}%"
                    if random.random() > 0.3
                    else f"-{random.randint(1, 20)}%"
                    for _ in range(5)
                ],
            }
        )
        status.update(
            label="Analytics query complete!", state="complete", expanded=False
        )
        return data


def query_employee_data() -> pd.DataFrame:
    """Simulate expensive employee data query."""
    with st.status("Executing employee query...", expanded=True) as status:
        time.sleep(1)

        data = pd.DataFrame(
            {
                "employee_id": range(1, 41),
                "name": [f"Employee {i}" for i in range(1, 41)],
                "department": [
                    random.choice(["Sales", "Engineering", "Marketing", "Support"])
                    for _ in range(40)
                ],
                "performance_score": [random.randint(60, 100) for _ in range(40)],
            }
        )
        status.update(
            label="Employee query complete!", state="complete", expanded=False
        )
        return data


# Tab content functions (Option 2 pattern)
def show_sales_tab(_tab: Any) -> None:
    """Sales dashboard content."""
    st.header("Sales Dashboard")

    col1, col2, col3 = st.columns(3)

    # Execute query (automatically lazy with Option 2)
    sales_df = query_sales_data()

    with col1:
        st.metric("Total Revenue", f"${sales_df['revenue'].sum():,.0f}")
    with col2:
        st.metric("Total Orders", f"{sales_df['orders'].sum():,.0f}")
    with col3:
        avg_order_value = sales_df["revenue"].sum() / sales_df["orders"].sum()
        st.metric("Avg Order Value", f"${avg_order_value:.2f}")

    st.subheader("Revenue Trend")
    st.line_chart(sales_df.set_index("date")["revenue"])

    st.subheader("Recent Sales Data")
    st.dataframe(sales_df.tail(10), use_container_width=True)

    if st.button("🔄 Refresh Sales Data", key="refresh_sales"):
        st.rerun()


def show_customer_tab(_tab: Any) -> None:
    """Customer analytics content."""
    st.header("Customer Analytics")

    customer_df = query_customer_data()

    col1, col2 = st.columns(2)

    with col1:
        st.metric("Total Customers", len(customer_df))
        st.metric("Avg Lifetime Value", f"${customer_df['lifetime_value'].mean():,.2f}")

    with col2:
        segment_counts = customer_df["segment"].value_counts()
        st.subheader("Customer Segments")
        st.bar_chart(segment_counts)

    st.subheader("Top 10 Customers by Lifetime Value")
    top_customers = customer_df.nlargest(10, "lifetime_value")
    st.dataframe(top_customers, use_container_width=True)

    if st.button("🔄 Refresh Customer Data", key="refresh_customers"):
        st.rerun()


def show_inventory_tab(_tab: Any) -> None:
    """Inventory management content."""
    st.header("Inventory Management")

    inventory_df = query_inventory_data()

    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Total Products", len(inventory_df))
    with col2:
        in_stock = (inventory_df["status"] == "In Stock").sum()
        st.metric("In Stock", in_stock)
    with col3:
        out_of_stock = (inventory_df["status"] == "Out of Stock").sum()
        st.metric(
            "Out of Stock",
            out_of_stock,
            delta=f"-{out_of_stock}",
            delta_color="inverse",
        )

    st.subheader("Inventory Status")
    st.dataframe(
        inventory_df.sort_values("stock"),
        use_container_width=True,
        column_config={
            "stock": st.column_config.ProgressColumn(
                "Stock Level",
                min_value=0,
                max_value=1000,
            )
        },
    )

    # Alert for low stock items
    low_stock = inventory_df[inventory_df["status"] == "Low Stock"]
    if not low_stock.empty:
        st.warning(f"⚠️ {len(low_stock)} items are low on stock!")

    if st.button("🔄 Refresh Inventory Data", key="refresh_inventory"):
        st.rerun()


def show_analytics_tab(_tab: Any) -> None:
    """Web analytics content."""
    st.header("Web Analytics")

    analytics_df = query_analytics_data()

    st.subheader("Key Metrics")

    # Display metrics in a grid
    cols = st.columns(len(analytics_df))
    for idx, (col, row) in enumerate(zip(cols, analytics_df.itertuples(), strict=True)):
        with col:
            st.metric(
                str(row.metric),
                f"{row.value:,.0f}" if idx < 2 else f"{row.value}",
                delta=str(row.change),
            )

    st.subheader("Detailed Analytics")
    st.dataframe(analytics_df, use_container_width=True)

    if st.button("🔄 Refresh Analytics Data", key="refresh_analytics"):
        st.rerun()


def show_employee_tab(_tab: Any) -> None:
    """Employee performance content."""
    st.header("Employee Performance")

    employee_df = query_employee_data()

    col1, col2 = st.columns(2)

    with col1:
        st.metric("Total Employees", len(employee_df))
        st.metric(
            "Avg Performance Score", f"{employee_df['performance_score'].mean():.1f}"
        )

    with col2:
        dept_counts = employee_df["department"].value_counts()
        st.subheader("Department Distribution")
        st.bar_chart(dept_counts)

    st.subheader("Top Performers")
    top_performers = employee_df.nlargest(10, "performance_score")
    st.dataframe(top_performers, use_container_width=True)

    st.subheader("Performance Distribution")
    st.bar_chart(employee_df["performance_score"].value_counts().sort_index())

    if st.button("🔄 Refresh Employee Data", key="refresh_employees"):
        st.rerun()


# App header
st.title("📊 Business Intelligence Dashboard")
st.markdown("**Option 2 API:** Using function arguments (conceptual)")
st.warning(
    "⚠️ **Note:** This API is not yet implemented. This is a demonstration of how it would work."
)

# Performance tracking
start_time = time.time()

# Create tabs with function arguments (Option 2)
# Each function is called ONLY when its tab is active
st.tabs(
    {
        "📈 Sales": show_sales_tab,
        "👥 Customers": show_customer_tab,
        "📦 Inventory": show_inventory_tab,
        "📊 Analytics": show_analytics_tab,
        "👔 Employees": show_employee_tab,
    },
    key="db_tabs",
)

# Performance summary
end_time = time.time()
execution_time = end_time - start_time

st.divider()
st.success(f"✅ Page loaded in **{execution_time:.2f}s** (only 1 query executed)")
st.caption("💡 Without lazy execution, all 5 queries would run (~5 seconds total)")

with st.expander("📝 API Pattern"):
    st.markdown("""
    ```python
    # Define tab content as functions
    def show_sales_tab(tab):
        expensive_query()  # Automatically lazy

    def show_customers_tab(tab):
        another_query()  # Automatically lazy

    # Pass functions to st.tabs - automatic lazy execution
    st.tabs({"Sales": show_sales_tab, "Customers": show_customers_tab})
    ```
    """)
