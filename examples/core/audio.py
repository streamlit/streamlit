import streamlit as st
import urllib


url = 'https://www.w3schools.com/html/horse.ogg'
file = urllib.request.urlopen(url).read()
st.audio(file)
