import { Button } from "@/components/ui/Button";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { getFirebaseAuth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

/**
 * Email/password sign-in via Firebase (Google/Apple use the same Firebase project; wire native OAuth next).
 */
export default function SignInScreen() {
  const router = useRouter();
  const { user, loading } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Safety net: if auth state resolves to a signed-in user while this screen is mounted
  // (restored session, or redirect-based OAuth returning to this URL), navigate to root
  // so index.tsx can route to the correct destination.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading]);

  const runSignIn = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const e = email.trim();
      if (!e || !password) {
        setError("Enter email and password.");
        return;
      }
      if (Platform.OS === "web") {
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        const cred = await signInWithEmailAndPassword(
          getFirebaseAuth() as import("firebase/auth").Auth,
          e,
          password,
        );
        await syncAuthUserToBackend(cred.user);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        const cred = await nativeAuth().signInWithEmailAndPassword(e, password);
        await syncAuthUserToBackend(cred.user);
      }
      router.replace("/");
    } catch {
      setError("Could not sign in. Check your credentials or create an account.");
    } finally {
      setBusy(false);
    }
  }, [email, password, router]);

  const runRegister = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const e = email.trim();
      if (!e || !password || password.length < 6) {
        setError("Use a valid email and password (6+ characters).");
        return;
      }
      if (Platform.OS === "web") {
        const { createUserWithEmailAndPassword } = await import("firebase/auth");
        const cred = await createUserWithEmailAndPassword(
          getFirebaseAuth() as import("firebase/auth").Auth,
          e,
          password,
        );
        await syncAuthUserToBackend(cred.user);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        const cred = await nativeAuth().createUserWithEmailAndPassword(e, password);
        await syncAuthUserToBackend(cred.user);
      }
      router.replace("/");
    } catch {
      setError("Could not create account. Try a different email.");
    } finally {
      setBusy(false);
    }
  }, [email, password, router]);

  const onGoogle = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const user = await signInWithGoogle();
      if (user) {
        // Native: user returned directly. Fire-and-forget backend sync, then navigate.
        syncAuthUserToBackend(user).catch((err) => {
          console.warn("[sign-in] backend sync failed:", err);
        });
        router.replace("/");
      }
      // Web: signInWithRedirect navigates the page away — returns null.
      // Session is resolved on return via getRedirectResult; the safety-net
      // useEffect above will then navigate to "/" once auth state is set.
    } catch (error) {
      console.error("Google sign-in error:", error);
      setError("Could not sign in with Google. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [router]);

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
        <Button title={busy ? "\u2026" : "Sign in"} onPress={() => (busy ? undefined : void runSignIn())} />
        <Button title="Create account" variant="secondary" onPress={() => (busy ? undefined : void runRegister())} />
        <Button title={busy ? "\u2026" : "Continue with Google"} variant="secondary" onPress={() => (busy ? undefined : void onGoogle())} />
      </View>
    </SafeAreaView>
  );
}
