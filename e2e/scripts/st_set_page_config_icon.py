import streamlit as st

import os, fnmatch

def isAssetsFaviconPath(path):
    if "assets/favicon.ico" in path:
        return path

def find(pattern, path):
    result = []
    for root, dirs, files in os.walk(path):
        for name in files:
            if fnmatch.fnmatch(name, pattern):
                result.append(os.path.join(root, name))
    return result

paths = find('favicon.ico', '.')
filtered_paths = list(filter(None, list(map(isAssetsFaviconPath, paths))))

if len(filtered_paths) != 1:
    print("Can't seem to find assets/favicon.ico in the directory you're in. Maybe go back to the Streamlit root directory and running 'streamlit run e2e/scripts/st_set_page_config_icon.py'")
else:
    st.set_page_config(
        page_icon=filtered_paths[0],
    )
