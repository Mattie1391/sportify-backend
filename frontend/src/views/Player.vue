<!-- 
 頁面層級，專注於"在這一頁播放什麼影片"
提供context(播放哪個課程、播放者、是否需登入或有token) 
-->
<template>
  <div>
    <h2>播放器名稱</h2>
    <!-- 要代入播放器的資料 -->
    <HlsPlayer
      :apiUrl="apiUrl"
      :apiName="apiName"
      :jwtToken="userToken"
      :subChapterId="subChapterId"
    />
  </div>
</template>

<script setup>
import HlsPlayer from "../components/HlsPlayer.vue";

//測試用假資料---------
const courseId = "3004be95-89c8-4082-a03e-9f7e8f4b3899";
// const userToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImE5NDA1ZGNmLTc1OGQtNDFlMi05Y2Y4LTNjODI1ZTM0NGM5YyIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzUwMTQ2ODMyLCJleHAiOjE3NTI3Mzg4MzJ9.7fAQ2PzH3UuYr8Uf2DziQQjr29vXy0JCROQNq2oiZAc`;
// //存入對應觀看章節、使用者觀看進度用的章節id
// const subChapterId = "708ea385-871c-42b9-aab8-bbf8bbdbfa91";

// -----------------

//播放的api設定
const apiName = "courseTrailer";
const apiUrl = `/api/v1/courses/${courseId}/details`;
// const apiName = "userCourseDetails"; //告訴播放器怎麼解析response
// const apiUrl = `/api/v1/users/courses/${courseId}/details`;
</script>
