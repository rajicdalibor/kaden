import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View, Pressable, TextInput, Alert, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import type { SessionAnalysis } from "@kaden/shared-types";
import { auth, db } from "./src/firebase";
import { SYNC_FIT_URL, SYNC_URL } from "./src/config";
import { ensureHealthPermission, allRunsAsRawSessions, healthDiagnostics } from "./src/health";
import { AnalysisView } from "./src/AnalysisView";
import { sampleAnalysis } from "./src/sample";

const VERDICT_COLOR: Record<string, string> = {
  excellent: "#16a34a", on_track: "#2563eb", watch: "#d97706", back_off: "#dc2626",
};

export default function App() {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [analyses, setAnalyses] = useState<SessionAnalysis[]>([]);
  const [selected, setSelected] = useState<SessionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  // auth form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUid(u?.uid ?? null); setReady(true); }), []);

  useEffect(() => {
    if (!uid) { setAnalyses([]); return; }
    const q = query(collection(db, `athletes/${uid}/analyses`), orderBy("date", "desc"));
    return onSnapshot(
      q,
      (snap) => { setAnalyses(snap.docs.map((d) => d.data() as SessionAnalysis)); setError(null); },
      (e) => setError(e.message.includes("permission") ? "uid nije u allowlist-u (seed potreban)" : e.message),
    );
  }, [uid]);

  async function signIn() {
    setAuthErr(null); setAuthBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      if (["auth/user-not-found", "auth/invalid-credential"].includes(e.code)) {
        try { await createUserWithEmailAndPassword(auth, email.trim(), password); }
        catch (e2: any) { setAuthErr(e2.message); }
      } else setAuthErr(e.message);
    } finally { setAuthBusy(false); }
  }

  async function importFit() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      setImporting("Učitavam FIT…");
      const b64 = await FileSystem.readAsStringAsync(picked.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      setImporting("Šaljem na backend…");
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(SYNC_FIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fitBase64: b64 }),
      });
      const j = await res.json();
      if (!res.ok) { setImporting(null); setError(`Import: ${j.error ?? res.status}`); return; }
      setImporting("Analiza se generiše…");
      setTimeout(() => setImporting(null), 8000);
    } catch (e: any) { setImporting(null); setError(`Import: ${e.message ?? e}`); }
  }

  async function syncHealth() {
    try {
      setImporting("Health dozvola…");
      if (!(await ensureHealthPermission())) {
        setImporting(null); Alert.alert("HealthKit", "Nedostupan na ovom uređaju."); return;
      }
      setImporting("Čitam Health…");
      const runs = await allRunsAsRawSessions();
      if (runs.length === 0) {
        const d = await healthDiagnostics();
        setImporting(null);
        Alert.alert(
          "Nema trčanja",
          `Health vidi: ${d.total} workouts, ${d.running} trčanja.\n\n` +
          (d.total === 0
            ? "Ili nije data dozvola (Settings → Privacy → Health → Kaden), ili Garmin ne upisuje u Apple Health."
            : "Ima workouts ali nijedno nije prepoznato kao trčanje."),
        );
        return;
      }
      const token = await auth.currentUser?.getIdToken();
      let ok = 0;
      for (let i = 0; i < runs.length; i++) {
        setImporting(`Šaljem ${i + 1}/${runs.length}…`);
        try {
          const res = await fetch(SYNC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(runs[i]),
          });
          if (res.ok) ok++;
        } catch { /* preskoči neuspeli */ }
      }
      setImporting(null);
      Alert.alert("✓ Sync gotov", `${ok}/${runs.length} trčanja poslato.\nAnalize za skorašnja stižu; starija ulaze u istoriju.`);
    } catch (e: any) { setImporting(null); Alert.alert("Health greška", String(e?.message ?? e)); }
  }

  // --- Sign-in screen ---
  if (ready && !uid) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.authWrap}>
          <Text style={styles.logo}>Kaden</Text>
          <Text style={styles.tagline}>Prijava</Text>
          <TextInput style={styles.input} placeholder="email" autoCapitalize="none"
            keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="lozinka" secureTextEntry
            value={password} onChangeText={setPassword} />
          {authErr && <Text style={styles.authErr}>{authErr}</Text>}
          <Pressable onPress={signIn} disabled={authBusy} style={styles.importBtn}>
            <Text style={styles.importText}>{authBusy ? "…" : "Prijava / Registracija"}</Text>
          </Pressable>
          <Text style={styles.hint}>Novi email → automatski se pravi nalog.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Analysis detail ---
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

        <Pressable onPress={syncHealth} disabled={!!importing} style={styles.importBtn}>
          <Text style={styles.importText}>{importing ?? "⌚  Sync iz Apple Health"}</Text>
        </Pressable>
        <Pressable onPress={importFit} disabled={!!importing} style={styles.importBtnAlt}>
          <Text style={styles.importTextAlt}>＋  Uvezi FIT (pun detalj)</Text>
        </Pressable>

        {isDemo && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{error ?? "Još nema analiza — prikazan je primer."}</Text>
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
  authWrap: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  input: { backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  authErr: { color: "#dc2626", fontSize: 13 },
  hint: { fontSize: 12, color: "#94a3b8", textAlign: "center" },
  importBtn: { backgroundColor: "#2563eb", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  importText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  importBtnAlt: { backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#cbd5e1" },
  importTextAlt: { color: "#475569", fontWeight: "600", fontSize: 14 },
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
