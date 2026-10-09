// Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { appendFileSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const [noticesPath, packagePath] = process.argv.slice(2)

if (noticesPath === undefined || packagePath === undefined) {
  throw new Error(
    "Usage: append_missing_dependency_license.mjs <NOTICES path> <package path>"
  )
}

const packageManifest = JSON.parse(
  readFileSync(join(packagePath, "package.json"), "utf8")
)
const packageName = packageManifest.name

if (typeof packageName !== "string" || packageName.length === 0) {
  throw new Error(
    `${packagePath}/package.json does not declare a package name`
  )
}

const notices = readFileSync(noticesPath, "utf8")
const noticeHeadingPrefix =
  "The following software may be included in this product: "
const includedPackages = notices
  .split("\n")
  .filter(line => line.startsWith(noticeHeadingPrefix))
  .flatMap(line =>
    line.slice(noticeHeadingPrefix.length).split(". ", 1)[0].split(", ")
  )

if (includedPackages.includes(packageName)) {
  throw new Error(
    `${packageName} is already in ${noticesPath}; remove its fallback from make update-notices`
  )
}

const packageFiles = readdirSync(packagePath).toSorted()
const licenseFilename = packageFiles.find(filename => {
  const lowerFilename = filename.toLowerCase()
  return (
    lowerFilename === "license" ||
    lowerFilename.startsWith("license.") ||
    lowerFilename === "unlicense" ||
    lowerFilename.startsWith("unlicense.")
  )
})

if (licenseFilename === undefined) {
  throw new Error(`${packageName} does not contain a license file`)
}

const noticeFilename = packageFiles.find(filename => {
  const lowerFilename = filename.toLowerCase()
  return lowerFilename === "notice" || lowerFilename.startsWith("notice.")
})

const repository =
  typeof packageManifest.repository === "string"
    ? packageManifest.repository
    : packageManifest.repository?.url
const sourceUrl = repository ?? packageManifest.homepage
const sourceSentence =
  typeof sourceUrl === "string" && sourceUrl.length > 0
    ? ` A copy of the source code may be downloaded from ${sourceUrl}.`
    : ""

const normalizeText = text => text.replaceAll("\r\n", "\n").trim()
const licenseText = normalizeText(
  readFileSync(join(packagePath, licenseFilename), "utf8")
)
const noticeText =
  noticeFilename === undefined
    ? ""
    : `\n\nNOTICE\n\n${normalizeText(
        readFileSync(join(packagePath, noticeFilename), "utf8")
      )}`

appendFileSync(
  noticesPath,
  `-----\n\nThe following software may be included in this product: ${packageName}.${sourceSentence} This software contains the following license and notice below:\n\n${licenseText}${noticeText}\n\n`
)
