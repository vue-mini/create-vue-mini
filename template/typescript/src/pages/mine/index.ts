import { defineComponent, ref } from '@vue-mini/core';

defineComponent(() => {
  const count = ref(0);

  const increment = () => {
    count.value += 1;
  };

  return { count, increment };
});
