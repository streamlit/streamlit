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


# We want to find the file from 2 directories behind for circle ci
# and for local testing if you are in the e2e/scripts folder
# if you are in the root streamlit directory,
# this script still work but will be slower likely.
paths = find("favicon.ico", "../..")
filtered_paths = filter_nones(list(map(is_assets_favicon_path, paths)))

if len(filtered_paths) != 1:
    print("Can't seem to find assets/favicon.ico in the directory you're in.")
else:
    st.set_page_config(
        page_icon=filtered_paths[0],
    )
