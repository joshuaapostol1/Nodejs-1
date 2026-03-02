<template>
  <div class="splash-screen">
    <div class="splash-content">
      <div class="logo-container">
        <div class="logo">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="white" stroke-width="3" fill="none"/>
            <path d="M35 50L45 60L65 40" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>ShareBooster</h1>
        <p>Facebook Share Automation</p>
      </div>
      <div class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
</template>

<script>
import { authService } from '../services/auth';

export default {
  name: 'Splash',
  mounted() {
    setTimeout(() => {
      if (authService.isAuthenticated()) {
        this.$router.replace('/home');
      } else {
        this.$router.replace('/login');
      }
    }, 2000);
  }
};
</script>

<style scoped>
.splash-screen {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.splash-content {
  text-align: center;
}

.logo-container {
  animation: fadeInUp 0.8s ease-out;
}

.logo {
  width: 120px;
  height: 120px;
  margin: 0 auto 20px;
  animation: pulse 2s infinite;
}

.logo svg {
  width: 100%;
  height: 100%;
}

h1 {
  color: white;
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 10px 0;
}

p {
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  margin: 0 0 40px 0;
}

.loading-dots {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 40px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
