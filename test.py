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

st.balloons()
st.help(st.help)
