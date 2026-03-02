<template>
  <div class="register-page">
    <div class="register-container">
      <div class="header">
        <button class="back-btn" @click="$router.back()">←</button>
        <h1>Create Account</h1>
        <p>Join ShareBooster today</p>
      </div>

      <form @submit.prevent="handleRegister" class="register-form" v-if="!showOTP">
        <div class="form-group">
          <label>Full Name</label>
          <input v-model="form.fullname" type="text" placeholder="John Doe" required />
        </div>

        <div class="form-group">
          <label>Username</label>
          <input v-model="form.username" type="text" placeholder="johndoe" required />
        </div>

        <div class="form-group">
          <label>Email</label>
          <input v-model="form.email" type="email" placeholder="you@example.com" required />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input v-model="form.password" type="password" placeholder="Min. 6 characters" required />
        </div>

        <div class="form-group">
          <label>Confirm Password</label>
          <input v-model="form.confirmPassword" type="password" placeholder="Re-enter password" required />
        </div>

        <button type="submit" class="btn-primary" :disabled="loading">
          <span v-if="!loading">Create Account</span>
          <span v-else">Registering...</span>
        </button>

        <div v-if="error" class="error-message">{{ error }}</div>
      </form>

      <div v-else class="otp-section">
        <div class="otp-icon">📧</div>
        <h2>Verify Email</h2>
        <p>Enter the 6-digit code sent to {{ form.email }}</p>

        <input
          v-model="otpCode"
          type="text"
          maxlength="6"
          placeholder="000000"
          class="otp-input"
        />

        <button @click="verifyOTP" class="btn-primary" :disabled="loading">
          <span v-if="!loading">Verify</span>
          <span v-else>Verifying...</span>
        </button>

        <button @click="resendOTP" class="btn-text" :disabled="resendLoading">
          {{ resendLoading ? 'Sending...' : 'Resend Code' }}
        </button>

        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { apiService } from '../services/api';
import { authService } from '../services/auth';

export default {
  name: 'Register',
  data() {
    return {
      form: {
        fullname: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
      },
      showOTP: false,
      otpCode: '',
      loading: false,
      resendLoading: false,
      error: ''
    };
  },
  methods: {
    async handleRegister() {
      this.error = '';

      if (this.form.password !== this.form.confirmPassword) {
        this.error = 'Passwords do not match';
        return;
      }

      if (this.form.password.length < 6) {
        this.error = 'Password must be at least 6 characters';
        return;
      }

      this.loading = true;

      try {
        const response = await apiService.register(this.form);

        if (response.data.otpSent) {
          this.showOTP = true;
        }
      } catch (err) {
        this.error = err.response?.data?.error || 'Registration failed';
      } finally {
        this.loading = false;
      }
    },

    async verifyOTP() {
      this.error = '';
      this.loading = true;

      try {
        const response = await apiService.verifyOTP(this.form.email, this.otpCode);

        if (response.data.token) {
          authService.setToken(response.data.token);
          authService.setUser(response.data.user);
          this.$router.replace('/home');
        }
      } catch (err) {
        this.error = err.response?.data?.error || 'Verification failed';
      } finally {
        this.loading = false;
      }
    },

    async resendOTP() {
      this.error = '';
      this.resendLoading = true;

      try {
        await apiService.resendOTP(this.form.email);
        this.error = '';
      } catch (err) {
        this.error = err.response?.data?.error || 'Failed to resend code';
      } finally {
        this.resendLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.register-page {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
  overflow-y: auto;
  padding: 20px;
}

.register-container {
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 24px;
  padding: 40px 30px;
  margin: 20px auto;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  position: relative;
}

.back-btn {
  position: absolute;
  left: 0;
  top: 0;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 5px 10px;
}

h1 {
  color: #1a1a2e;
  font-size: 28px;
  margin: 0 0 10px 0;
}

h2 {
  color: #1a1a2e;
  font-size: 24px;
  margin: 15px 0;
}

p {
  color: #666;
  margin: 0;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  color: #333;
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 14px;
}

input {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  transition: all 0.3s;
  background: #f9f9f9;
}

input:focus {
  outline: none;
  border-color: #7C3AED;
  background: white;
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
  margin-top: 10px;
}

.btn-primary:disabled {
  opacity: 0.6;
}

.btn-text {
  width: 100%;
  padding: 12px;
  background: none;
  border: none;
  color: #7C3AED;
  font-weight: 500;
  cursor: pointer;
  margin-top: 10px;
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

.otp-section {
  text-align: center;
}

.otp-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

.otp-input {
  text-align: center;
  font-size: 24px;
  letter-spacing: 10px;
  font-weight: 600;
  margin: 20px 0;
}
</style>
