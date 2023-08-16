<template>
  <button @pointerdown.stop="" @dblclick.stop="" @click="data.onClick">
    {{ data.label }}
  </button>
</template>

<script>
export default {
  props: ['data'],
  created() {
    console.log(this.data);
  },
};
</script>
