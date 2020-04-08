import { PureComponent, ReactNode } from "react";
import StreamlitPlugin from "../PluginWrapper";
import { StComponentProps } from "../StComponentAPI";

class BuggyPlugin extends PureComponent<StComponentProps> {
  public render = (): ReactNode => {
    throw new Error("I explode!");
    return null;
  };
}

export default StreamlitPlugin(BuggyPlugin);
