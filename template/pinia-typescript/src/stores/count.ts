import { ref, computed } from '@vue-mini/core';
import { defineStore } from '@vue-mini/pinia';

export const useCountStore = defineStore('count', () => {
  const count = ref(0);
  const double = computed(() => count.value * 2);

  const increment = () => {
    count.value++;
  };

  return { count, double, increment };
});
