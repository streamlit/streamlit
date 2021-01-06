import React from "react"
import { IDeployErrorDialog } from "./types"

function RepoIsAhead(): IDeployErrorDialog {
  return {
    title: "Unable to deploy app",
    body: (
      <>
        <p>
          This Git repo has uncommitted changes. You may want to commit them
          before continuing.
        </p>
      </>
    ),
  }
}

export default RepoIsAhead
