import graphviz
import numpy as np
import plotly.figure_factory as ff

import streamlit as st

st.write("# Title")
st.text("st.text")
st.info("st.info")
st.warning("st.warning")
st.error("st.error")
st.audio("http://nthmost.net:8000/mutiny-studio")
st.exception(RuntimeError("st.exception"))

graph = graphviz.Graph(comment="The Round Table")
graph.node("A", "King Arthur")
graph.node("B", "Sir Bedevere the Wise")
graph.edges(["AB"])
st.graphviz_chart(graph)

urls = [
    "https://static01.nyt.com/images/2020/10/04/fashion/00MOTHERSHELPER/00MOTHERSHELPER-superJumbo.jpg?quality=90&auto=webp",
    "https://static01.nyt.com/images/2020/10/04/fashion/00MOTHERSHELPER/00MOTHERSHELPER-superJumbo.jpg?quality=90&auto=webp",
    "https://static01.nyt.com/images/2020/10/04/fashion/00MOTHERSHELPER/00MOTHERSHELPER-superJumbo.jpg?quality=90&auto=webp",
]
st.image(urls, caption=["some caption"] * 3, width=300)

st.json({"st.json": [1, 2, 3]})


# Add histogram data
x1 = np.random.randn(200) - 2
x2 = np.random.randn(200)
x3 = np.random.randn(200) + 2

# Group data together
hist_data = [x1, x2, x3]

group_labels = ["Group 1", "Group 2", "Group 3"]

# Create distplot with custom bin_size
fig = ff.create_distplot(hist_data, group_labels, bin_size=[0.1, 0.25, 0.5])

# Plot!
st.plotly_chart(fig)

st.balloons()
st.help(st.help)
