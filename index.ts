import { enableScreens } from 'react-native-screens';

// Disable native screen optimization to prevent ViewGroup concurrency collisions in Android builds
enableScreens(false);

import 'expo-router/entry';
