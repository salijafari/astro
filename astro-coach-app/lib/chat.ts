import { Platform } from "react-native";
import { apiPostJson } from "@/lib/api";
import { getFirebaseAuth, getFirestore } from "@/lib/firebase";

/**
 * Creates a PostgreSQL conversation + Firestore session doc for real-time chat.
 */
export async function createSession(featureKey: string, getToken: () => Promise<string | null>): Promise<string> {
  const { sessionId } = await apiPostJson<{ sessionId: string }>("/api/chat/session", getToken, { featureKey });
  const auth = getFirebaseAuth();
  const uid = "currentUser" in auth && auth.currentUser ? auth.currentUser.uid : null;
  if (!uid) throw new Error("Not signed in");

  if (Platform.OS === "web") {
    const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    const fs = getFirestore() as import("firebase/firestore").Firestore;
    await setDoc(doc(fs, `chats/${uid}/sessions/${sessionId}`), {
      featureKey,
      createdAt: serverTimestamp(),
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firestore = require("@react-native-firebase/firestore").default as typeof import("@react-native-firebase/firestore").default;
    await firestore()
      .collection("chats")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .set({
        featureKey,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  return sessionId;
}

export type ChatMessage = { id: string; role: string; content: string; createdAt?: unknown; status?: string };

/**
 * Writes user message to Firestore, then persists via API for AI processing.
 */
export async function sendMessage(
  sessionId: string,
  content: string,
  getToken: () => Promise<string | null>,
): Promise<void> {
  const auth = getFirebaseAuth();
  const uid = "currentUser" in auth && auth.currentUser ? auth.currentUser.uid : null;
  if (!uid) throw new Error("Not signed in");

  let messageId = `m_${Date.now()}`;
  if (Platform.OS === "web") {
    const { collection, doc, setDoc, serverTimestamp, updateDoc } = await import("firebase/firestore");
    const fs = getFirestore() as import("firebase/firestore").Firestore;
    const col = collection(fs, `chats/${uid}/sessions/${sessionId}/messages`);
    const ref = doc(col);
    messageId = ref.id;
    await setDoc(ref, {
      role: "user",
      content,
      createdAt: serverTimestamp(),
      status: "sending",
    });
    try {
      await apiPostJson("/api/chat/message", getToken, { message: content, conversationId: sessionId });
      await updateDoc(ref, { status: "sent" });
    } catch {
      await updateDoc(ref, { status: "failed" });
      throw new Error("message_failed");
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firestore = require("@react-native-firebase/firestore").default as typeof import("@react-native-firebase/firestore").default;
    const ref = firestore()
      .collection("chats")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .collection("messages")
      .doc();
    messageId = ref.id;
    await ref.set({
      role: "user",
      content,
      createdAt: firestore.FieldValue.serverTimestamp(),
      status: "sending",
    });
    try {
      await apiPostJson("/api/chat/message", getToken, { message: content, conversationId: sessionId });
      await ref.update({ status: "sent" });
    } catch {
      await ref.update({ status: "failed" });
      throw new Error("message_failed");
    }
  }
}

/**
 * Real-time listener for Firestore messages (ordered by createdAt).
 */
export function subscribeToMessages(
  sessionId: string,
  callback: (messages: ChatMessage[]) => void,
): () => void {
  const auth = getFirebaseAuth();
  const uid = "currentUser" in auth && auth.currentUser ? auth.currentUser.uid : null;
  if (!uid) return () => {};

  if (Platform.OS === "web") {
    const { collection, query, orderBy, onSnapshot } = require("firebase/firestore") as typeof import("firebase/firestore");
    const fs = getFirestore() as import("firebase/firestore").Firestore;
    const q = query(collection(fs, `chats/${uid}/sessions/${sessionId}/messages`), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      const rows: ChatMessage[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }));
      callback(rows);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const firestore = require("@react-native-firebase/firestore").default as typeof import("@react-native-firebase/firestore").default;
  const unsub = firestore()
    .collection("chats")
    .doc(uid)
    .collection("sessions")
    .doc(sessionId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .onSnapshot((snap) => {
      const rows: ChatMessage[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }));
      callback(rows);
    });
  return unsub;
}
