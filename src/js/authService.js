/**
 * Authentication and Role Management Service.
 * Supports Admin (Career Services) and Pre-Configured Student accounts.
 */
class AuthService {
  constructor() {
    this.currentUser = this.loadUser();
    this.subscribers = [];
  }

  loadUser() {
    try {
      const saved = localStorage.getItem('iaa_auth_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback to default
    }
    // Default role: Career Services Administrator
    return {
      role: 'admin',
      name: 'Career Services Staff',
      email: 'career_services@ncsu.edu',
      unityID: 'iaa_admin'
    };
  }

  saveUser(user) {
    this.currentUser = user;
    localStorage.setItem('iaa_auth_user', JSON.stringify(user));
    this.notify();
  }

  subscribe(fn) {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== fn);
    };
  }

  notify() {
    this.subscribers.forEach(fn => fn(this.currentUser));
  }

  getUser() {
    return this.currentUser;
  }

  isAdmin() {
    return this.currentUser.role === 'admin';
  }

  isStudent() {
    return this.currentUser.role === 'student';
  }

  loginAsAdmin() {
    this.saveUser({
      role: 'admin',
      name: 'Career Services Staff',
      email: 'career_services@ncsu.edu',
      unityID: 'iaa_admin'
    });
  }

  loginAsStudent(student) {
    this.saveUser({
      role: 'student',
      name: student.name,
      email: student.email,
      unityID: student.unityID,
      avatarUrl: student.avatarUrl
    });
  }
}

export const authService = new AuthService();
