import React from "react"
import ReactDOM from "react-dom"
import RadioButton from "./RadioButton"
import { Streamlit } from "./streamlit"

// Load the default Streamlit CSS
Streamlit.loadStreamlitCSS()

ReactDOM.render(
  <React.StrictMode>
    <RadioButton />
  </React.StrictMode>,
  document.getElementById("root")
)
