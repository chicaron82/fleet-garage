import type { Modifier } from '@dnd-kit/core';

// Restricts drag movement to the vertical axis only.
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});
