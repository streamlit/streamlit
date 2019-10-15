# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st

st.title("Video Play Test")

# A random sampling of videos found around the web.  We should replace 
# these with those sourced from the streamlit community if possible!
vidurl = st.selectbox(
    "Pick a video to play",
    (
        "https://www.orthopedicone.com/u/home-vid-4.mp4",
        "http://www.oznibatista.com.br/video/video.ogg",
        "http://www.marmosetcare.com/video/in-the-wild/intro.webm",
    ),
)

fmt=vidurl.split('.')[1]

st.video(vidurl, format="video/"+fmt)
