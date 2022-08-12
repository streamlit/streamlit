from streamlit.web.cli import main

if __name__ == "__main__":
    # Set prog_name so that the Streamlit server sees the same command line
    # string whether streamlit is called directly or via `python -m streamlit`.
    main(prog_name="streamlit")
