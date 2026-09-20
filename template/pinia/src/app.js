import { createApp } from '@vue-mini/core';
import './pinia';

createApp(
  {},
  // https://vuemini.org/guide/performance.html
  { respectHints: true },
);
