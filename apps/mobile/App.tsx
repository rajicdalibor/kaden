import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import type { SessionAnalysis } from "@kaden/shared-types";
import { auth, db } from "./src/firebase";
import { AnalysisView } from "./src/AnalysisView";
import { sampleAnalysis } from "./src/sample";

const VERDICT_COLOR: Record<string, string> = {
  excellent: "#16a34a", on_track: "#2563eb", watch: "#d97706", back_off: "#dc2626",
};

export default function App() {
  const [uid, setUid] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<SessionAnalysis[]>([]);
  const [selected, setSelected] = useState<SessionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
      else signInAnonymously(auth).catch((e) => setError(`Prijava: ${e.message}`));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, `athletes/${uid}/analyses`), orderBy("date", "desc"));
    return onSnapshot(
      q,
      (snap) => { setAnalyses(snap.docs.map((d) => d.data() as SessionAnalysis)); setError(null); },
      (e) => setError(e.message.includes("permission") ? "uid nije u allowlist-u (seed potreban)" : e.message),
    );
  }, [uid]);

  if (selected) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => setSelected(null)} style={styles.back}>
            <Text style={styles.backText}>‹ Nazad</Text>
          </Pressable>
          <AnalysisView a={selected} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const list = analyses.length > 0 ? analyses : [sampleAnalysis];
  const isDemo = analyses.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brand}>
          <Text style={styles.logo}>Kaden</Text>
          <Text style={styles.tagline}>AI trener trčanja</Text>
        </View>

        {isDemo && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>
              {error ?? "Još nema analiza — prikazan je primer."}
            </Text>
            <Text style={styles.noticeUid}>uid: {uid ?? "…"}</Text>
          </View>
        )}

        {list.map((a) => (
          <Pressable key={a.sessionId} onPress={() => setSelected(a)} style={styles.item}>
            <View>
              <Text style={styles.itemDate}>{a.date}</Text>
              <Text style={styles.itemType}>{a.classification}</Text>
            </View>
            <View style={[styles.dot, { backgroundColor: VERDICT_COLOR[a.verdict] ?? "#64748b" }]} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, gap: 12 },
  brand: { paddingVertical: 8, paddingHorizontal: 4 },
  logo: { fontSize: 32, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: "#64748b", marginTop: 2 },
  notice: { backgroundColor: "#fef9c3", borderRadius: 12, padding: 12, gap: 4 },
  noticeTitle: { fontSize: 13, color: "#854d0e", fontWeight: "600" },
  noticeUid: { fontSize: 12, color: "#a16207", fontFamily: "Courier" },
  item: { backgroundColor: "#fff", borderRadius: 14, padding: 16, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  itemDate: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  itemType: { fontSize: 13, color: "#64748b", marginTop: 2 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  back: { paddingVertical: 4 },
  backText: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
});
