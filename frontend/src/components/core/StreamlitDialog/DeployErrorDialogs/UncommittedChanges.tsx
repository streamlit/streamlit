import React from "react"
import { IDeployErrorDialog } from "./types"

function UncommittedChanges(module: string): IDeployErrorDialog {
  return {
    title: "Unable to deploying app",
    body: (
      <>
        <p>
          The file <code>{module}</code> has uncommitted changes.
        </p>
        <p>Please commit the latest changes and push to Github to continue.</p>
      </>
    ),
  }
}

export default UncommittedChanges
