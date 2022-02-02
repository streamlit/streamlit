import streamlit as st

import os, fnmatch


def is_assets_favicon_path(path):
    if "assets/favicon.ico" in path:
        return path


def filter_nones(l):
    return list(filter(None, l))


def find(pattern, path):
    result = []
    for root, dirs, files in os.walk(path):
        for name in files:
            if fnmatch.fnmatch(name, pattern):
                result.append(os.path.join(root, name))
    return result


paths = find("favicon.ico", "../..")
filtered_paths = filter_nones(list(map(is_assets_favicon_path, paths)))

if len(filtered_paths) != 1:
    print("Can't seem to find assets/favicon.ico in the directory you're in.")
else:
    st.set_page_config(
        page_icon=filtered_paths[0],
    )
