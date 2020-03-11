from streamlit.MediaFileManager import media_file_manager

import streamlit as st
import cv2

text_placeholder = st.empty()

image_placeholder = st.empty()
if st.button("Start"):
    video = cv2.VideoCapture(
        "https://videos3.earthcam.com/fecnetwork/9974.flv/chunklist_w372707020.m3u8?__fvd__"
    )
    while True:
        success, image = video.read()
        image_placeholder.image(image)  # ttl=20)      # , replace=True)

        text_placeholder.markdown("%r" % media_file_manager._files)


# Expire by date:
#       * User-set param on media protos specifying a TTL in ?seconds.
#       * MFM keeps index of files sorted by timestamp (fast)
#       * MFM removes files older than user specified expire time (O(n))
#       * Trigger for check: when new files are added to session  (O(n log n))
#
# Expire by obsolence:
#       * User-set flag on media protos telling Streamlit to "replace" files for same widget ID
#       * MFM keeps a map of widget IDs to file hashes.
#       * If file is added with same widget ID, it replaces the
#       * Not as versatile a feature as expire-by-date.
