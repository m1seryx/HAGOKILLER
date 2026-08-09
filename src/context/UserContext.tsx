import React, { createContext, useContext } from 'react';
import { UserProfile } from '../types';

export interface UserContextValue {
  userName: string;
  userProfile?: UserProfile;
  setUserProfile?: (profile: UserProfile) => void;
}

export const UserContext = createContext<UserContextValue>({ userName: '' });

export const useUser = () => useContext(UserContext);
