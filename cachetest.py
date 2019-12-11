import streamlit as st

st.title("Cache tests")


def called_by_cached_function():
    return number + 2


# TODO/ FIXME
#def test_lambdas_calls(self):
#    """Test code with lambdas that call functions."""
#
#    def f_lower():
#        lambda x: x.lower()
#
#    def f_upper():
#        lambda x: x.upper()
#
#    def f_lower2():
#        lambda x: x.lower()
#
#    self.assertNotEqual(get_hash(f_lower), get_hash(f_upper))
#    self.assertEqual(get_hash(f_lower), get_hash(f_lower2))


def make_funcy():
    return lambda inp: sorted(inp)

@st.cache
def add(num):
    def square():
        return lambda x: x * x

    resultd = {"dkey_added": number + num}
    anothervar = num + 2
    resultd["dkey_second_add"] = anothervar
    resultd["dkey_number_from_called_function"] = called_by_cached_function()
    resultd["dkey_internal_lambda"] = square()(num)
    #resultd["dkey_external_lambda"] = make_funcy()
    return resultd


@st.cache
def hash_dicts(inp):
    outd = {"dkey_things": things, 
            "dkey_inp": inp,
           }
           # "dkey_used_lambda": make_funcy()(inp)
    return outd


st.header("iteration 1: `number = 5`")

with st.echo():
    things = [1, 2, 3]
    number = 5
    add_answer = add(10)
    hash_dicts_answer = hash_dicts(5)

with st.echo():
    st.write("These should generate cache HITs")
    st.write(hash_dicts(5))
    st.write(add(10))

st.header("iteration 2: change `number` to `3`. mutate `things`.")

with st.echo():
    things = [4, 5, 6]
    number = 3
    st.write("These should ALSO generate cache HITs")
    st.write(add(10))
    st.write(hash_dicts(5))

st.header("RESULTS: Did we ignore implicit inputs?")
with st.echo():
    st.write("add(10):", bool(add_answer == add(10)))
    st.write("hash_dicts(5):", bool(hash_dicts_answer == hash_dicts(5)))

