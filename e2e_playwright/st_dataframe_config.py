# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import datetime
import random

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
random.seed(0)

st.set_page_config(layout="wide")

# Generate a random dataframe
df = pd.DataFrame(
    np.random.randn(5, 5),
    columns=("col_%d" % i for i in range(5)),
)


st.header("Hide index parameter:")
st.dataframe(df, hide_index=True)
st.dataframe(df, hide_index=False)

st.header("Column order parameter:")
st.dataframe(df, column_order=["col_4", "col_3", "col_0"])

st.header("Set column labels:")
st.dataframe(
    df,
    column_config={
        "_index": "Index column",
        "col_0": "Column 0",
        "col_2": st.column_config.Column("Column 1"),
    },
)

st.header("Hide columns:")
st.dataframe(df, column_config={"col_1": None, "col_3": {"hidden": True}})

st.header("Set column width:")
st.dataframe(
    df,
    column_config={
        "col_0": st.column_config.Column(width="small"),
        "col_1": st.column_config.Column(width="medium"),
        "col_4": {"width": "large"},
    },
)

st.header("Set help tooltips:")
st.caption("Hover over the column headers to see the tooltips.")
st.dataframe(
    pd.DataFrame(
        {
            "col_0": ["a", "b", "c", None],
        }
    ),
    column_config={
        "col_0": st.column_config.Column(help="This :red[is] a **tooltip** 🌟"),
        "_index": {"help": "Index tooltip!"},
    },
)


st.header("Ignore editing-only config options:")
st.dataframe(
    pd.DataFrame(
        {
            "col_0": ["a", "b", "c", None],
        }
    ),
    column_config={"col_0": st.column_config.Column(disabled=False, required=True)},
)


st.header("Text column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": ["Hello World", "Lorem ipsum", "", None],
            "col_1": [1, 2, 3, None],
        }
    ),
    column_config={
        "col_0": st.column_config.TextColumn(
            "Text column",
            width="medium",
            help="This is a text column",
            required=True,  # Should be ignored
            disabled=False,  # Should be ignored
            default="invalid",  # Should be ignored
            max_chars=5,  # Should be ignored
            validate="^[0-9]+$",  # Should be ignored
        ),
        "col_1": st.column_config.TextColumn(),
    },
)

st.header("Number column:")
st.dataframe(
    pd.DataFrame(
        {
            "col_0": [1, 2, 3, None],
            "col_1": ["1", "2", "invalid", None],
        }
    ),
    column_config={
        "col_0": st.column_config.NumberColumn(
            "Number column",
            width="medium",
            help="This is a number column",
            required=True,  # Should be ignored
            disabled=False,  # Should be ignored
            default=0,  # Should be ignored
            min_value=5,  # Should be ignored
            max_value=10,  # Should be ignored
            step=0.001,
        ),
        "col_1": st.column_config.NumberColumn(
            format="%.2f%%",
        ),
    },
)

st.header("Checkbox column:")
st.dataframe(
    pd.DataFrame(
        {
            "col_0": [True, False, False, None],
            "col_1": ["yes", "no", "invalid", None],
        }
    ),
    column_config={
        "col_0": st.column_config.CheckboxColumn(
            "Checkbox column",
            width="medium",
            help="This is a checkbox column",
            required=True,  # Should be ignored
            disabled=False,  # Should be ignored
            default=True,  # Should be ignored
        ),
        "col_1": st.column_config.CheckboxColumn(),
    },
)

st.header("Selectbox column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [1, 2, 3, None],
            "col_1": ["a", "b", "c", None],
        }
    ),
    column_config={
        "col_0": st.column_config.SelectboxColumn(
            "Selectbox column",
            width="medium",
            help="This is a selectbox column",
            required=True,  # Should be ignored
            disabled=False,  # Should be ignored
            default=True,  # Should be ignored
            options=[1, 2, 3, 4, 5],
        ),
        "col_1": st.column_config.SelectboxColumn(options=["a", "b", "c", "d"]),
    },
)

st.header("Link column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [
                "https://streamlit.io/",
                "https://docs.streamlit.io/",
                "https://streamlit.io/gallery",
                None,
            ],
            "col_1": ["/a", "/b", "", None],
            "col_2": [
                "https://roadmap.streamlit.app",
                "https://extras.streamlit.app",
                "",
                None,
            ],
            "col_3": [
                "https://roadmap.streamlit.app",
                "https://extras.streamlit.app",
                "",
                None,
            ],
        }
    ),
    column_config={
        "col_0": st.column_config.LinkColumn(
            "Link column",
            width="medium",
            help="This is a link column",
            required=True,  # Should be ignored
            disabled=False,  # Should be ignored
            default="https://streamlit.io/",  # Should be ignored
            max_chars=5,  # Should be ignored
            validate="^[0-9]+$",  # Should be ignored
        ),
        "col_1": st.column_config.LinkColumn(),
        "col_2": st.column_config.LinkColumn(
            "Display text via Regex",
            display_text=r"https://(.*?)\.streamlit\.app",
        ),
        "col_3": st.column_config.LinkColumn(
            "Static display text",
            display_text="Open link",
        ),
    },
)

st.header("Datetime column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [
                datetime.datetime(2021, 1, 1, 1, 0, 0, 123000),
                datetime.datetime(2022, 1, 2, 2, 0, 0, 234000),
                datetime.datetime(2023, 1, 3, 3, 0, 0, 345000),
                None,
            ],
            "col_1": [
                "2021-01-01T01:00:00.123",
                "2022-01-02T02:00:00.234",
                "invalid",
                None,
            ],
            "col_2": [
                datetime.date(2021, 1, 1),
                datetime.date(2022, 1, 2),
                datetime.date(2023, 1, 3),
                None,
            ],
        }
    ),
    column_config={
        "col_0": st.column_config.DatetimeColumn(
            "Datetime column",
            width="medium",
            help="This is a datetime column",
            required=True,  # Should be ignored
            disabled=False,  # Should be ignored
            default=datetime.datetime(2021, 1, 1, 1, 0, 0),  # Should be ignored
            min_value=datetime.datetime(2021, 1, 1, 1, 0, 0),  # Should be ignored
            max_value=datetime.datetime(2022, 1, 1, 1, 0, 0),  # Should be ignored
            step=0.01,
            format="YYYY-MM-DD HH:mm:ss.SSS",
        ),
        "col_1": st.column_config.DatetimeColumn(
            step=0.01,
        ),
        "col_2": st.column_config.DatetimeColumn(),
    },
)

st.header("Date column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [
                datetime.date(2021, 1, 1),
                datetime.date(2022, 1, 2),
                datetime.date(2023, 1, 3),
                None,
            ],
            "col_1": [
                "2021-01-01T01:00:00",
                "2022-01-02T02:00:00",
                "invalid",
                None,
            ],
            "col_2": [
                datetime.datetime(2021, 1, 1, 1, 0, 0, 123000),
                datetime.datetime(2022, 1, 2, 2, 0, 0, 234000),
                datetime.datetime(2023, 1, 3, 3, 0, 0, 345000),
                None,
            ],
        }
    ),
    column_config={
        "col_0": st.column_config.DateColumn(
            "Date column",
            width="medium",
            help="This is a date column",
            required=True,  # Should be ignored
            disabled=False,  # Should be ignored
            default=datetime.date(2021, 1, 1),  # Should be ignored
            min_value=datetime.date(2021, 1, 1),  # Should be ignored
            max_value=datetime.date(2022, 1, 1),  # Should be ignored
            step=2,  # Should be ignored
        ),
        "col_1": st.column_config.DateColumn(),
        "col_2": st.column_config.DateColumn(),
    },
)

st.header("Time column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [
                datetime.time(1, 2, 0, 123000),
                datetime.time(2, 3, 0, 234000),
                datetime.time(3, 4, 0, 345000),
                None,
            ],
            "col_1": [
                "2021-01-01T01:02:00",
                "2022-01-02T02:03:00",
                "invalid",
                None,
            ],
            "col_2": [
                datetime.datetime(2021, 1, 1, 1, 0, 0, 123000),
                datetime.datetime(2022, 1, 2, 2, 0, 0, 234000),
                datetime.datetime(2023, 1, 3, 3, 0, 0, 345000),
                None,
            ],
        }
    ),
    column_config={
        "col_0": st.column_config.TimeColumn(
            "Time column",
            width="medium",
            help="This is a time column",
            required=True,  # Should be ignored
            disabled=False,  # Should be ignored
            default=datetime.time(1, 2, 0),  # Should be ignored
            min_value=datetime.time(1, 2, 0),  # Should be ignored
            max_value=datetime.time(1, 3, 0),  # Should be ignored
            step=datetime.timedelta(milliseconds=1),
        ),
        "col_1": st.column_config.TimeColumn(
            format="HH:mm",
        ),
        "col_2": st.column_config.TimeColumn(),
    },
)

st.header("Progress column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [0.1, 0.4, 1.1, None],
            "col_1": ["200", "550", "1000", None],
        }
    ),
    column_config={
        "col_0": st.column_config.ProgressColumn(
            "Progress column",
            width="medium",
            help="This is a progress column",
        ),
        "col_1": st.column_config.ProgressColumn(
            format="$%f", min_value=0, max_value=1000
        ),
    },
)

st.header("List column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [[1, 2], [2, 3, 4], [], None],
            "col_1": ["a,b", "c,d,e", "", None],
        }
    ),
    column_config={
        "col_0": st.column_config.ListColumn(
            "List column",
            width="medium",
            help="This is a list column",
        ),
        "col_1": st.column_config.ListColumn(),
    },
)

st.header("Bar chart column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [[1, 5, 2], [2, 3, 5, -4, -5], [], None],
            "col_1": ["1,2,3,4", "6, 5, 1, 10", "invalid", None],
        }
    ),
    column_config={
        "col_0": st.column_config.BarChartColumn(
            "Bar chart column",
            width="medium",
            help="This is a bar chart column",
            y_min=-5,
            y_max=5,
        ),
        "col_1": st.column_config.BarChartColumn(),
    },
)


st.header("Line chart column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [[1, 5, 2], [2, 3, 5, -4, -5], [], None],
            "col_1": ["1,2,3,4", "6, 5, 1, 10", "invalid", None],
        }
    ),
    column_config={
        "col_0": st.column_config.LineChartColumn(
            "Line chart column",
            width="medium",
            help="This is a line chart column",
            y_min=-5,
            y_max=5,
        ),
        "col_1": st.column_config.LineChartColumn(),
    },
)

st.header("Area chart column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [[1, 5, 2], [2, 3, 5, -4, -5], [], None],
            "col_1": ["1,2,3,4", "6, 5, 1, 10", "invalid", None],
        }
    ),
    column_config={
        "col_0": st.column_config.AreaChartColumn(
            "Area chart column",
            width="medium",
            help="This is an area chart column",
            y_min=-5,
            y_max=5,
        ),
        "col_1": st.column_config.AreaChartColumn(),
    },
)


st.header("Image column:")

st.dataframe(
    pd.DataFrame(
        {
            "col_0": [
                "https://streamlit.io/images/brand/streamlit-mark-color.png",
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAABSCAMAAACBpt1yAAAAwFBMVEVHcEyAhJWAhJUzNT97f4+AhJWAhJVtcH9WWWaAhJWAhJWAhJVCRFGAhJWAhJWAhJVVWGeAhJWAhJWAhJVVWGcmJzCAhJWAhJWAhJUmJzAmJzBVWGcmJzAmJzAmJzAmJzAmJzCAhJUmJzBVWGcmJzAmJzAmJzBVWGeAhJVVWGdVWGdVWGeAhJVVWGdVWGdVWGdvcoJVJ2WAhJVVWGcmJzBTVmVaXWx8f5B1eYlhZHNoa3tDRVI3OUQtLzhucoJMT13kXsyQAAAAMXRSTlMA+SYWE/ExBQvmfME1P7Uc9lhpjSdsTZ7cnETlsyP6xvHNg7XXV+bYq6NjTtR1yJLh8/IzCQAABHhJREFUaN7Nmut2mkAYRZGLIMQbRMFbvMQYkmjS9YFJU23z/m9VwEpgGJgZYLo4/2ratXbdhyNMFIS68jzzXm+EpuVl5nne623DqKRXL8yb2iyst4jKG7w0S+HgguU93jZPYZin5mhU32Iqb/DcPIWN0phQGGnUGqewQRpTChuj8fbVQ1ODRnVsDeUaFVbXuBhtpsJYgZYxLP3fUzMKK2qURlvf3wkWBGn1xiVX8PbRw6WsRmm09MOE71YYxe2qNSmMUkqj9rC8i6hWgmzAJYrdVqtfhRU0ag/zC5TvzwVBh2s6drsehWHuGTVq0xjKXz0IgtiBbzBLZFL45OWHSaM6naz8OEspeMWGRBydAex5UIA1Y7iDvklC+f4ofG3cSnLBXu9XV8ik8WayS0L5u0X4qryGdNYm1b5qT4VU3uBAt56bNJTvTy6Xng5o1jTDX6iQVuNis0Wg/Lvp5UftToaLYvgJCqk0RpOOJix8dBm4kA1p+EkKoxyoJh3J5vrzYQvDRRh+okKSRuk66Uh28b/JlD4e/m4FhZFGmTzp+MLjS08YfiqF+RqTk44W/uH7r2FKXzz8VArzNKrT+crPy7XwuaWPwbLDfzPzaJPRqCKTnlf4/NJ/fyKlh1+79+hzKJ703MKH6e+hMPvU8B8YqNIas5OOZJ6eOgsISXwiMShMa8RMekHhw3QVElc8/EwKExqxk45kKyFF7AEx/4b/wEjlzV4ooZDChzGBIsHwsyqMNEpazqQjWU1RrL4DVGD2vXdk55rTQGUKT1X6a/58MmN9namo7kbZ7SWX/pqPP+/MXL9psLYLzOeUAdT5+MUIdjzRvFkT3OenCcAP7HguU/gwosPCBT9/vTN0/0jWeLfE38zaABzByBpH+Fsz+tLHYJ/Ua3Ekatwt8FiyAcARjKRxkneLbgJwBCNcjfjClyh9PGOfdVyNSyn3acQGKAf2Xl3jKP8hadwCrmAn2tvS6qVnASvQOCl6WNahfGiGP1cjeluKlL5TgYtmX0/shRfQMzgOYHkaN8VnKKVLTztjeI07wplT3nFEfWBYjXPSIbcOwBnszFp4wnFETcOP0biViEfRLgBnsBNr4cnHEbXsK6pxRXHIWkPpSfuKapzTHJXrALzBToyFD8vVVoA72Jn0HMat9IXDn9K4EahSV+mLZuyL5rYUOY7YA/AGS3w2zml/N2QBcAc7/qa4La36ZEa3r0fc1UhX+Og4ogfABwxzNU7of+1oAvABe89opC08wxlcxRn7It+W8i89BuzMUnhepU+AHWONuwULlmYAx8TD/1X8HPbfSo/M2PE0ZaIqeRzBDMb6JQ7BbAF/sBnzt41VXeHN9fGjxJdn1bHBF0xx20KZyF3d7hn7jlKvz5bi7A3X1rsVvqqnarLYHg9N3XIDQqejlGJsKUrHWRs929LNYbctylpt3+VVVVnui+1uwBhAWrbb6xnGer13HKeTSvCCs1+vDaPnurYVgJjDcYDSr5GlEDN4J+V+EFEU23GCP4jBa7IcUKilOf4CgQRuuzC9EJcAAAAASUVORK5CYII=",
                "data:image/svg+xml,%3Csvg width='301' height='165' viewBox='0 0 301 165' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M150.731 101.547L98.1387 73.7471L6.84674 25.4969C6.7634 25.4136 6.59674 25.4136 6.51341 25.4136C3.18007 23.8303 -0.236608 27.1636 1.0134 30.497L47.5302 149.139L47.5385 149.164C47.5885 149.281 47.6302 149.397 47.6802 149.514C49.5885 153.939 53.7552 156.672 58.2886 157.747C58.6719 157.831 58.9461 157.906 59.4064 157.998C59.8645 158.1 60.5052 158.239 61.0552 158.281C61.1469 158.289 61.2302 158.289 61.3219 158.297H61.3886C61.4552 158.306 61.5219 158.306 61.5886 158.314H61.6802C61.7386 158.322 61.8052 158.322 61.8636 158.322H61.9719C62.0386 158.331 62.1052 158.331 62.1719 158.331V158.331C121.084 164.754 180.519 164.754 239.431 158.331V158.331C240.139 158.331 240.831 158.297 241.497 158.231C241.714 158.206 241.922 158.181 242.131 158.156C242.156 158.147 242.189 158.147 242.214 158.139C242.356 158.122 242.497 158.097 242.639 158.072C242.847 158.047 243.056 158.006 243.264 157.964C243.681 157.872 243.87 157.806 244.436 157.611C245.001 157.417 245.94 157.077 246.527 156.794C247.115 156.511 247.522 156.239 248.014 155.931C248.622 155.547 249.201 155.155 249.788 154.715C250.041 154.521 250.214 154.397 250.397 154.222L250.297 154.164L150.731 101.547Z' fill='%23FF4B4B'/%3E%3Cpath d='M294.766 25.4981H294.683L203.357 73.7483L254.124 149.357L300.524 30.4981V30.3315C301.691 26.8314 298.108 23.6648 294.766 25.4981' fill='%237D353B'/%3E%3Cpath d='M155.598 2.55572C153.264 -0.852624 148.181 -0.852624 145.931 2.55572L98.1389 73.7477L150.731 101.548L250.398 154.222C251.024 153.609 251.526 153.012 252.056 152.381C252.806 151.456 253.506 150.465 254.123 149.356L203.356 73.7477L155.598 2.55572Z' fill='%23BD4043'/%3E%3C/svg%3E%0A",
                "",
                None,
            ],
        }
    ),
    column_config={
        "col_0": st.column_config.ImageColumn(
            "Image column",
            width="medium",
            help="This is a image column",
        ),
    },
)

st.subheader("Long colum header")
st.dataframe(
    pd.DataFrame(
        np.random.randn(100, 15),
        columns=[
            "this is a very long column header name",
            "A",
            "Short header",
            "B",
            "this is another very very column long header name",
            "C",
            "this is another very very very very very very very very very very very very very very very long header name",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J",
            "K",
        ],
    )
)

st.subheader("Hierarchical headers")

df = pd.DataFrame(
    np.random.randn(3, 5),
    index=["A", "B", "C"],
    columns=pd.MultiIndex.from_tuples(
        [
            ("a", "b", "c"),
            ("a", "b", "d"),
            ("e", "f", "c"),
            ("g", "h", "d"),
            ("", "h", "i"),
        ],
        names=["first", "second", "third"],
    ),
)

st.dataframe(df)
