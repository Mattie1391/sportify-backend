<template>
  <div class="player-wrapper">
    <!-- 給vue一個參考名稱videoRef，如此就可在setup用const videoRef = ref(null)抓到DOM -->
    <!-- controls是播放/暫停/音量、時間軸等控制條 -->
    <video
      ref="videoRef"
      controls
      class="video-player"
      @play="handlePlay"
      @pause="handlePause"
    ></video>

    <!-- 影片中央播放按鈕 -->
    <button v-if="!isPlaying" class="center-play-button" @click="playVideo">▶</button>

    <!-- 條件渲染 : 只有levels陣列有東西(有解析到畫質層級)，才顯示畫質選單。levels則是從hls.levels取得的畫質層級 -->
    <div v-if="levels.length > 0" class="quality-control">
      <!-- v-model="selectedLevel"選單的值會同步到selectedLevel -->
      <!-- @change="changeLevel" : 選擇有變動時，觸發changeLevel()，通知HLS播放器切換畫質 -->
      <select v-model="selectedLevel" @change="changeLevel">
        <!-- 加入HLS.js預設的自動畫質選擇選項 -->
        <option :value="-1">自動</option>
        <!-- 遍歷每個可選畫值等級，:key="index"提高渲染效率 :value="index"會對應hls.leves，這個index被用以切換畫質 -->
        <!-- {{ level.height }}p 就是顯示出的解析度高度，如1080p -->
        <option v-for="(level, index) in levels" :key="index" :value="index">
          {{ level.height }}p
        </option>
      </select>
      <!-- 標示目前播放畫質 -->
      <p class="current-level">目前播放畫質:{{ currentLevelText }}</p>
    </div>
  </div>
</template>

<style scoped>
/* 影片隨容器大小變動 */
.player-wrapper {
  position: relative;
  width: 100%;
  max-width: 720px;
}
/* 影片大小為百分比 */
.video-player {
  width: 100%;
  height: auto;
  display: block;
}
/* 畫質選單，浮動在影片右下角 */
.quality-control {
  position: absolute;
  right: 10px;
  bottom: 45px;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 4px 8px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  z-index: 10;
}
/* 讓select元件在黑底中仍清楚可操作 */
.quality-control select {
  background-color: white;
  color: black;
  margin-right: 8px;
}
/* 顯示播放畫質的字樣 */
.current-level {
  margin: 0;
  margin-top: 4px;
  font-size: 12px;
}
/* 中央播放按鈕 */
.center-play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.8);
  border: none;
  border-radius: 50%;
  width: 64px;
  height: 64px;
  font-size: 32px;
  cursor: pointer;
  z-index: 20;
  transition: background 0.3s;
}
.center-play-button:hover {
  background: rgba(255, 255, 255, 1);
}
</style>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import Hls from "hls.js";
//嵌入mux data模組
import mux from "mux-embed";

//設定接受外部傳入的播放網址
const props = defineProps({
  src: {
    type: String,
    required: true,
  },
});

//ref()建立reactive參考容器{value:null}而非直接宣告變數的方式，使vue能追蹤值的變化，而不是原始物件
//之後只有非ref()變數才會直接操作本體
const videoRef = ref(null);
const hlsInstance = ref(null);

const levels = ref([]);
const selectedLevel = ref(-1); //設定負一代表自動畫質
//用來顯示播放畫質
const currentLevelText = ref("");
const isPlaying = ref(false);

//監控觀看進度相關
//設定檢查間隔
let checkInterval = null;
//設定播放進度要達90%
const WATCH_THRESHOLD = 0.9;
let progressTimer = null;

const setupPlayer = () => {
  if (Hls.isSupported()) {
    hlsInstance.value = new Hls();
    //下載解析.m3u8播放清單，包含解析度層級
    hlsInstance.value.loadSource(props.src);
    hlsInstance.value.attachMedia(videoRef.value);
    //mux監控播放
    mux.monitor(videoRef.value, {
      debug: true,
      Hls,
      data: {
        env_key: import.meta.env.VITE_MUX_ENV_KEY,
        //metadata
        //site metadata
        viewer_user_id: "aapl12345", //mux data可正確取得，可以輸入userId
        //player_metadata
        player_name: "Sportify Plus HLS Player",
        player_init_time: Date.now(),
        video_id: props.videoId, //目前沒有正確取得，但影響不大
        video_title: props.title, //目前沒有正確取得，但影響不大
        // video_series: "", //可選，課程名稱
        video_stream_type: "on-demand",
      },
    });

    hlsInstance.value.on(Hls.Events.ERROR, (event, data) => {
      console.error("HLS 播放錯誤：", data);
      mux.emit("Sportify Plus HLS Player", "error", {
        player_error_code: data.details || "fatal_error",
        player_error_message: data.reason || data.type || "Unkwown fatal eror",
        player_error_context: JSON.stringify(data),
      });
    });
    //解析完成後，觸發此事件，允許你取得可用畫質hls.levels資訊
    hlsInstance.value.on(Hls.Events.MANIFEST_PARSED, () => {
      levels.value = hlsInstance.value.levels;
    });
    //當畫質變動後觸發此事件
    hlsInstance.value.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      const current = hlsInstance.value.levels[data.level];
      currentLevelText.value = `${current.height}`;
    });
  } else if (videoRef.value.canPlayType("application/vnd.apple.mpegurl")) {
    videoRef.value.src = props.src;
  }
};

const changeLevel = () => {
  if (hlsInstance.value) {
    hlsInstance.value.currentLevel = Number(selectedLevel.value);
  }
};

//將中央播放鍵觸發播放化為函式，檢查是否video.Ref準備好，才開始播放(否則點擊有延遲)
const playVideo = () => {
  if (videoRef.value) {
    videoRef.value.play().catch((err) => {
      console.error("播放失敗:", err);
    });
  }
};

function handlePlay() {
  isPlaying.value = true;
}
function handlePause() {
  isPlaying.value = false;
}

onMounted(setupPlayer);

onBeforeUnmount(() => {
  if (hlsInstance.value) {
    hlsInstance.value.destroy();
  }
});

watch(
  () => props.src,
  () => {
    if (hlsInstance.value) {
      hlsInstance.value.destroy();
    }
    setupPlayer();
  }
);
</script>
