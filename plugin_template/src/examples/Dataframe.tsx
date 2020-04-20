import React, { useEffect } from "react";
import { ComponentProps, StreamlitComponent } from "../StreamlitComponent";
import Table from "../components/Table/";

/**
 * Dataframe example using Apache Arrow.
 */

const Dataframe = (props: ComponentProps) => {
  useEffect(() => {
    props.updateFrameHeight();
  });

  return <Table element={props.args.data} />;
};

export default StreamlitComponent(Dataframe);
