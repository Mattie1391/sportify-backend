<template>
  <div>
    <h1>播放器測試</h1>
    <HlsPlayer :src="m3u8Url" />
  </div>
</template>

<script setup>
import HlsPlayer from "../components/HlsPlayer.vue";
import { ref, onMounted } from "vue";

const m3u8Url = ref("");

onMounted(async () => {
  const res = await fetch("/api/v1/mux/get-play-url");
  const data = await res.json();
  m3u8Url.value = data.url;
});
</script>
