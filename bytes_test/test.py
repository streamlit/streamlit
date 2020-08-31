import streamlit as st
import streamlit.components.v1 as components


bytes_test = components.declare_component("bytes_test", url="http://localhost:3001")

bytes_test(name="Test", bytes="qwert".encode())
