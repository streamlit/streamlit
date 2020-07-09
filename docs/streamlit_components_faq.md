# Streamlit Components Frequently Asked Questions

1. **How do Streamlit Components differ from functionality provided in the base Streamlit package?**

   Tim or Henrik

2. **What types of things _*aren't possible*_ with Streamlit Components?**

   Because each Streamlit Component gets mounted into its own sandboxed iframe, this implies a few limitations on what is possible with Components:

   - **Can't communicate with other Components**: Components can’t contain (or otherwise communicate with) other components, so Components cannot be used to build something like `grid_layout`
   - **Can't modify CSS**: A Component can’t modify the CSS that the rest of the Streamlit app uses, so you can't create something like `dark_mode`
   - **Can't add/remove elements**: A Component can’t add or remove other elements of a Streamlit app, so you couldn't make something like `remove_streamlit_hamburger_menu`

3. **How do I build a Component that can be displayed in the sidebar?**

   Tim or Henrik

4. **My Component seems to be blinking/stuttering...how do I fix that?**

   Currently, no automatic debouncing of Component updates is performed within Streamlit. The Component creator themselves can decide to rate-limit the updates they send back to Streamlit.
