<template>
  <div class="status-page">
    <div class="header">
      <button @click="$router.back()" class="back-btn">←</button>
      <h1>Share Status</h1>
      <button @click="refresh" class="refresh-btn">🔄</button>
    </div>

    <div v-if="status.hasActiveTask" class="active-session">
      <div class="session-header">
        <span class="pulse-indicator"></span>
        <h2>Active Sharing Session</h2>
      </div>

      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="progress-text">
          {{ status.count }} / {{ status.target }} shares
        </div>
      </div>

      <div class="session-details">
        <div class="detail-item">
          <span class="label">Post URL:</span>
          <span class="value">{{ truncateUrl(status.url) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Runtime:</span>
          <span class="value">{{ formatRuntime(status.runtime) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Status:</span>
          <span class="value">{{ status.taskStatus }}</span>
        </div>
      </div>

      <button @click="stopSharing" class="btn-danger">
        🛑 Stop Sharing
      </button>
    </div>

    <div v-else class="no-session">
      <div class="empty-icon">📊</div>
      <h2>No Active Session</h2>
      <p>Start a new sharing session to see progress here</p>
      <button @click="$router.push('/share')" class="btn-primary">
        Start Sharing
      </button>
    </div>

    <div class="logs-section" v-if="logs.length > 0">
      <div class="logs-header">
        <h3>Recent Logs</h3>
        <button @click="clearLogs" class="btn-text">Clear</button>
      </div>
      <div class="logs-list">
        <div v-for="(log, index) in logs" :key="index" class="log-item">
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { apiService } from '../services/api';

export default {
  name: 'Status',
  data() {
    return {
      status: {
        hasActiveTask: false,
        count: 0,
        target: 0,
        url: '',
        runtime: 0,
        taskStatus: ''
      },
      logs: [],
      refreshInterval: null
    };
  },
  computed: {
    progressPercent() {
      if (!this.status.target) return 0;
      return Math.min(100, (this.status.count / this.status.target) * 100);
    }
  },
  async mounted() {
    await this.refresh();
    this.startAutoRefresh();
  },
  beforeUnmount() {
    this.stopAutoRefresh();
  },
  methods: {
    async refresh() {
      try {
        const [statusRes, logsRes] = await Promise.all([
          apiService.getShareStatus(),
          apiService.getShareLogs()
        ]);

        this.status = statusRes.data;
        this.logs = logsRes.data.logs || [];
      } catch (err) {
        console.error('Failed to refresh status', err);
      }
    },

    startAutoRefresh() {
      this.refreshInterval = setInterval(() => {
        this.refresh();
      }, 3000);
    },

    stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }
    },

    async stopSharing() {
      try {
        await apiService.stopShare();
        await this.refresh();
      } catch (err) {
        console.error('Failed to stop sharing', err);
      }
    },

    async clearLogs() {
      try {
        await apiService.clearShareLogs();
        this.logs = [];
      } catch (err) {
        console.error('Failed to clear logs', err);
      }
    },

    truncateUrl(url) {
      if (!url) return '';
      if (url.length <= 40) return url;
      return url.substring(0, 40) + '...';
    },

    formatRuntime(seconds) {
      if (!seconds) return '0s';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    },

    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    }
  }
};
</script>

<style scoped>
.status-page {
  width: 100%;
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20px;
  overflow-y: auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
}

.back-btn, .refresh-btn {
  background: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

h1 {
  margin: 0;
  font-size: 24px;
  color: #1a1a2e;
}

.active-session {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.session-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.pulse-indicator {
  width: 12px;
  height: 12px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

h2 {
  margin: 0;
  font-size: 20px;
  color: #1a1a2e;
}

.progress-section {
  margin-bottom: 24px;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #7C3AED, #5B21B6);
  transition: width 0.3s;
}

.progress-text {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: #7C3AED;
}

.session-details {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
}

.detail-item:last-child {
  border-bottom: none;
}

.label {
  font-weight: 600;
  color: #666;
  font-size: 14px;
}

.value {
  color: #1a1a2e;
  font-size: 14px;
}

.btn-danger {
  width: 100%;
  padding: 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.no-session {
  background: white;
  border-radius: 16px;
  padding: 60px 24px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.no-session h2 {
  margin-bottom: 10px;
}

.no-session p {
  color: #666;
  margin-bottom: 30px;
}

.btn-primary {
  padding: 16px 32px;
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.logs-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-top: 20px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

h3 {
  margin: 0;
  font-size: 18px;
  color: #1a1a2e;
}

.btn-text {
  background: none;
  border: none;
  color: #7C3AED;
  font-weight: 500;
  cursor: pointer;
  font-size: 14px;
}

.logs-list {
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  gap: 12px;
}

.log-time {
  color: #999;
  font-size: 12px;
  min-width: 80px;
}

.log-message {
  color: #333;
  font-size: 14px;
  flex: 1;
}
</style>
