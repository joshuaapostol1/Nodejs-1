<template>
  <div id="app" class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script>
export default {
  name: 'App',
  mounted() {
    document.addEventListener('backbutton', this.handleBackButton, false);
  },
  beforeUnmount() {
    document.removeEventListener('backbutton', this.handleBackButton);
  },
  methods: {
    handleBackButton(e) {
      if (this.$route.path === '/home') {
        e.preventDefault();
        navigator.app?.exitApp();
      } else {
        this.$router.back();
      }
    }
  }
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.app-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #1a1a2e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
