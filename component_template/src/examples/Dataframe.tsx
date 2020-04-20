import React, { useEffect } from "react"
import { ComponentProps, connectToStreamlit } from "../StreamlitComponent"
import Table from "../components/Table/"

/**
 * Dataframe example using Apache Arrow.
 */

const Dataframe = (props: ComponentProps) => {
  useEffect(() => {
    props.updateFrameHeight()
  })

  return <Table element={props.args.data} />
}

export default connectToStreamlit(Dataframe)
