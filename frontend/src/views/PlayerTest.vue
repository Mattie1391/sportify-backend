<template>
  <div>
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
  const courseId = "3004be95-89c8-4082-a03e-9f7e8f4b3899";
  const apiName = "userCourseDetails";
  const res = await fetch(`api/v1/users/courses/${courseId}/details`, {
    headers: {
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImE5NDA1ZGNmLTc1OGQtNDFlMi05Y2Y4LTNjODI1ZTM0NGM5YyIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzUwMTAzMzM4LCJleHAiOjE3NTI2OTUzMzh9.yjICg8AC1soawiRm_zoV2rl_hp9mzU6xXURjB9VbO6g`,
    },
  });

  const result = await res.json();
  muxUrl.value = extractPlaybackUrl(apiName, result.data);
});
</script>
