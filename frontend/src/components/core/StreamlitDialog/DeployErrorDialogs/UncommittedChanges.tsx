import React from "react"
import { IDeployErrorDialog } from "./types"

function UncommittedChanges(repository: string): IDeployErrorDialog {
  const repoName = repository
    .split("/")
    .slice(1)
    .join("/")

  return {
    title: "Unable to deploy app",
    body: (
      <>
        <p>
          Your repository <code>{repoName}</code> has uncommitted changes.
        </p>
        <p>Please commit the latest changes and push to GitHub to continue.</p>
      </>
    ),
  }
}

export default UncommittedChanges
