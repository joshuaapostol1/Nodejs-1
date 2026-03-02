<template>
  <div class="share-page">
    <div class="header">
      <button @click="$router.back()" class="back-btn">←</button>
      <h1>Start Sharing</h1>
    </div>

    <div class="share-form">
      <div class="form-group">
        <label>Facebook Post URL</label>
        <input
          v-model="form.url"
          type="text"
          placeholder="https://www.facebook.com/..."
          required
        />
      </div>

      <div class="form-group">
        <label>Number of Shares</label>
        <input
          v-model.number="form.amount"
          type="number"
          :placeholder="`Max: ${maxShares}`"
          :max="maxShares"
          required
        />
        <span class="helper-text">Max: {{ maxShares }} shares per session</span>
      </div>

      <div class="form-group">
        <label>Interval (seconds)</label>
        <input
          v-model.number="form.interval"
          type="number"
          placeholder="10"
          min="5"
          required
        />
        <span class="helper-text">Minimum: 5 seconds between shares</span>
      </div>

      <div class="form-group">
        <label>Facebook Cookie</label>
        <div class="cookie-actions">
          <button @click="loadSavedCookie" class="btn-secondary" :disabled="loading">
            Load Saved Cookie
          </button>
        </div>
        <textarea
          v-model="form.cookie"
          rows="4"
          placeholder="Paste your Facebook cookie or appstate JSON here..."
          required
        ></textarea>
        <button @click="saveCookie" class="btn-text" :disabled="!form.cookie || loading">
          Save Cookie for Later
        </button>
      </div>

      <button @click="startSharing" class="btn-primary" :disabled="loading || !canSubmit">
        <span v-if="!loading">🚀 Start Sharing</span>
        <span v-else>Starting...</span>
      </button>

      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="success" class="success-message">{{ success }}</div>
    </div>
  </div>
</template>

<script>
import { apiService } from '../services/api';
import { authService } from '../services/auth';

export default {
  name: 'Share',
  data() {
    return {
      form: {
        url: '',
        amount: 100,
        interval: 10,
        cookie: ''
      },
      loading: false,
      error: '',
      success: ''
    };
  },
  computed: {
    isPremium() {
      return authService.isPremium();
    },
    maxShares() {
      return this.isPremium ? 4000 : 500;
    },
    canSubmit() {
      return this.form.url && this.form.amount > 0 && this.form.interval >= 5 && this.form.cookie;
    }
  },
  methods: {
    async startSharing() {
      this.error = '';
      this.success = '';

      if (this.form.amount > this.maxShares) {
        this.error = `Maximum ${this.maxShares} shares allowed per session`;
        return;
      }

      if (this.form.interval < 5) {
        this.error = 'Minimum interval is 5 seconds';
        return;
      }

      this.loading = true;

      try {
        const response = await apiService.submitShare(this.form);
        this.success = response.data.message || 'Sharing started successfully!';

        setTimeout(() => {
          this.$router.push('/status');
        }, 1500);
      } catch (err) {
        this.error = err.response?.data?.error || 'Failed to start sharing';
      } finally {
        this.loading = false;
      }
    },

    async loadSavedCookie() {
      this.loading = true;
      try {
        const response = await apiService.getCookie();
        if (response.data.cookieData) {
          this.form.cookie = response.data.cookieData;
          this.success = 'Cookie loaded successfully';
        } else {
          this.error = 'No saved cookie found';
        }
      } catch (err) {
        this.error = 'Failed to load cookie';
      } finally {
        this.loading = false;
      }
    },

    async saveCookie() {
      this.loading = true;
      try {
        await apiService.saveCookie(this.form.cookie);
        this.success = 'Cookie saved for future use';
      } catch (err) {
        this.error = 'Failed to save cookie';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.share-page {
  width: 100%;
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20px;
  overflow-y: auto;
}

.header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 30px;
}

.back-btn {
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

.share-form {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 24px;
}

label {
  display: block;
  color: #333;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 14px;
}

input, textarea {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  transition: all 0.3s;
  background: #f9f9f9;
  font-family: inherit;
}

input:focus, textarea:focus {
  outline: none;
  border-color: #7C3AED;
  background: white;
}

.helper-text {
  display: block;
  font-size: 12px;
  color: #666;
  margin-top: 6px;
}

.cookie-actions {
  margin-bottom: 12px;
}

.btn-primary {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 12px 20px;
  background: #f0f0f0;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-text {
  background: none;
  border: none;
  color: #7C3AED;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 0;
  font-size: 14px;
}

.error-message {
  margin-top: 15px;
  padding: 12px;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
}

.success-message {
  margin-top: 15px;
  padding: 12px;
  background: #efe;
  color: #3c3;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
}
</style>
