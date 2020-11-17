import streamlit as st

server = st.server.server.Server.get_current()
print(f'{{"server._command_line": "{server._command_line}"}}')

server.stop()
