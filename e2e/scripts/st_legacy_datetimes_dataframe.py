import streamlit as st
import pandas as pd

df = pd.DataFrame({"str": ["2020-04-14 00:00:00"]})
df["notz"] = pd.to_datetime(df["str"])
df["yaytz"] = pd.to_datetime(df["str"]).dt.tz_localize("Europe/Moscow")
st._legacy_dataframe(df)
