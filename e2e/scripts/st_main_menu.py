import streamlit as st

# Not possible to test the urls in the menu as they are hidden behind
# the click handler of the button
# https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/testing-dom__tab-handling-links/cypress/integration/tab_handling_anchor_links_spec.js
from streamlit.commands.page_config import MenuItems

menu_items: MenuItems = {"about": "_*This can be markdown!*_"}
st.set_page_config(menu_items=menu_items)
