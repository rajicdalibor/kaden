import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, Text, View, StyleSheet } from "react-native";
import { AnalysisView } from "./src/AnalysisView";
import { sampleAnalysis } from "./src/sample";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brand}>
          <Text style={styles.logo}>Kaden</Text>
          <Text style={styles.tagline}>AI trener trčanja</Text>
        </View>
        <AnalysisView a={sampleAnalysis} />
        <Text style={styles.footer}>
          Primer analize (offline). Sledeće: Google prijava → analize iz Firestore-a.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, gap: 16 },
  brand: { paddingVertical: 8, paddingHorizontal: 4 },
  logo: { fontSize: 32, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: "#64748b", marginTop: 2 },
  footer: { fontSize: 12, color: "#94a3b8", textAlign: "center", paddingVertical: 8 },
});
