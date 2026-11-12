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

"""Seattle weather dashboard exploring the classic Altair case study dataset."""

import altair as alt
import pandas as pd
import vega_datasets

import streamlit as st

st.set_page_config(
    # Title and icon for the browser's tab bar:
    page_title="Seattle weather",
    page_icon=":material/wb_sunny:",
    # Make the content take up the width of the page:
    layout="wide",
)

# Summary metrics as (label, column, aggregation, unit).
SUMMARY_METRICS = [
    ("Max temperature", "temp_max", "max", "°C"),
    ("Min temperature", "temp_min", "min", "°C"),
    ("Max precipitation", "precipitation", "max", "mm"),
    ("Min precipitation", "precipitation", "min", "mm"),
    ("Max wind", "wind", "max", "m/s"),
    ("Min wind", "wind", "min", "m/s"),
]

WEATHER_ICONS = {
    "sun": ":material/sunny:",
    "snow": ":material/weather_snowy:",
    "rain": ":material/rainy:",
    "fog": ":material/foggy:",
    "drizzle": ":material/rainy:",
}

# Charts that share a row need the same height.
CHART_HEIGHT = 300


@st.cache_data(show_spinner="Loading weather data...")
def load_weather_data() -> pd.DataFrame:
    df: pd.DataFrame = vega_datasets.data("seattle_weather")
    return df


full_df = load_weather_data()

st.title("Seattle weather", icon=":material/wb_sunny:")
st.markdown(
    "Let's explore the [classic Seattle Weather dataset]"
    "(https://altair-viz.github.io/case_studies/exploring-weather.html)!"
)

st.space("medium")
st.header("2015 summary")

df_2015 = full_df[full_df["date"].dt.year == 2015]
df_2014 = full_df[full_df["date"].dt.year == 2014]
weather_counts = df_2015["weather"].value_counts()

with st.grid(4, gap="medium"):
    for label, column, agg, unit in SUMMARY_METRICS:
        value = df_2015[column].agg(agg)
        st.metric(
            label,
            value,
            delta=value - df_2014[column].agg(agg),
            format=f"%.1f {unit}",
            delta_description="vs. 2014",
            border=True,
            height="stretch",
        )
    for label, weather in [
        ("Most common weather", weather_counts.idxmax()),
        ("Least common weather", weather_counts.idxmin()),
    ]:
        st.metric(
            label,
            weather.capitalize(),
            icon=WEATHER_ICONS[weather],
            border=True,
            height="stretch",
        )

st.space("medium")
st.header("Compare different years")

YEARS = full_df["date"].dt.year.unique()
selected_years = st.pills(
    "Years to compare",
    YEARS,
    default=YEARS,
    selection_mode="multi",
    key="years",  # Repeated params: ?years=2014&years=2015
    bind="query-params",
)

if not selected_years:
    st.warning("You must select at least 1 year.", icon=":material/warning:")
    st.stop()

df = full_df[full_df["date"].dt.year.isin(selected_years)]

ratio_cols = st.columns([3, 1])

with ratio_cols[0].container(border=True, height="stretch"):
    st.subheader("Temperature", icon=":material/thermostat:")

    st.altair_chart(
        alt.Chart(df)
        .mark_bar(width=1)
        .encode(
            alt.X("monthdate(date):T").title("date"),
            alt.Y("temp_max:Q").title("temperature range (C)"),
            alt.Y2("temp_min:Q"),
            alt.Color("year(date):N").title("year"),
            alt.XOffset("year(date):N"),
            tooltip=[
                alt.Tooltip("monthdate(date):T", title="Date"),
                alt.Tooltip("temp_max:Q", title="Max temp (C)"),
                alt.Tooltip("temp_min:Q", title="Min temp (C)"),
                alt.Tooltip("year(date):N", title="Year"),
            ],
        )
        .configure_legend(orient="bottom"),
        height=CHART_HEIGHT,
        alt="Daily high and low temperatures by year",
    )

with ratio_cols[1].container(border=True, height="stretch"):
    st.subheader("Weather distribution")

    st.altair_chart(
        alt.Chart(df)
        .mark_arc()
        .encode(
            alt.Theta("count()"),
            alt.Color("weather:N"),
        )
        .configure_legend(orient="bottom"),
        height=CHART_HEIGHT,
        alt="Share of days by weather type",
    )


cols = st.columns(2)

with cols[0].container(border=True, height="stretch"):
    st.subheader("Wind", icon=":material/air:")

    st.altair_chart(
        alt.Chart(df)
        .mark_line()
        .encode(
            alt.X("monthdate(date):T").title("date"),
            alt.Y("mean(wind):Q").title("wind speed (m/s)"),
            alt.Color("year(date):N").title("year"),
            tooltip=[
                alt.Tooltip("monthdate(date):T", title="Date"),
                alt.Tooltip("mean(wind):Q", title="Wind (m/s)"),
                alt.Tooltip("year(date):N", title="Year"),
            ],
        )
        .configure_legend(orient="bottom"),
        height=CHART_HEIGHT,
        alt="Average wind speed by day of year",
    )

with cols[1].container(border=True, height="stretch"):
    st.subheader("Precipitation", icon=":material/water_drop:")

    st.altair_chart(
        alt.Chart(df)
        .mark_bar()
        .encode(
            alt.X("month(date):O").title("month"),
            alt.Y("sum(precipitation):Q").title("precipitation (mm)"),
            alt.Color("year(date):N").title("year"),
            tooltip=[
                alt.Tooltip("month(date):O", title="Month"),
                alt.Tooltip("sum(precipitation):Q", title="Precipitation (mm)"),
                alt.Tooltip("year(date):N", title="Year"),
            ],
        )
        .configure_legend(orient="bottom"),
        height=CHART_HEIGHT,
        alt="Monthly precipitation totals by year",
    )

cols = st.columns(2)

with cols[0].container(border=True, height="stretch"):
    st.subheader("Monthly weather breakdown", icon=":material/calendar_month:")

    st.altair_chart(
        alt.Chart(df)
        .mark_bar()
        .encode(
            alt.X("month(date):O", title="month"),
            alt.Y("count():Q", title="days", stack="normalize"),
            alt.Color("weather:N"),
        )
        .configure_legend(orient="bottom"),
        height=CHART_HEIGHT,
        alt="Monthly mix of weather types",
    )

with cols[1].container(border=True, height="stretch"):
    st.subheader("Raw data", icon=":material/table:")

    st.dataframe(
        df, height=CHART_HEIGHT, hide_index=True, alt="Seattle weather observations"
    )
