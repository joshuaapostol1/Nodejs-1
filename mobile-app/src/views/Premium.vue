<template>
  <div class="premium-page">
    <div class="header">
      <button @click="$router.back()" class="back-btn">←</button>
      <h1>Premium Plans</h1>
    </div>

    <div class="benefits-section">
      <h2>Premium Benefits</h2>
      <div class="benefit-item">
        <span class="icon">⚡</span>
        <div>
          <h3>4000 Shares Per Session</h3>
          <p>Free users limited to 500 shares</p>
        </div>
      </div>
      <div class="benefit-item">
        <span class="icon">🚀</span>
        <div>
          <h3>Faster Processing</h3>
          <p>Priority queue for your shares</p>
        </div>
      </div>
      <div class="benefit-item">
        <span class="icon">💾</span>
        <div>
          <h3>Save Cookies</h3>
          <p>Store your Facebook cookies securely</p>
        </div>
      </div>
      <div class="benefit-item">
        <span class="icon">📊</span>
        <div>
          <h3>Advanced Analytics</h3>
          <p>Detailed sharing statistics</p>
        </div>
      </div>
    </div>

    <div class="plans-section">
      <h2>Choose Your Plan</h2>

      <div
        v-for="plan in plans"
        :key="plan.name"
        @click="selectedPlan = plan.name"
        class="plan-card"
        :class="{ selected: selectedPlan === plan.name }"
      >
        <div class="plan-header">
          <h3>{{ plan.name }}</h3>
          <div class="radio" :class="{ checked: selectedPlan === plan.name }"></div>
        </div>
        <p class="plan-description">{{ plan.description }}</p>
        <div class="plan-price">{{ plan.price }}</div>
      </div>
    </div>

    <button @click="requestPremium" class="btn-primary" :disabled="!selectedPlan || loading">
      <span v-if="!loading">Request {{ selectedPlan }}</span>
      <span v-else>Sending Request...</span>
    </button>

    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="success" class="success-message">{{ success }}</div>

    <div class="note-section">
      <p>After requesting, an admin will review and activate your premium plan. You will be notified once approved.</p>
    </div>
  </div>
</template>

<script>
import { apiService } from '../services/api';

export default {
  name: 'Premium',
  data() {
    return {
      selectedPlan: '',
      loading: false,
      error: '',
      success: '',
      plans: [
        {
          name: '1 Week',
          description: 'Perfect for short campaigns',
          price: 'Contact Admin'
        },
        {
          name: '2 Weeks',
          description: 'Extended campaign support',
          price: 'Contact Admin'
        },
        {
          name: '1 Year',
          description: 'Best value for long-term',
          price: 'Contact Admin'
        },
        {
          name: 'Permanent',
          description: 'Lifetime premium access',
          price: 'Contact Admin'
        }
      ]
    };
  },
  methods: {
    async requestPremium() {
      if (!this.selectedPlan) return;

      this.error = '';
      this.success = '';
      this.loading = true;

      try {
        const response = await apiService.requestPremium(this.selectedPlan);
        this.success = response.data.message || 'Premium request submitted successfully! Awaiting admin approval.';
        this.selectedPlan = '';
      } catch (err) {
        this.error = err.response?.data?.error || 'Failed to submit premium request';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.premium-page {
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

h2 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #1a1a2e;
}

.benefits-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}

.benefit-item {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.benefit-item:last-child {
  border-bottom: none;
}

.icon {
  font-size: 32px;
  flex-shrink: 0;
}

h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: #1a1a2e;
}

p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.plans-section {
  margin-bottom: 24px;
}

.plan-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.plan-card.selected {
  border-color: #7C3AED;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(91, 33, 182, 0.05));
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.radio {
  width: 20px;
  height: 20px;
  border: 2px solid #ccc;
  border-radius: 50%;
  position: relative;
}

.radio.checked {
  border-color: #7C3AED;
}

.radio.checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: #7C3AED;
  border-radius: 50%;
}

.plan-description {
  margin-bottom: 12px;
}

.plan-price {
  font-size: 18px;
  font-weight: 700;
  color: #7C3AED;
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
  margin-bottom: 16px;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 12px;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  margin-bottom: 16px;
}

.success-message {
  padding: 12px;
  background: #efe;
  color: #3c3;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  margin-bottom: 16px;
}

.note-section {
  background: #fff9e6;
  border-left: 4px solid #FFD700;
  padding: 16px;
  border-radius: 8px;
}

.note-section p {
  margin: 0;
  font-size: 14px;
  color: #856404;
}
</style>
