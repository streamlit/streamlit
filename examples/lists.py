import streamlit as st

st.title("Lists!")

lists = [
    [],
    [10, 20, 30],
    [[10, 20, 30], [1, 2, 3]],
    [[10, 20, 30], [1]],
    [[10, "hi", 30], [1]],
    [[{"foo": "bar"}, "hi", 30], [1]],
    [[{"foo": "bar"}, "hi", 30], [1, [100, 200, 300, 400]]],
]


for i, l in enumerate(lists):
    st.header("List %d" % i)

    st.write("With st.write")
    st.write(l)

    st.write("With st.json")
    st.json(l)

    st.write("With st.dataframe")
    st.dataframe(l)
