import { createRouter, createWebHistory } from "vue-router";
import PlayerTest from "@/views/PlayerTest.vue"; // 你稍後會建立這個元件

const routes = [
  {
    path: "/player",
    name: "PlayerTest",
    component: PlayerTest,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
