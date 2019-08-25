import streamlit as st

if not hasattr(st, 'test_run_count'):
    st.test_run_count = 0
else:
    st.test_run_count += 1

# Starting the report takes up the first run.
# When run the test will see the slider first.
if not st.test_run_count:
    w1 = st.button('label')
elif st.test_run_count <= 2:
    w1 = st.slider('label', 25, 0, 100, 1)
else:
    w1 = st.selectbox('label', ('m', 'f'), 1)

st.write('value 1:', w1)
