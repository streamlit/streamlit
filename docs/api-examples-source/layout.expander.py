import streamlit as st

st.bar_chart({"d6": [1, 5, 2, 6, 2, 1]})

with st.expander("See explanation"):
    st.write(
        """
        The chart above shows some numbers I picked for you.
        I rolled actual dice for these, so they're *guaranteed* to
        be random.
        """
    )
    st.image("https://static.streamlit.io/examples/dice.jpg", width=200)
    st.markdown("Photo by [@brett_jordon](https://unsplash.com/photos/4aB1nGtD_Sg)")
