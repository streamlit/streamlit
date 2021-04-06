import React from "react"
import { IDeployErrorDialog } from "./types"

function ModuleIsNotAdded(module: string): IDeployErrorDialog {
  return {
    title: "Unable to deploy app",
    body: (
      <>
        <p>
          The file <code>{module}</code> has not been added to the repo.
        </p>
        <p>Please add it and push to GitHub to continue.</p>
      </>
    ),
  }
}

export default ModuleIsNotAdded
