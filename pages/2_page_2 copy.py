import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image

CORGI_IMAGE = Image.open("corgi.jpeg")
CORGI_IMAGE_2 = Image.open("corgi2.jpg")
CORGI_IMAGE_3 = Image.open("corgi3.jpg")


st.set_page_config(page_title="Corgis", initial_sidebar_state="collapsed")

st.sidebar.header("Sidebar ⚡")
st.sidebar.image(CORGI_IMAGE, caption="Say hi to Kevin! 🐶")
st.sidebar.slider("Random Slider", min_value=0, max_value=20, value=0, step=1)
st.sidebar.number_input("Lucky Number", min_value=0, max_value=100, value=7, step=1)
st.sidebar.color_picker("Pick a Color", value="#464AB3")
st.sidebar.subheader("Surprise! More corgis 🐶")
st.image(CORGI_IMAGE_2, caption="Another One")
st.image(CORGI_IMAGE_3, caption="Another Other One")
