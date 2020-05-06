import { ReactNode } from "react"
import { withStreamlitConnection, StreamlitComponent } from "../streamlit"

class BuggyComponent extends StreamlitComponent {
  public render = (): ReactNode => {
    throw new Error("I explode!")
    return null
  }
}

export default withStreamlitConnection(BuggyComponent)
