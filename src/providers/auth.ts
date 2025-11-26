import type { AuthProvider } from "@refinedev/core";

export const createAuthProvider = (apiUrl: string): AuthProvider => {
  return {
    login: async () => {
      throw new Error("Not implemented");
    },
    register: async () => {
      throw new Error("Not implemented");
    },
    check: async () => {
      return {
        authenticated: true,
      };
    },
    getPermissions: async () => {
      throw new Error("Not implemented");
    },
    logout: async () => {
      throw new Error("Not implemented");
    },
    onError: async () => {
      throw new Error("Not implemented");
    },
  };
};
