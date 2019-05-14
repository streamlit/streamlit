import streamlit as st

import graphviz as graphviz

"""examples from https://github.com/dagrejs/dagre-d3/wiki"""

# create a graphlib graph object
graph = graphviz.Graph(comment='The Round Table')
graph.node('A', 'King Arthur')
graph.node('B', 'Sir Bedevere the Wise')
graph.node('L', 'Sir Lancelot the Brave')
graph.edges(['AB', 'AL'])
graph.edge('B', 'L', constraint='false')

# dot string for a styled graph
styled = """// Attribute styling
strict digraph {
  A [style="fill: #afa"]
  B [labelStyle="font-weight: bold"]
  C [labelStyle="font-size: 2em"]
  D
  E
  A -> B [style="stroke: #f66; stroke-width: 3px; stroke-dasharray: 5, 5;",arrowheadStyle="fill: #f66"]
  C -> B [label="A to C",labelStyle="font-style: italic; text-decoration: underline;"]
  A -> D [label="line interpolation different",lineInterpolate=basis]
  E -> D
  A -> E [label="Arrowhead class",arrowheadClass=arrowhead]
}"""


# dot string for a clustered graph
cluster = """// Clustered graph
strict digraph {
  a [label=A,ry=5,rx=5]
  g [label=G,ry=5,rx=5]
  subgraph group {
    label=Group;
    clusterLabelPos=top;
    style="fill: #d3d7e8";
    ry=5;
    rx=5;
    subgraph top_group {
      label="Top Group";
      clusterLabelPos=bottom;
      style="fill: #ffd47f";
      ry=5;
      rx=5;
      b [label=B,ry=5,rx=5]
    }
    subgraph bottom_group {
      label="Bottom Group";
      style="fill: #5f9488";
      ry=5;
      rx=5;
      c [label=C,ry=5,rx=5]
      d [label=D,ry=5,rx=5]
      e [label=E,ry=5,rx=5]
      f [label=F,ry=5,rx=5]
    }
  }
  a -> b
  b -> c
  b -> d
  b -> e
  b -> f
  b -> g
}"""

# draw graphs
st.graphviz_chart(graph)
st.graphviz_chart(styled)
st.graphviz_chart(cluster, height=500)
