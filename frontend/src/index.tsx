import React from "react"
import ReactDOM from "react-dom"

import { Client as Styletron } from "styletron-engine-atomic"
import { Provider as StyletronProvider } from "styletron-react"
import ThemedApp from "./ThemedApp"

const engine = new Styletron({ prefix: "st-" })

ReactDOM.render(
  <StyletronProvider value={engine}>
    <ThemedApp />
  </StyletronProvider>,
  document.getElementById("root")
)
