// Disable Typescript checking, since mm.track and identify have private scope
// @ts-nocheck
// This file is only used in tests, so these imports can be in devDependencies
/* eslint-disable import/no-extraneous-dependencies */
import jest from "jest-mock"
import { MetricsManager } from "./MetricsManager"

export function getMetricsManagerForTest(): MetricsManager {
  const mm = new MetricsManager()
  mm.track = jest.fn()
  mm.identify = jest.fn()
  return mm
}
