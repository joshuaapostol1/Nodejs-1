<template>
  <div class="profile-page">
    <div class="header">
      <button @click="$router.back()" class="back-btn">←</button>
      <h1>Profile</h1>
    </div>

    <div class="profile-card">
      <div class="avatar-large">{{ userInitials }}</div>
      <h2>{{ user?.fullname }}</h2>
      <p class="username">@{{ user?.username }}</p>
      <p class="email">{{ user?.email }}</p>

      <div v-if="isPremium" class="premium-status">
        <span class="premium-badge">⭐ Premium Account</span>
        <p class="expiry">{{ daysLeft }} days remaining</p>
      </div>
      <div v-else class="free-status">
        <span class="free-badge">Free Account</span>
      </div>
    </div>

    <div class="menu-section">
      <button @click="showPasswordModal = true" class="menu-item">
        <span>🔒 Change Password</span>
        <span class="arrow">›</span>
      </button>

      <button @click="$router.push('/premium')" class="menu-item" v-if="!isPremium">
        <span>⭐ Upgrade to Premium</span>
        <span class="arrow">›</span>
      </button>

      <button @click="handleLogout" class="menu-item danger">
        <span>🚪 Logout</span>
        <span class="arrow">›</span>
      </button>
    </div>

    <div v-if="showPasswordModal" class="modal">
      <div class="modal-content">
        <h3>Change Password</h3>

        <div class="form-group">
          <input
            v-model="passwordForm.currentPassword"
            type="password"
            placeholder="Current Password"
          />
        </div>

        <div class="form-group">
          <input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="New Password"
          />
        </div>

        <div class="form-group">
          <input
            v-model="passwordForm.confirmNewPassword"
            type="password"
            placeholder="Confirm New Password"
          />
        </div>

        <div class="modal-actions">
          <button @click="showPasswordModal = false" class="btn-secondary">Cancel</button>
          <button @click="changePassword" class="btn-primary">Change</button>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>
        <div v-if="success" class="success-message">{{ success }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { authService } from '../services/auth';
import { apiService } from '../services/api';

export default {
  name: 'Profile',
  data() {
    return {
      user: null,
      showPasswordModal: false,
      passwordForm: {
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      },
      error: '',
      success: ''
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
    }
  },
  mounted() {
    this.user = authService.getUser();
  },
  methods: {
    async changePassword() {
      this.error = '';
      this.success = '';

      if (this.passwordForm.newPassword !== this.passwordForm.confirmNewPassword) {
        this.error = 'Passwords do not match';
        return;
      }

      if (this.passwordForm.newPassword.length < 6) {
        this.error = 'Password must be at least 6 characters';
        return;
      }

      try {
        await apiService.changePassword(this.passwordForm);
        this.success = 'Password changed successfully';

        setTimeout(() => {
          this.showPasswordModal = false;
          this.passwordForm = { currentPassword: '', newPassword: '', confirmNewPassword: '' };
        }, 1500);
      } catch (err) {
        this.error = err.response?.data?.error || 'Failed to change password';
      }
    },

    handleLogout() {
      if (confirm('Are you sure you want to logout?')) {
        authService.logout();
        this.$router.replace('/login');
      }
    }
  }
};
</script>

<style scoped>
.profile-page {
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

.profile-card {
  background: white;
  border-radius: 16px;
  padding: 40px 24px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.avatar-large {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 32px;
  margin: 0 auto 20px;
}

h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #1a1a2e;
}

.username {
  color: #666;
  margin: 0 0 4px 0;
  font-size: 16px;
}

.email {
  color: #999;
  margin: 0 0 20px 0;
  font-size: 14px;
}

.premium-status, .free-status {
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.premium-badge {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: white;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  display: inline-block;
}

.free-badge {
  color: #666;
  font-size: 14px;
}

.expiry {
  margin-top: 10px;
  color: #666;
  font-size: 14px;
}

.menu-section {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.menu-item {
  width: 100%;
  padding: 18px 20px;
  background: white;
  border: none;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  cursor: pointer;
  text-align: left;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item.danger {
  color: #ef4444;
}

.arrow {
  font-size: 20px;
  color: #ccc;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 30px;
  width: 100%;
  max-width: 400px;
}

h3 {
  margin: 0 0 24px 0;
  font-size: 20px;
  color: #1a1a2e;
}

.form-group {
  margin-bottom: 16px;
}

input {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
}

input:focus {
  outline: none;
  border-color: #7C3AED;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-primary, .btn-secondary {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  color: white;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
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
