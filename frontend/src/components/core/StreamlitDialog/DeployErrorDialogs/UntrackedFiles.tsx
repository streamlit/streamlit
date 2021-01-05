import React from "react"
import { IDeployErrorDialog } from "./types"

function UntrackedFiles(): IDeployErrorDialog {
  return {
    title: "Unable to deploy app",
    body: (
      <>
        <p>
          This Git repo has untracked files. You may want to commit them before
          continuing.
        </p>
        <p>
          Alternatively, you can either delete the files (if they're not
          needed) or add them to your <strong>.gitignore</strong>.
        </p>
      </>
    ),
  }
}

export default UntrackedFiles
