import streamlit as st
from urllib import request

url = 'https://www.w3schools.com/html/mov_bbb.mp4'
file = request.urlopen(url).read()
st.video(file)
