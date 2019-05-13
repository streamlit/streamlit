/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import * as format from './format';

test('class Duration constructor', () => {
  const duration = new format.Duration(1234);
  expect(duration.getTime()).toBe(1234);
});
