import { ReactNode } from "react"
import { connectToStreamlit, StreamlitComponent } from "../streamlit"

class BuggyComponent extends StreamlitComponent {
  public render = (): ReactNode => {
    throw new Error("I explode!")
    return null
  }
}

export default connectToStreamlit(BuggyComponent)
