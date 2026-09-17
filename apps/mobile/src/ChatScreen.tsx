import { useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet,
} from "react-native";
import { auth } from "./firebase";
import { CHAT_URL } from "./config";

type Msg = { role: "user" | "assistant"; content: string };

const HINT = "Zalepi Garmin podatke treninga + napiši kako se osećaš (san, umor, listovi, plan)…";

export function ChatScreen({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next); setInput(""); setBusy(true); setErr(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? String(res.status)); setBusy(false); return; }
      setMessages([...next, { role: "assistant", content: j.reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) { setErr(String(e?.message ?? e)); }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable onPress={onClose}><Text style={styles.back}>‹ Nazad</Text></Pressable>
        <Text style={styles.title}>Coach</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.scroll}>
        {messages.length === 0 && (
          <Text style={styles.empty}>Pošalji trening i reci kako se osećaš — pričaćemo o njemu.</Text>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === "user" ? styles.user : styles.coach]}>
            <Text style={m.role === "user" ? styles.userText : styles.coachText}>{m.content}</Text>
          </View>
        ))}
        {busy && <ActivityIndicator style={{ marginVertical: 12 }} color="#2563eb" />}
        {err && <Text style={styles.err}>{err}</Text>}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={HINT}
          placeholderTextColor="#94a3b8"
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable onPress={send} disabled={busy || !input.trim()} style={[styles.sendBtn, (busy || !input.trim()) && styles.sendOff]}>
          <Text style={styles.sendText}>▲</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f1f5f9" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#fff" },
  back: { fontSize: 16, color: "#2563eb", fontWeight: "600", width: 60 },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  scroll: { padding: 12, gap: 10 },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
  bubble: { borderRadius: 16, padding: 12, maxWidth: "88%" },
  user: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
  coach: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  userText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  coachText: { color: "#0f172a", fontSize: 15, lineHeight: 22 },
  err: { color: "#dc2626", fontSize: 13, textAlign: "center", marginTop: 8 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10,
    borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#fff" },
  input: { flex: 1, maxHeight: 140, backgroundColor: "#f1f5f9", borderRadius: 18, paddingHorizontal: 14,
    paddingTop: 10, paddingBottom: 10, fontSize: 15, color: "#0f172a" },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  sendOff: { backgroundColor: "#cbd5e1" },
  sendText: { color: "#fff", fontSize: 18, fontWeight: "800" },
});
