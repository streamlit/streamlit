import streamlit as st
import requests

url = "https://www.w3schools.com/html/horse.ogg"
file = requests.get(url).content
st.audio(file)
