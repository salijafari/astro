import { useOAuth, useSignIn } from "@/lib/auth";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";

WebBrowser.maybeCompleteAuthSession();

/**
 * Temporary sign-in screen retained for future auth provider integration.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onEmailSignIn = useCallback(async () => {
    if (!isLoaded || !signIn) return;
    try {
      const res = await signIn.create({ identifier: email.trim(), password });
      if (res.createdSessionId) {
        await setActive!({ session: res.createdSessionId });
        router.replace("/");
      }
    } catch {
      setError("Could not sign in. Please check your credentials.");
    }
  }, [email, isLoaded, password, router, setActive, signIn]);

  const onGoogle = useCallback(async () => {
    try {
      const redirectUrl = Linking.createURL("/");
      const { createdSessionId, setActive: oauthSetActive } = await startOAuthFlow({ redirectUrl });
      if (createdSessionId) {
        await oauthSetActive!({ session: createdSessionId });
        router.replace("/");
      }
    } catch {
      setError("Google sign-in failed. Configure OAuth provider settings.");
    }
  }, [router, startOAuthFlow]);

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <Text className="text-white text-3xl font-bold mt-10">Welcome back</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#64748b"
        className="mt-8 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-4 text-white"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        className="mt-4 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-4 text-white"
      />
      {error ? <Text className="text-red-400 mt-3">{error}</Text> : null}
      <View className="mt-8 gap-3">
        <Button title="Sign in" onPress={() => void onEmailSignIn()} />
        <Button title="Continue with Google" variant="secondary" onPress={() => void onGoogle()} />
      </View>
    </SafeAreaView>
  );
}
