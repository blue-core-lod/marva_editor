import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import Edit from "../views/Edit.vue";
import Load from "../views/Load.vue";
import EditMulti from "../views/EditMulti.vue";
import Login from "../views/LoginView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "Login",
      component: Login,
    },
    {
      path: "/",
      name: "home",
      component: Load,
    },
    {
      path: "/edit/:recordId",
      name: "Edit",
      component: Edit,
      props: true

    },
    {
      path: "/multiedit/:recordId",
      name: "MultiEdit",
      component: EditMulti,
      props: true

    },
    {
      path: "/load/",
      name: "Load",
      component: Load

    },
  ],
});

export default router;
