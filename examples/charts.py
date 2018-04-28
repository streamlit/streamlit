#!./streamlit_run

from streamlit import io

io.write('Hello, world!')
io.write('Nothing')

with io.echo():
    io.write('This code will be written.')
