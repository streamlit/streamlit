/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import { SessionInfo } from 'lib/SessionInfo'
import { getMetricsManagerForTest } from 'lib/MetricsManagerTestUtils'


beforeEach(() => {
  SessionInfo.current = new SessionInfo({
    streamlitVersion: 'sv',
    installationId: 'iid',
    authorEmail: 'ae',
  })
})


afterEach(() => {
  SessionInfo['singleton'] = null
})


test('does not track while uninitialized', () => {
  const mm = getMetricsManagerForTest()

  mm.enqueue('ev1', {data1: 11})
  mm.enqueue('ev2', {data2: 12})
  mm.enqueue('ev3', {data3: 13})

  expect(mm['track'].mock.calls.length).toBe(0)
  expect(mm['identify'].mock.calls.length).toBe(0)
})


test('does not track when initialized with gatherUsageStats=false', () => {
  const mm = getMetricsManagerForTest()
  mm.initialize({gatherUsageStats: false})

  mm.enqueue('ev1', {data1: 11})
  mm.enqueue('ev2', {data2: 12})
  mm.enqueue('ev3', {data3: 13})

  expect(mm['track'].mock.calls.length).toBe(0)
  expect(mm['identify'].mock.calls.length).toBe(0)
})


test('enqueues events before initialization', () => {
  const mm = getMetricsManagerForTest()

  mm.enqueue('ev1', {data1: 11})
  mm.enqueue('ev2', {data2: 12})
  mm.enqueue('ev3', {data3: 13})

  expect(mm['track'].mock.calls.length).toBe(0)

  mm.initialize({gatherUsageStats: true})

  expect(mm['track'].mock.calls.length).toBe(3)
  expect(mm['identify'].mock.calls.length).toBe(1)
})


test('tracks events immediately after initialized', () => {
  const mm = getMetricsManagerForTest()
  mm.initialize({gatherUsageStats: true})

  expect(mm['track'].mock.calls.length).toBe(0)
  mm.enqueue('ev1', {data1: 11})
  expect(mm['track'].mock.calls.length).toBe(1)
  mm.enqueue('ev2', {data2: 12})
  expect(mm['track'].mock.calls.length).toBe(2)
  mm.enqueue('ev3', {data3: 13})
  expect(mm['track'].mock.calls.length).toBe(3)
})


test('increments deltas', () => {
  const mm = getMetricsManagerForTest()

  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('bar')
  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('bar')

  const counter = mm.getDeltaCounter()

  expect(counter.foo).toBe(3)
  expect(counter.bar).toBe(2)
  expect(counter.boz).toBeUndefined()
})


test('clears deltas', () => {
  const mm = getMetricsManagerForTest()

  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('bar')
  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('bar')

  mm.clearDeltaCounter()
  const counter = mm.getDeltaCounter()

  expect(Object.keys(counter).length).toBe(0)
})


test('clears deltas automatically on read', () => {
  const mm = getMetricsManagerForTest()

  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('bar')
  mm.incrementDeltaCounter('foo')
  mm.incrementDeltaCounter('bar')

  const counter1 = mm.getDeltaCounter()
  const counter2 = mm.getDeltaCounter()

  expect(Object.keys(counter1).length).toBe(2)
  expect(Object.keys(counter2).length).toBe(0)
})
