const TOKEN_KEY = 'sharebooster_token';
const USER_KEY = 'sharebooster_user';

export const authService = {
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  isPremium() {
    const user = this.getUser();
    if (!user || !user.isPremium) return false;

    if (user.premiumExpiration) {
      const expiryDate = new Date(user.premiumExpiration);
      return expiryDate > new Date();
    }

    return true;
  },

  getPremiumDaysLeft() {
    const user = this.getUser();
    if (!user || !user.isPremium || !user.premiumExpiration) return 0;

    const expiryDate = new Date(user.premiumExpiration);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    return Math.max(0, daysLeft);
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  clearAll() {
    localStorage.clear();
  }
};
