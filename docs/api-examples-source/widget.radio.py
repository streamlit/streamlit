import streamlit as st

with st.echo():
    genre = st.radio('What\'s your favorite movie genre', ('Comedy', 'Drama', 'Documentary'))
    if genre == 0:
        st.write('You selected comedy.')
    else:
        st.write('You didn\'t select comedy.')
