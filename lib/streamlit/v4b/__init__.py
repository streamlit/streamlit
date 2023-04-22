from streamlit import *
from streamlit.v4b.df_functions import dataframe as _dataframe

dataframe = _dataframe  # type: ignore
from streamlit.v4b.df_functions import (
    experimental_data_editor as _experimental_data_editor,
)

experimental_data_editor = _experimental_data_editor  # type: ignore
