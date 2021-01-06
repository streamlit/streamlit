import streamlit as st
import pandas as pd
import numpy as np

st.title("blah-one", anchor="anchor-one")

chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

st.line_chart(chart_data)

st.header("blah-two", anchor="anchor-two")

chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

st.line_chart(chart_data)

st.subheader("blah-three", anchor="anchor-three")

chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

st.line_chart(chart_data)

st.subheader("blah-four", anchor="anchor-four")

chart_data = pd.DataFrame(np.random.randn(20, 3), columns=["a", "b", "c"])

st.line_chart(chart_data)

st.markdown(
    """
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sodales leo sit
amet efficitur dapibus. Aliquam cursus nisl sit amet enim cursus cursus.
Maecenas eget leo egestas, consectetur erat at, pellentesque purus. Integer et
feugiat eros, sit amet commodo erat. Praesent sit amet dignissim ex. Nullam
diam ipsum, consequat ut nibh eu, aliquam molestie augue. Ut et lobortis diam,
posuere luctus dolor. Phasellus sit amet mauris nulla. Lorem ipsum dolor sit
amet, consectetur adipiscing elit. Morbi nec arcu iaculis, pulvinar mauris sit
amet, tincidunt urna. Aliquam porttitor rhoncus fermentum. Nunc tristique neque
eget justo luctus, et dapibus magna euismod. Cras malesuada mauris id urna
iaculis vehicula. Morbi euismod fringilla leo in suscipit. Praesent id iaculis
eros. Pellentesque bibendum gravida nunc, in pulvinar dolor hendrerit sed.

Sed maximus dictum nisi, at vulputate orci interdum non. Nulla magna neque,
venenatis tincidunt lorem eget, ultrices placerat eros. Pellentesque id aliquam
erat. Nullam quis bibendum purus, quis interdum arcu. Donec posuere, libero
eget convallis vehicula, purus massa ornare libero, eget commodo massa massa
sit amet odio. Vestibulum ultrices id sapien quis lobortis. Donec euismod,
ligula id tempor vehicula, dui velit aliquet justo, ac molestie massa dui nec
neque. Nunc dignissim pulvinar urna, sed scelerisque felis placerat sed. Donec
iaculis, est sagittis pellentesque lacinia, felis elit interdum quam, in
ullamcorper nunc lacus nec erat. Sed eu commodo lorem.

Sed vel velit magna. Aenean ac est arcu. Duis varius, nulla sed tempor auctor,
dui nunc imperdiet mi, at aliquam massa justo ac sapien. Nulla laoreet felis
libero, vitae accumsan purus iaculis et. Cras venenatis eleifend tellus, eu
iaculis metus. Curabitur facilisis ut elit id pretium. Morbi sagittis, ex
efficitur egestas aliquet, nibh tortor consectetur orci, in euismod libero nunc
et metus. Duis vel vehicula mauris, sed eleifend dolor. Praesent sit amet
vulputate magna. Integer vitae vestibulum turpis, at pellentesque velit."""
)
