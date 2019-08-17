/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import { SessionInfo } from 'lib/SessionInfo'


test('Throws an error when used before initialization', () => {
  expect(() => SessionInfo.current).toThrow()
})
