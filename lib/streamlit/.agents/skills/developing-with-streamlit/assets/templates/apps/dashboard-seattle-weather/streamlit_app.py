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

"""Seattle weather dashboard for the classic Seattle weather dataset, drawn with ECharts."""

import calendar
from typing import Any

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

# Weather types from most to least common overall. The weather charts use this
# fixed order, so each type keeps its color when the year filter changes.
WEATHER_ICONS = {
    "sun": ":material/sunny:",
    "fog": ":material/foggy:",
    "rain": ":material/rainy:",
    "drizzle": ":material/rainy:",
    "snow": ":material/weather_snowy:",
}

# Charts that share a row need the same height.
CHART_HEIGHT = 300


# Chronological category-axis labels. 2000 is a leap year, so DAYS has Feb 29.
MONTHS = list(calendar.month_abbr)[1:]
DAYS = list(pd.date_range("2000-01-01", "2000-12-31").strftime("%b %d"))


def year_series_option(
    source: pd.DataFrame, series_type: str, unit: str
) -> dict[str, Any]:
    """Build an ECharts option with one series per year column.

    The first column of ``source`` holds the category-axis labels (day or month).
    """
    line_options = {"showSymbol": False} if series_type == "line" else {}
    return {
        "dataset": {"source": source},
        "legend": {"bottom": 0},
        "tooltip": {"trigger": "axis", "valueFormatter": f"%.1f {unit}"},
        "xAxis": {"type": "category"},
        "yAxis": {"type": "value", "axisLabel": {"formatter": f"{{value}} {unit}"}},
        "series": [
            {"type": series_type, "name": year, **line_options}
            for year in source.columns[1:]
        ],
    }


def temperature_option(df: pd.DataFrame) -> dict[str, Any]:
    """Build floating bars from each day's low to its high, one series per year.

    ECharts bars always start at the axis baseline, so each year stacks a
    transparent bar at the low temperature under a visible bar as tall as the
    day's range. Unlike a ``lines`` series, this keeps the data in
    ``dataset.source``.
    """
    temps = df.assign(
        low=df["temp_min"], high=df["temp_max"], range=df["temp_max"] - df["temp_min"]
    ).pivot_table(
        index="day", columns="year", values=["low", "range", "high"], observed=True
    )
    years = list(temps["range"].columns)
    # Flatten ("low", "2015") into "2015 low".
    temps.columns = temps.columns.map(lambda column: f"{column[1]} {column[0]}")
    # ECharts' default stackStrategy only stacks values of the same sign, so a
    # below-zero low wouldn't lift its range bar. "all" stacks every value.
    bar_options = {"type": "bar", "stackStrategy": "all", "barGap": "0%"}
    series: list[dict[str, Any]] = []
    for year in years:
        series += [
            {
                **bar_options,
                # Same name as the range bar: one color and one legend entry.
                "name": year,
                "stack": year,
                "encode": {"x": "day", "y": f"{year} low"},
                "itemStyle": {"opacity": 0},
                "tooltip": {"show": False},
                "silent": True,
            },
            {
                **bar_options,
                "name": year,
                "stack": year,
                "encode": {
                    "x": "day",
                    "y": f"{year} range",
                    "tooltip": [f"{year} high", f"{year} low"],
                },
            },
        ]
    return {
        "dataset": {"source": temps.reset_index()},
        # Restore opacity on the legend icons: each icon copies the style of the
        # first series with its name, which is the transparent low bar.
        "legend": {
            "bottom": 0,
            "data": [{"name": year, "itemStyle": {"opacity": 1}} for year in years],
        },
        "tooltip": {"trigger": "axis", "valueFormatter": "%.1f °C"},
        "xAxis": {"type": "category"},
        "yAxis": {"type": "value", "axisLabel": {"formatter": "{value} °C"}},
        "series": series,
    }


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
        stat = df_2015[column].agg(agg)
        st.metric(
            label,
            stat,
            delta=stat - df_2014[column].agg(agg),
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

df = full_df[full_df["date"].dt.year.isin(selected_years)].assign(
    # Category labels shared by every year, so the years line up.
    year=lambda d: d["date"].dt.year.astype(str),
    month=lambda d: pd.Categorical(d["date"].dt.strftime("%b"), categories=MONTHS),
    day=lambda d: pd.Categorical(d["date"].dt.strftime("%b %d"), categories=DAYS),
)

ratio_cols = st.columns([3, 1])

with ratio_cols[0].container(border=True, height="stretch"):
    st.subheader("Temperature", icon=":material/thermostat:")
    st.echarts_chart(
        temperature_option(df),
        height=CHART_HEIGHT,
        alt="Daily high and low temperatures by year",
    )

with ratio_cols[1].container(border=True, height="stretch"):
    st.subheader("Weather distribution")
    weather_days = (
        df["weather"]
        .value_counts()
        .reindex(list(WEATHER_ICONS), fill_value=0)
        .rename("days")
    )
    st.echarts_chart(
        {
            "dataset": {"source": weather_days.reset_index()},
            "tooltip": {"trigger": "item", "formatter": "{b}: {@days} days ({d}%)"},
            "legend": {"bottom": 0},
            "series": [
                {
                    "type": "pie",
                    "radius": ["45%", "70%"],
                    "center": ["50%", "42%"],
                    "label": {"show": False},
                    "encode": {"itemName": "weather", "value": "days"},
                }
            ],
        },
        height=CHART_HEIGHT,
        alt=f"Share of days by weather type, mostly {weather_days.idxmax()}",
    )


cols = st.columns(2)

with cols[0].container(border=True, height="stretch"):
    st.subheader("Wind", icon=":material/air:")
    wind = df.pivot_table(
        index="day", columns="year", values="wind", observed=True
    ).reset_index()
    st.echarts_chart(
        year_series_option(wind, "line", "m/s"),
        height=CHART_HEIGHT,
        alt="Daily wind speed by day of year",
    )

with cols[1].container(border=True, height="stretch"):
    st.subheader("Precipitation", icon=":material/water_drop:")
    precipitation = df.pivot_table(
        index="month",
        columns="year",
        values="precipitation",
        aggfunc="sum",
        observed=True,
    ).reset_index()
    st.echarts_chart(
        year_series_option(precipitation, "bar", "mm"),
        height=CHART_HEIGHT,
        alt="Monthly precipitation totals by year",
    )

cols = st.columns(2)

with cols[0].container(border=True, height="stretch"):
    st.subheader("Monthly weather breakdown", icon=":material/calendar_month:")
    # Share of each month's days per weather type, in percent, in the donut's
    # weather order so each type has the same color in both charts.
    weather_mix = pd.crosstab(df["month"], df["weather"], normalize="index") * 100
    weather_mix = weather_mix.reindex(
        columns=list(WEATHER_ICONS), fill_value=0
    ).reset_index()
    st.echarts_chart(
        {
            "dataset": {"source": weather_mix},
            "legend": {"bottom": 0},
            "tooltip": {"trigger": "axis", "valueFormatter": "%.0f%%"},
            "xAxis": {"type": "category"},
            "yAxis": {
                "type": "value",
                "max": 100,
                "axisLabel": {"formatter": "{value}%"},
            },
            "series": [
                {"type": "bar", "name": weather, "stack": "days"}
                for weather in weather_mix.columns[1:]
            ],
        },
        height=CHART_HEIGHT,
        alt="Monthly mix of weather types",
    )

with cols[1].container(border=True, height="stretch"):
    st.subheader("Raw data", icon=":material/table:")

    st.dataframe(
        df.drop(columns=["year", "month", "day"]),
        height=CHART_HEIGHT,
        hide_index=True,
        alt="Seattle weather observations",
    )
