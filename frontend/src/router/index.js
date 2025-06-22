import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/player",
    name: "Player",
    component: () => import("@/views/Player.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
