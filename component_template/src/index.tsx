import React from "react"
import ReactDOM from "react-dom"
import MyComponent from "./MyComponent"

import "./index.css"

ReactDOM.render(
  <React.StrictMode>
    <MyComponent />
  </React.StrictMode>,
  document.getElementById("root")
)

// For a non-React, "vanilla" implementation, delete everything above this
// line, and uncomment this:
// import "./VanillaComponent"
