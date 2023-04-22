from streamlit import *
from streamlit.v3b.df_functions import dataframe as _dataframe

dataframe = _dataframe  # type: ignore
from streamlit.v3b.df_functions import (
    experimental_data_editor as _experimental_data_editor,
)

experimental_data_editor = _experimental_data_editor  # type: ignore


from streamlit.v5.df_functions import column_config as _column_config

column_config = _column_config
