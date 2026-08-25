import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, loginWithGoogle, logoutUser, testFirestoreConnection } from '../services/firebase';
import type { AppUser, UserRole, RolePermissionConfig } from '../types';
import { ROLE_DEFINITIONS } from '../types';
import { 
  getCurrentAppUser, 
  setCurrentAppUser, 
  getAllAppUsers, 
  saveAppUser, 
  authenticateAppUser, 
  DEFAULT_DEMO_USERS 
} from '../services/db';

interface AuthContextType {
  currentUser: User | null;
  currentAppUser: AppUser | null;
  activeRole: UserRole;
  roleConfig: RolePermissionConfig;
  allUsers: AppUser[];
  isLoading: boolean;
  isCloudConnected: boolean;
  login: () => Promise<User | null>;
  logout: () => Promise<void>;
  loginWithCredentials: (identifier: string, pin: string) => Promise<{ success: boolean; user?: AppUser; error?: string }>;
  loginAsGuest: () => Promise<AppUser>;
  quickSwitchUser: (user: AppUser) => Promise<void>;
  registerAppUser: (userData: Omit<AppUser, 'id' | 'createdAt'>) => Promise<{ success: boolean; user?: AppUser; error?: string }>;
  logoutAppUser: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  hasRole: (allowed: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  currentAppUser: null,
  activeRole: 'AUDITOR',
  roleConfig: ROLE_DEFINITIONS.AUDITOR,
  allUsers: [],
  isLoading: true,
  isCloudConnected: false,
  login: async () => null,
  logout: async () => {},
  loginWithCredentials: async () => ({ success: false }),
  loginAsGuest: async () => DEFAULT_DEMO_USERS[3],
  quickSwitchUser: async () => {},
  registerAppUser: async () => ({ success: false }),
  logoutAppUser: async () => {},
  refreshUsers: async () => {},
  hasRole: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentAppUser, setCurrentAppUserState] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const refreshUsers = useCallback(async () => {
    try {
      const users = await getAllAppUsers();
      setAllUsers(users);
      const current = await getCurrentAppUser();
      if (current) {
        setCurrentAppUserState(current);
      }
    } catch (err) {
      console.warn('Failed to load app users from storage', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Check initial connection
    const checkConnection = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (isMounted) setIsCloudConnected(false);
        return;
      }
      testFirestoreConnection().then(connected => {
        if (isMounted) setIsCloudConnected(connected);
      }).catch(() => {
        if (isMounted) setIsCloudConnected(false);
      });
    };

    checkConnection();

    const handleOnline = () => checkConnection();
    const handleOffline = () => {
      if (isMounted) setIsCloudConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load local app users & RBAC session
    refreshUsers().finally(() => {
      if (isMounted) setIsLoading(false);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isMounted) {
        setCurrentUser(user);
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [refreshUsers]);

  const handleLogin = async () => {
    try {
      const user = await loginWithGoogle();
      return user;
    } catch (err) {
      console.error('Firebase Login failed', err);
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Firebase Logout failed', err);
      throw err;
    }
  };

  // RBAC User Authentication
  const handleLoginWithCredentials = async (identifier: string, pin: string) => {
    try {
      const user = await authenticateAppUser(identifier, pin);
      if (user) {
        setCurrentAppUserState(user);
        await refreshUsers();
        return { success: true, user };
      }
      return { 
        success: false, 
        error: 'الرقم الوظيفي / رقم الهاتف أو رمز PIN غير صحيح' 
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء تسجيل الدخول' };
    }
  };

  const handleLoginAsGuest = async () => {
    const guestUser = allUsers.find(u => u.role === 'GUEST') || DEFAULT_DEMO_USERS[3];
    await setCurrentAppUser(guestUser);
    setCurrentAppUserState(guestUser);
    return guestUser;
  };

  const handleQuickSwitchUser = async (user: AppUser) => {
    await setCurrentAppUser(user);
    setCurrentAppUserState(user);
  };

  const handleRegisterAppUser = async (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    try {
      const existing = allUsers.find(
        u => u.jobId.toLowerCase() === userData.jobId.toLowerCase() ||
        (userData.phone && u.phone && u.phone === userData.phone)
      );
      if (existing) {
        return { success: false, error: 'يوجد مستخدم مسجل مسبقاً بهذا الرقم الوظيفي أو الهاتف' };
      }

      const newUser: AppUser = {
        ...userData,
        id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
      };

      await saveAppUser(newUser);
      await setCurrentAppUser(newUser);
      setCurrentAppUserState(newUser);
      await refreshUsers();
      return { success: true, user: newUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل إنشاء الحساب' };
    }
  };

  const handleLogoutAppUser = async () => {
    const guestUser = allUsers.find(u => u.role === 'GUEST') || DEFAULT_DEMO_USERS[3];
    await setCurrentAppUser(guestUser);
    setCurrentAppUserState(guestUser);
  };

  const activeRole: UserRole = currentAppUser?.role || 'GUEST';
  const roleConfig = ROLE_DEFINITIONS[activeRole] || ROLE_DEFINITIONS.GUEST;

  const hasRole = useCallback((allowed: UserRole | UserRole[]) => {
    if (!currentAppUser) return false;
    const allowedList = Array.isArray(allowed) ? allowed : [allowed];
    return allowedList.includes(currentAppUser.role);
  }, [currentAppUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentAppUser,
        activeRole,
        roleConfig,
        allUsers,
        isLoading,
        isCloudConnected,
        login: handleLogin,
        logout: handleLogout,
        loginWithCredentials: handleLoginWithCredentials,
        loginAsGuest: handleLoginAsGuest,
        quickSwitchUser: handleQuickSwitchUser,
        registerAppUser: handleRegisterAppUser,
        logoutAppUser: handleLogoutAppUser,
        refreshUsers,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

