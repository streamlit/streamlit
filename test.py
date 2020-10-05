import graphviz

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

st.balloons()
st.help(st.help)
