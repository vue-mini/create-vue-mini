import { defineComponent, ref } from '@vue-mini/core';

defineComponent(() => {
  const greeting = ref('Have a fun journey');

  return {
    greeting,
  };
});
