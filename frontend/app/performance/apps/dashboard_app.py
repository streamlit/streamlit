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

import matplotlib.pyplot as plt
import plotly.express as px
import seaborn as sns

import streamlit as st

st.set_page_config(layout="wide", page_title="Dashboard")
st.title("Dashboard")


@st.cache_data
def load_data():
    return sns.load_dataset("iris")


data = load_data()


st.sidebar.header("Filter")

unique_species = data["species"].unique()

species = st.sidebar.multiselect(
    "Select Species", options=unique_species, default=unique_species
)

filtered_data = data[data["species"].isin(species)]

col1, col2 = st.columns(2)

with col1:
    st.subheader("Dataset")
    st.dataframe(filtered_data, use_container_width=True)

with col2:
    st.subheader("Basic Statistics")
    st.dataframe(filtered_data.describe(), use_container_width=True)

col3, col4, col5 = st.columns(3)

with col3:
    st.subheader("Box Plot of Sepal Width")
    fig = px.box(filtered_data, x="species", y="sepal_width", points="all")
    st.plotly_chart(fig)

with col4:
    st.subheader("Histogram of Sepal Length")
    fig = px.histogram(
        filtered_data, x="sepal_length", color="species", marginal="box", nbins=20
    )
    st.plotly_chart(fig)

with col5:
    st.subheader("Pairplot")
    pairplot_fig = sns.pairplot(filtered_data, hue="species")
    st.pyplot(pairplot_fig)

col6, col7, col8 = st.columns(3)

with col6:
    st.subheader("Scatter Plot of Sepal Length vs Sepal Width")
    fig = px.scatter(filtered_data, x="sepal_length", y="sepal_width", color="species")
    st.plotly_chart(fig)

with col7:
    st.subheader("Line Chart of Sepal Length")
    fig = px.line(filtered_data, x="species", y="sepal_length", color="species")
    st.plotly_chart(fig)


col9, col10 = st.columns(2)

with col9:
    st.subheader("Heatmap of Correlation Matrix")
    numeric_data = filtered_data.select_dtypes(include=["float64", "int64"])
    corr = numeric_data.corr()
    fig, ax = plt.subplots()
    sns.heatmap(corr, annot=True, ax=ax)
    st.pyplot(fig)

with col10:
    st.subheader("Species Count")
    species_count = filtered_data["species"].value_counts().reset_index()
    species_count.columns = ["species", "count"]
    fig = px.pie(species_count, names="species", values="count")
    st.plotly_chart(fig)
