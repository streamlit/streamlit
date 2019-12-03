import streamlit as st

things = [1,2,3]

@st.cache
def hash_dicts(inp):
    outd = {'things': things,
            'a': inp}
    return outd

st.header("iteration 1")
st.write(hash_dicts(5))

st.header("iteration 2: mutated `things`")
things = [4,5,6]

st.write(hash_dicts(5))

