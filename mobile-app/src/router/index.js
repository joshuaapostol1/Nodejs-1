import { createRouter, createWebHistory } from 'vue-router';
import { authService } from '../services/auth';

const routes = [
  {
    path: '/',
    redirect: '/splash'
  },
  {
    path: '/splash',
    name: 'Splash',
    component: () => import('../views/Splash.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue')
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/share',
    name: 'Share',
    component: () => import('../views/Share.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/status',
    name: 'Status',
    component: () => import('../views/Status.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/premium',
    name: 'Premium',
    component: () => import('../views/Premium.vue'),
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isAuthenticated = authService.isAuthenticated();

  if (requiresAuth && !isAuthenticated) {
    next('/login');
  } else if ((to.path === '/login' || to.path === '/register') && isAuthenticated) {
    next('/home');
  } else {
    next();
  }
});

export default router;
