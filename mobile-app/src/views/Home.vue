<template>
  <div class="home-page">
    <div class="header">
      <div class="user-info">
        <div class="avatar">{{ userInitials }}</div>
        <div>
          <h2>{{ user?.fullname || 'User' }}</h2>
          <span class="premium-badge" v-if="isPremium">
            ⭐ Premium ({{ daysLeft }} days)
          </span>
          <span class="free-badge" v-else>Free Account</span>
        </div>
      </div>
      <button @click="$router.push('/profile')" class="settings-btn">⚙️</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-value">{{ totalShares }}</div>
        <div class="stat-label">Total Shares</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎯</div>
        <div class="stat-value">{{ activeShares }}</div>
        <div class="stat-label">Active Now</div>
      </div>
    </div>

    <div class="quick-actions">
      <button @click="$router.push('/share')" class="action-btn primary">
        <span class="icon">🚀</span>
        <span>Start Sharing</span>
      </button>
      <button @click="$router.push('/status')" class="action-btn">
        <span class="icon">📈</span>
        <span>View Status</span>
      </button>
      <button @click="$router.push('/premium')" class="action-btn" v-if="!isPremium">
        <span class="icon">⭐</span>
        <span>Go Premium</span>
      </button>
    </div>

    <div class="info-section">
      <h3>Share Limits</h3>
      <div class="limit-info">
        <div class="limit-bar">
          <div class="limit-fill" :style="{ width: limitPercent + '%' }"></div>
        </div>
        <p>{{ shareLimit }} shares per session</p>
      </div>
    </div>
  </div>
</template>

<script>
import { authService } from '../services/auth';
import { apiService } from '../services/api';

export default {
  name: 'Home',
  data() {
    return {
      user: null,
      totalShares: 0,
      activeShares: 0
    };
  },
  computed: {
    isPremium() {
      return authService.isPremium();
    },
    daysLeft() {
      return authService.getPremiumDaysLeft();
    },
    userInitials() {
      const name = this.user?.fullname || 'U';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },
    shareLimit() {
      return this.isPremium ? 4000 : 500;
    },
    limitPercent() {
      return (this.totalShares / this.shareLimit) * 100;
    }
  },
  async mounted() {
    this.user = authService.getUser();
    await this.loadStatus();
  },
  methods: {
    async loadStatus() {
      try {
        const response = await apiService.getShareStatus();
        if (response.data.hasActiveTask) {
          this.activeShares = response.data.count || 0;
        }
      } catch (err) {
        console.error('Failed to load status', err);
      }
    }
  }
};
</script>

<style scoped>
.home-page {
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  overflow-y: auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.user-info {
  display: flex;
  gap: 15px;
  align-items: center;
}

.avatar {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
}

h2 {
  margin: 0;
  font-size: 20px;
  color: #1a1a2e;
}

.premium-badge {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  margin-top: 4px;
}

.free-badge {
  color: #666;
  font-size: 12px;
  display: inline-block;
  margin-top: 4px;
}

.settings-btn {
  background: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #7C3AED;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 30px;
}

.action-btn {
  background: white;
  border: none;
  padding: 18px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.action-btn.primary {
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  color: white;
}

.action-btn:active {
  transform: scale(0.98);
}

.icon {
  font-size: 24px;
}

.info-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

h3 {
  margin: 0 0 15px 0;
  color: #1a1a2e;
}

.limit-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.limit-fill {
  height: 100%;
  background: linear-gradient(90deg, #7C3AED, #5B21B6);
  transition: width 0.3s;
}

.limit-info p {
  margin: 0;
  color: #666;
  font-size: 14px;
}
</style>
