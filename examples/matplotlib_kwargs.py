import io
import pprint
import textwrap

import matplotlib.pyplot as plt
import streamlit as st
import seaborn as sns
import numpy as np


def main():
    st.title('Verify that st.pyplot and matplotlib show the same things.')

    # Plot labels
    title = 'An Extremely and Really Really Long Long Long Title'
    xLabel = 'Very long long x label'
    yLabel = 'Very long long y label'

    # Generate data
    n = 200
    xData = np.random.randn(n, 1) * 30 + 30
    yData = np.random.randn(n, 1) * 30
    data = np.random.randn(n, 2)

    # Generate plot
    fig, ax = plt.subplots(figsize=(4.5, 4.5))
    sns.set_context(rc={'font.size': 10})
    p = sns.regplot(x=xData, y=yData, data=data, ci=None, ax=ax, color='grey')

    p.set_title(title, fontweight='bold')
    p.set_xlabel(xLabel)
    p.set_ylabel(yLabel)

    p.set_ylim(-30, 30)
    plot_text = textwrap.dedent('''
        some_var_1 = 'Some label 1'
        some_var_2 = 'Some label 2'
    ''')

    txt = ax.text(0.90, 0.10, plot_text, transform=ax.transAxes)
    sns.despine()

    # st.pyplot with no args
    st.header('st.pyplot with no args')
    st.write('This should show a plot with labels and images cut off')
    with st.echo():
        st.pyplot(fig)

    # generate an image file via matplotlib with kwargs
    fakefile = io.BytesIO()

    kwargs = {
        'dpi': 1200,
        'bbox_extra_artists': (txt,),
        'bbox_inches': 'tight',
    }

    st.header('fig.savefig')
    st.write('Use fig.savefig to save image to "file" then open "file" '
             'with st.image.  This shows the correct "image"')

    st.code('kwargs = ' + pprint.pformat(kwargs), language='python')
    with st.echo():
        fig.savefig(fakefile, **kwargs)

        from PIL import Image
        image = Image.open(fakefile)
        st.image(image, use_column_width=True)

    # st.pyplot with kwags
    st.header('st.pyplot with the same kwargs as fig.savefig')
    with st.echo():
        st.pyplot(fig, **kwargs)


if __name__ == '__main__':
    main()
