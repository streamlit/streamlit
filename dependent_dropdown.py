import pandas as pd
import streamlit as st
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode, DataReturnMode
from st_aggrid.shared import JsCode

"@author Jallepalli Harsha Vardhan"
# Title and instructions
st.title("Interactive Data Table")

# Upload a CSV file
uploaded_file = st.file_uploader("Upload a CSV file", type=["csv"])

if uploaded_file is not None:
    data_df = pd.read_csv(uploaded_file)

    # Define column names for category and tools
    category_column = st.text_input("Enter the name of the category column:", "Category")
    tools_column = st.text_input("Enter the name of the tools column:", "Tools")

    # Create a dictionary to map categories to tool options
# Create a dictionary to map categories to tool options
    categories_tools_mapping = {}
    st.write("Define tool options for each category:")
    input_count = 0  # Initialize a counter for unique keys
    while True:
        input_count += 1  # Increment the counter
        category_name = st.text_input(f"Category Name {input_count} (or leave empty to stop):")
        if not category_name:
            break
        tools_options = st.text_input(f"Tools Options for {category_name} (comma-separated):")
        categories_tools_mapping[category_name] = tools_options.split(',')


    # Create a JavaScript function for dynamic dropdown options
    get_tools_values = JsCode(
    """
    function gettoolsValues(params) {
      var category = params.data['"""+category_column+"""'];
      var toolsValues = """+str(categories_tools_mapping)+""";
      return {values: toolsValues[category] || []};
    }
    """
    )

    # Configure the grid options for AgGrid
    gridOptions = {
        'defaultColDef': {
            'editable': True,
            'resizable': True,
        },
        'columnDefs': [
            {
                'field': category_column,
                'cellEditor': 'agSelectCellEditor',
                'cellEditorParams': {
                    'values': list(categories_tools_mapping.keys())
                },
            },
            {
                'field': tools_column,
                'cellEditorParams': get_tools_values,
                'cellEditor': 'agSelectCellEditor'
            },
        ],
    }

    options_builder = GridOptionsBuilder.from_dataframe(data_df)
    grid_options = options_builder.build()

    # Display the data frame using AgGrid
    response = AgGrid(data_df, gridOptions=gridOptions, data_return_mode=DataReturnMode.FILTERED_AND_SORTED, allow_unsafe_jscode=True, editable=True, grid_options=grid_options)

    # Get the updated data frame from the response object
    updated_df = response["data"]

    # Create a download button to download the updated table as a CSV file
    st.download_button(
        label="Download as CSV",
        data=updated_df.to_csv(index=False).encode("utf-8"),
        file_name="updated_table.csv",
        mime="text/csv",
    )
