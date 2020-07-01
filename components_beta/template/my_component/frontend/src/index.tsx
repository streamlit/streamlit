import React from "react"
import ReactDOM from "react-dom"
import MyComponent from "./MyComponent"
import { Streamlit } from "./streamlit"

// Load the default Streamlit CSS
Streamlit.loadStreamlitCSS()

ReactDOM.render(
  <React.StrictMode>
    <MyComponent />
  </React.StrictMode>,
  document.getElementById("root")
)
