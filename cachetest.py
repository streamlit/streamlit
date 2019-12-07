import streamlit as st


st.title("Cache test: adding `10` to `number`.")

def called_by_cached_function():
    return number + 2
    
@st.cache
def add(num):
    resultd = {"dkey_added": number + num}
    anothervar = num + 2
    resultd["dkey_second_add"] = anothervar
    resultd["dkey_number_from_called_function"] = called_by_cached_function()
    return resultd

@st.cache
def hash_dicts(inp):
    outd = {"dkey_things": things,
            "dkey_inp": inp}
    return outd

st.header("iteration 1: `number = 5`")

with st.echo():
    things = [1,2,3]
    number = 5
    add_answer = add(10)
    hash_dicts_answer = hash_dicts(5)

with st.echo():
    st.write("These should generate cache HITs")
    st.write(hash_dicts(5))
    st.write(add(10))

st.header("iteration 2: change `number` to `3`. mutate `things`.")

with st.echo():
    things = [4,5,6]
    number = 3
    st.write("These should ALSO generate cache HITs")
    st.write(add(10))
    st.write(hash_dicts(5))

st.header("RESULTS: Did we ignore implicit inputs?")
with st.echo():
    st.write("add(10):", bool(add_answer==add(10)))
    st.write("hash_dicts(5):", bool(hash_dicts_answer==hash_dicts(5)))


