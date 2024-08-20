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

import streamlit as st


class Message:
    def __init__(self, type, content):
        self.type = type
        self.content = content


class MessageHistory:
    def __init__(self):
        if "messages" not in st.session_state:
            st.session_state["messages"] = []

    def add_user_message(self, content):
        st.session_state["messages"].append(Message("user", content))

    def add_ai_message(self, content):
        st.session_state["messages"].append(Message("ai", content))

    def add_chat_message(self, role, content):
        st.session_state["messages"].append(Message(role, content))

    @property
    def messages(self):
        return st.session_state["messages"]


msgs = MessageHistory()

# Start streamlit app
if len(msgs.messages) == 0:
    intro_message = "Hello! How can I help you?"
    msgs.add_ai_message(intro_message)

for msg in msgs.messages:
    with st.chat_message(msg.type):
        st.write(msg.content)

if user_input := st.chat_input("Ask a question:"):
    st.chat_message("human").write(user_input.replace("$", r"\$"))
    msgs.add_user_message(user_input)

    with st.chat_message("ai"):
        with st.spinner("Thinking..."):
            import time

            time.sleep(3)
            response = {"answer": "I am a response from AI"}
        st.write(response["answer"])
        msgs.add_ai_message(response["answer"])
# st.write("Hello, world!")
# st.set_page_config(
#     page_title="My Streamlit App",
#     page_icon=":shark:",
#     layout="wide",
#     initial_sidebar_state="expanded",
# )

# with st.spinner(text="In progress..."):
#     time.sleep(100)

# # import geodatasets
# # import geopandas

# # colombia = geopandas.read_file(geodatasets.get_path("geoda.malaria"))
# # st.write(colombia)
# # st.dataframe(colombia)
# # st.data_editor(colombia)

# # from datasets import load_dataset

# # ds = load_dataset("rotten_tomatoes", split="validation")
# # st.dataframe(ds)
# # st.write(ds)
# # st.write(str(type(ds)))
# # return_val = st.data_editor(ds)
# # st.write(str(type(return_val)))

# # import ibis

# # t = ibis.examples.penguins.fetch()
# # st.write(t)
# # st.dataframe(t)
# # st.write(str(type(t)))

# from pydantic import BaseModel, validator

# import streamlit as st


# class UserModel(BaseModel):
#     name: str
#     username: str
#     password1: str
#     password2: str

#     @validator("name")
#     def name_must_contain_space(cls, v):
#         if " " not in v:
#             raise ValueError("must contain a space")
#         return v.title()
# col1, col2, col3, col4, col5, col6 = st.columns(6)
# with col1:
#     st.button(":material/delete: Delete", use_container_width=True)
# with col2:
#     st.button(":material/edit: Edit", use_container_width=True)
# with col3:
#     st.button(":material/visibility: Show", use_container_width=True)

# # generate random dataframe :
# import numpy as np

# df = pd.DataFrame(np.random.randn(50, 20), columns=[f"col{i}" for i in range(20)])

# st.dataframe(df)
