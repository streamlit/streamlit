# import plotly.graph_objects as go
# import plotly.io as pio

# pio.templates["streamlit"] = go.layout.Template(
#     layout_annotations=[
#         dict(
#             name="streamlit",
#             color_discrete_sequence=["#111111",
#                 "#83C9FF",
#                 "#FF2B2B",
#                 "#FFABAB",
#                 "#29B09D",
#                 "#7DEFA1",
#                 "#FF8700",
#                 "#FFD16A",
#                 "#6D3FC0",
#                 "#D5DAE5"],
#             font=dict(color="red", size=100),
#         )
#     ]
# )
import plotly.graph_objects as go
import plotly.io as pio

pio.templates["draft"] = go.layout.Template(
    # layout_annotations=[
    #     dict(
    #         name="draft watermark",
    #         text="STREAMLIT",
    #         textangle=-30,
    #         opacity=0.1,
    #         font=dict(color="black", size=100),
    #         xref="paper",
    #         yref="paper",
    #         x=0.5,
    #         y=0.5,
    #         showarrow=False,
    #     )
    # ],
    layout=dict(
        colorway= ["#0068C9",
          "#83C9FF",
          "#FF2B2B",
          "#FFABAB",
          "#29B09D",
          "#7DEFA1",
          "#FF8700",
          "#FFD16A",
          "#6D3FC0",
          "#D5DAE5"],
    ),
)