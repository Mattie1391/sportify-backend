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
// const skill = "瑜珈";
const courseId = "3004be95-89c8-4082-a03e-9f7e8f4b3899";
const userToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImE5NDA1ZGNmLTc1OGQtNDFlMi05Y2Y4LTNjODI1ZTM0NGM5YyIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzUwMTQ2ODMyLCJleHAiOjE3NTI3Mzg4MzJ9.7fAQ2PzH3UuYr8Uf2DziQQjr29vXy0JCROQNq2oiZAc`;
const subChapterId = "708ea385-871c-42b9-aab8-bbf8bbdbfa91";

// -----------------

//播放的api設定

//取得首頁試看 測試
// const query = new URLSearchParams({ skill }).toString();
// const apiName = "HomePageTrailer";
// const apiUrl = `/api/v1/courses/get-play-url?${query}`;

//非學員在課程詳細頁面的試看 測試
// const apiName = "courseTrailer";
// const apiUrl = `/api/v1/courses/${courseId}/details`;

//學員上課頁面的觀看影片 測試
const apiName = "userCourseDetails";
const apiUrl = `/api/v1/users/courses/${courseId}/details`;
</script>
