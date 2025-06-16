//在這裡依據所有會接收的API播放連結來源，指定url在response內容的位置，以便播放器取得播放連結

export function extractPlaybackUrl(apiName, data) {
  switch (apiName) {
    case "courseTrailer": //api/v1/courses/:courseId/details  非用戶看課程詳細頁面的試看
      return data?.course?.trailer_url ?? "";

    case "userCourseDetails": //api/v1/users/courses/:courseId/details  學員在課程詳細頁面上課
      return data?.course?.video_url ?? "";

    case "HomePageTrailer": //api/v1/courses/get-play-url
      return data?.url ?? "";

    default:
      console.warn(`未知的API名稱: ${apiName}`);
      return "";
  }
}
