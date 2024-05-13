import { defineComponent, ref } from '@vue-mini/core';

defineComponent(() => {
  const greeting = ref('Welcome to Vue Mini');

  return {
    greeting,
  };
});
