st.line_chart({"data": [1, 5, 2, 6]})

with st.beta_expander("See explanation"):
    st.write(
        """
        The chart above shows some numbers I picked for you.
        I rolled actual dice for these, so they're guaranteed to
        be random.
        """
    )
    st.image("https://static.streamlit.io/examples/dice.jpg")
    st.markdown("[@brett_jordon on Unsplash](https://unsplash.com/photos/4aB1nGtD_Sg)")
