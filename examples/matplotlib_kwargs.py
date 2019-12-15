# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import io
import pprint
import textwrap

import matplotlib.pyplot as plt
import streamlit as st
import seaborn as sns
import numpy as np


def main():
    st.title("Verify that st.pyplot and matplotlib show the same things.")

    # Plot labels
    title = "An Extremely and Really Really Long Long Long Title"
    xLabel = "Very long long x label"
    yLabel = "Very long long y label"

    # Generate data
    n = 200
    xData = np.random.randn(n, 1) * 30 + 30
    yData = np.random.randn(n, 1) * 30
    data = np.random.randn(n, 2)

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

    # st.pyplot with no args
    st.header("st.pyplot with no args")
    st.write("This should show a plot with labels and images cut off")
    x = st.info("Loading...")
    with st.echo():
        x.pyplot(fig, clear_figure=False)

    # generate an image file via matplotlib with kwargs
    fakefile = io.BytesIO()

    kwargs = {
        "dpi": 200,
        "bbox_extra_artists": (txt,),
        "bbox_inches": "tight",
        "format": "png",  # Required for some Matplotlib backends.
    }

    st.header("fig.savefig")
    st.write(
        'Use fig.savefig to save image to "file" then open "file" '
        'with st.image.  This shows the correct "image"'
    )

    st.code("kwargs = " + pprint.pformat(kwargs), language="python")
    x = st.info("Loading...")
    with st.echo():
        fig.savefig(fakefile, **kwargs)

        from PIL import Image

        image = Image.open(fakefile)
        x.image(image, use_column_width=True)

    # st.pyplot with kwags
    st.header("st.pyplot with the same kwargs as fig.savefig")
    x = st.info("Loading...")
    with st.echo():
        x.pyplot(fig, **kwargs)

    st.success("Done!")


if __name__ == "__main__":
    main()
