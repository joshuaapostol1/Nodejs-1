<template>
  <div class="login-page">
    <div class="login-container">
      <div class="header">
        <div class="logo">SB</div>
        <h1>Welcome Back</h1>
        <p>Login to continue sharing</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>Username or Email</label>
          <input
            v-model="username"
            type="text"
            placeholder="Enter username or email"
            required
          />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Enter password"
            required
          />
        </div>

        <button type="submit" class="btn-primary" :disabled="loading">
          <span v-if="!loading">Login</span>
          <span v-else>Logging in...</span>
        </button>

        <div v-if="error" class="error-message">{{ error }}</div>
      </form>

      <div class="footer-links">
        <router-link to="/register">Create Account</router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { apiService } from '../services/api';
import { authService } from '../services/auth';

export default {
  name: 'Login',
  data() {
    return {
      username: '',
      password: '',
      loading: false,
      error: ''
    };
  },
  methods: {
    async handleLogin() {
      this.error = '';
      this.loading = true;

      try {
        const response = await apiService.login(this.username, this.password);

        if (response.data.token) {
          authService.setToken(response.data.token);
          authService.setUser(response.data.user);
          this.$router.replace('/home');
        }
      } catch (err) {
        this.error = err.response?.data?.error || 'Login failed. Please try again.';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.login-page {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-container {
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 24px;
  padding: 40px 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  margin: 0 auto 20px;
}

h1 {
  color: #1a1a2e;
  font-size: 28px;
  margin: 0 0 10px 0;
}

p {
  color: #666;
  margin: 0;
}

.login-form {
  margin-bottom: 30px;
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
  transition: transform 0.2s;
  margin-top: 10px;
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.footer-links {
  text-align: center;
}

.footer-links a {
  color: #7C3AED;
  text-decoration: none;
  font-weight: 500;
}
</style>
