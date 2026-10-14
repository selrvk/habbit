/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';

test('opens on the welcome screen on a fresh install', async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<App />);
  });

  const texts = app.root.findAllByType(Text).map(t => t.props.children);
  expect(texts).toContain('YOUR DAILY COMPANION');

  // Unmounting clears the app's timers (the midnight rollover), so Jest can exit.
  await ReactTestRenderer.act(async () => app.unmount());
});
