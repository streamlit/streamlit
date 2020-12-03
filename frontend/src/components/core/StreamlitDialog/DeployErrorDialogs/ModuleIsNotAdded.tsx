import React from "react"
import { IDeployErrorDialog } from "./types"

function ModuleIsNotAdded(module: string): IDeployErrorDialog {
  return {
    title: "Error deploying app",
    body: (
      <>
        <p>
          The file <strong>{module}</strong> has not been added to the repo.
        </p>
        <p>Please add it and push to Github to continue.</p>
      </>
    ),
  }
}

export default ModuleIsNotAdded
