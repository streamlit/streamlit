import { PureComponent, ReactNode } from "react"
import { ComponentProps, connectToStreamlit } from "../StreamlitComponent"

class BuggyComponent extends PureComponent<ComponentProps> {
  public render = (): ReactNode => {
    throw new Error("I explode!")
    return null
  }
}

export default connectToStreamlit(BuggyComponent)
