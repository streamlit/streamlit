import React from "react"
import ReactDOM from "react-dom"
import SelectableDataTable from "./SelectableDataTable"
import { Streamlit } from "./streamlit"

// Load the default Streamlit CSS
Streamlit.loadStreamlitCSS()

ReactDOM.render(<SelectableDataTable />, document.getElementById("root"))
