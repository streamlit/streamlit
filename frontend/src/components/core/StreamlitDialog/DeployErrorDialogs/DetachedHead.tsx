import React from "react"
import { IDeployErrorDialog } from "./types"

function DetachedHead(): IDeployErrorDialog {
  return {
    title: "Unable to deploying app",
    body: (
      <>
        <p>This Git tree is in a detached HEAD state.</p>
        <p>Please commit the latest changes and push to Github to continue.</p>
      </>
    ),
  }
}

export default DetachedHead
