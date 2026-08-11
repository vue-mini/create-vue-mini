import { defineComponent, ref } from '@vue-mini/core';

defineComponent((_, context) => {
  const greeting = ref('希望你会喜欢');

  const offset = wx.worklet.shared({ x: 0, y: 0 });

  const pan = (event) => {
    'worklet';
    if (event.state === 0 || event.state === 1) return;
    if (event.state === 2) {
      offset.value = {
        x: offset.value.x + event.deltaX,
        y: offset.value.y + event.deltaY,
      };
      return;
    }
    offset.value = { x: 0, y: 0 };
  };

  context.applyAnimatedStyle('.logo', () => {
    'worklet';
    return { transform: `translate(${offset.value.x}px, ${offset.value.y}px)` };
  });

  return { pan, greeting };
});
