import textwrap
from typing import Any, cast

import matplotlib.pyplot as plt
import seaborn as sns
import streamlit as st
import numpy as np


# Plot labels
title = "An Extremely and Really Really Long Long Long Title"
xLabel = "Very long long x label"
yLabel = "Very long long y label"

# Generate data
n = 200
np.random.seed(1234)

# Casting to Any in order to support differences in typing behaviour for
# python 3.7
xData: "np.typing.NDArray[np.float_]" = cast(Any, np.random.randn(n, 1) * 30) + 30
yData: "np.typing.NDArray[np.float_]" = np.random.randn(n, 1) * 30
data: "np.typing.NDArray[np.float_]" = np.random.randn(n, 2)

# Generate plot
fig, ax = plt.subplots(figsize=(4.5, 4.5))
sns.set_context(rc={"font.size": 10})
p = sns.regplot(x=xData, y=yData, data=data, ci=None, ax=ax, color="grey")

p.set_title(title, fontweight="bold")
p.set_xlabel(xLabel)
p.set_ylabel(yLabel)

p.set_ylim(-30, 30)
plot_text = textwrap.dedent(
    """
    some_var_1 = 'Some label 1'
    some_var_2 = 'Some label 2'
"""
)

txt = ax.text(0.90, 0.10, plot_text, transform=ax.transAxes)
sns.despine()

kwargs = {
    "dpi": 1200,
    "bbox_extra_artists": (txt,),
    "bbox_inches": "tight",
    "format": "png",  # Required for some Matplotlib backends.
}

# st.pyplot with kwargs
x = st.info("Loading...")
x.pyplot(fig, **kwargs)  # type: ignore[arg-type]

st.success("Done!")
