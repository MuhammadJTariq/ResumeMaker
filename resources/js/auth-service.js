const crypto = require("crypto");

class AuthService {
  static instance = null;

  constructor() {
    if (AuthService.instance) {
      return AuthService.instance;
    }

    this.sessions = new Map();
    AuthService.instance = this;
  }

  static getInstance() {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }

    return AuthService.instance;
  }

  createSession(user) {
    const token = crypto.randomUUID();
    this.sessions.set(token, {
      token,
      user,
      createdAt: Date.now(),
    });
    return token;
  }

  getSession(token) {
    if (!token) {
      return null;
    }

    return this.sessions.get(token) || null;
  }

  destroySession(token) {
    if (token) {
      this.sessions.delete(token);
    }
  }
}

module.exports = AuthService;
