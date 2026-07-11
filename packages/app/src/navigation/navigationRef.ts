import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Lets code outside the navigation tree (startup redirect) navigate imperatively. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
