import React from "react"
import ReactDOM from "react-dom"
import CustomDataframe from "./CustomDataframe"
import { Streamlit } from "./streamlit"

// Load the default Streamlit CSS
Streamlit.loadStreamlitCSS()

ReactDOM.render(
  <React.StrictMode>
    <CustomDataframe />
  </React.StrictMode>,
  document.getElementById("root")
)
