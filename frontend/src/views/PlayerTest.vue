<template>
  <div>
    <h1>播放器測試</h1>
    <HlsPlayer :src="muxUrl" />
  </div>
</template>

<script setup>
import HlsPlayer from "../components/HlsPlayer.vue";
import { ref, onMounted } from "vue";
import { extractPlaybackUrl } from "@/utils/extractPlaybackUrl.js";

const muxUrl = ref("");

onMounted(async () => {
  //測試用先寫死課程id，並帶上token
  const courseId = "96722a83-3a29-4efb-b4ab-82426b176cda";
  const apiName = "userCourseDetails";
  const res = await fetch(`api/v1/users/courses/${courseId}/details`, {
    headers: {
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRkMjExMzQxLTk4ZDEtNDk2MS05NDk5LWQzZTgxMzMxYjNiOSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzUwMDc1ODExLCJleHAiOjE3NTI2Njc4MTF9.IpPaI7MSgeiphE3MqPFQSm4SrkPlP3nOmWNLK9vdiNI`,
    },
  });

  const result = await res.json();
  muxUrl.value = extractPlaybackUrl(apiName, result.data);
});
</script>
