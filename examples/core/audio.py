import streamlit as st
from urllib import request

url = 'https://www.w3schools.com/html/horse.ogg'
file = request.urlopen(url).read()
st.audio(file)
