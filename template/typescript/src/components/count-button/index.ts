import { defineComponent, computed } from '@vue-mini/core';

defineComponent({
  properties: {
    count: Number,
  },
  setup(props, context) {
    const double = computed(() => props.count * 2);

    const increment = () => {
      context.triggerEvent('increment');
    };

    return { double, increment };
  },
});
