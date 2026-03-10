import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens — auth flow
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';

// Screens — main app
import HomeScreen from '../screens/HomeScreen';
import CreateMatchScreen from '../screens/CreateMatchScreen';
import JoinMatchScreen from '../screens/JoinMatchScreen';
import CameraRoleScreen from '../screens/CameraRoleScreen';
import CameraScreen from '../screens/CameraScreen';
import MatchListScreen from '../screens/MatchListScreen';
import ViewerScreen from '../screens/ViewerScreen';

import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';

// --- Route type maps ---

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  CreateMatch: undefined;
  JoinMatch: undefined;
  CameraRole: { matchTitle: string; matchCode: string; teamA: string; teamB: string };
  Camera: { matchTitle: string; matchCode: string; cameraRole: string; cameraNumber: number };
  MatchList: undefined;
  Viewer: { matchTitle: string; matchCode: string; teamA: string; teamB: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<RootStackParamList>();

const sharedScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '600' as const },
  contentStyle: { backgroundColor: colors.background },
  animation: 'slide_from_right' as const,
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={sharedScreenOptions}>
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ title: 'Create Account' }}
      />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={sharedScreenOptions}>
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="CreateMatch"
        component={CreateMatchScreen}
        options={{ title: 'Create Match' }}
      />
      <MainStack.Screen
        name="JoinMatch"
        component={JoinMatchScreen}
        options={{ title: 'Join as Camera' }}
      />
      <MainStack.Screen
        name="CameraRole"
        component={CameraRoleScreen}
        options={{ title: 'Select Camera Position' }}
      />
      <MainStack.Screen
        name="Camera"
        component={CameraScreen}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="MatchList"
        component={MatchListScreen}
        options={{ title: 'Live Matches' }}
      />
      <MainStack.Screen
        name="Viewer"
        component={ViewerScreen}
        options={{ headerShown: false }}
      />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return user ? <MainNavigator /> : <AuthNavigator />;
}
