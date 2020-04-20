import { PureComponent, ReactNode } from "react"
import { ComponentProps, StreamlitComponent } from "../StreamlitComponent"

class BuggyComponent extends PureComponent<ComponentProps> {
  public render = (): ReactNode => {
    throw new Error("I explode!")
    return null
  }
}

export default StreamlitComponent(BuggyComponent)
