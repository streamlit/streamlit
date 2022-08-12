import streamlit as st

import graphviz as graphviz

# basic graph
hello = graphviz.Digraph("Hello World")
hello.edge("Hello", "World")

# styled graph
styled = graphviz.Graph("G", filename="g_c_n.gv")
styled.attr(bgcolor="purple:pink", label="agraph", fontcolor="white")

with styled.subgraph(name="cluster1") as c:
    c.attr(
        fillcolor="blue:cyan",
        label="acluster",
        fontcolor="white",
        style="filled",
        gradientangle="270",
    )
    c.attr(
        "node", shape="box", fillcolor="red:yellow", style="filled", gradientangle="90"
    )
    c.node("anode")

# complex graph
finite = graphviz.Digraph("finite_state_machine", filename="fsm.gv")
finite.attr(rankdir="LR", size="8,5")

finite.attr("node", shape="doublecircle")
finite.node("LR_0")
finite.node("LR_3")
finite.node("LR_4")
finite.node("LR_8")

finite.attr("node", shape="circle")
finite.edge("LR_0", "LR_2", label="SS(B)")
finite.edge("LR_0", "LR_1", label="SS(S)")
finite.edge("LR_1", "LR_3", label="S($end)")
finite.edge("LR_2", "LR_6", label="SS(b)")
finite.edge("LR_2", "LR_5", label="SS(a)")
finite.edge("LR_2", "LR_4", label="S(A)")
finite.edge("LR_5", "LR_7", label="S(b)")
finite.edge("LR_5", "LR_5", label="S(a)")
finite.edge("LR_6", "LR_6", label="S(b)")
finite.edge("LR_6", "LR_5", label="S(a)")
finite.edge("LR_7", "LR_8", label="S(b)")
finite.edge("LR_7", "LR_5", label="S(a)")
finite.edge("LR_8", "LR_6", label="S(b)")
finite.edge("LR_8", "LR_5", label="S(a)")

# draw graphs
st.graphviz_chart(hello)

st.graphviz_chart(styled)

st.graphviz_chart(finite)

# draw graphs in columns

left_graph = graphviz.Digraph("Left")
left_graph.edge("Left", "Graph")

right_graph = graphviz.Digraph("Right")
right_graph.edge("Right", "Graph")

col1, col2 = st.columns([1, 1])

with col1:
    st.graphviz_chart(left_graph)

with col2:
    st.graphviz_chart(right_graph)
