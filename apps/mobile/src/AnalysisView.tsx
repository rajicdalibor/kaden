import { View, Text, StyleSheet } from "react-native";

export type Analysis = {
  sessionId?: string;
  date: string;
  classification: string;
  narrative: string;
};

/** Laki markdown: **bold** unutar linija + pasusi. */
function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  return (
    <View style={{ gap: 8 }}>
      {lines.map((line, i) => {
        if (line.trim() === "") return <View key={i} style={{ height: 2 }} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <Text key={i} style={styles.body}>
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**")
                ? <Text key={j} style={styles.bold}>{p.slice(2, -2)}</Text>
                : <Text key={j}>{p}</Text>,
            )}
          </Text>
        );
      })}
    </View>
  );
}

export function AnalysisView({ a }: { a: Analysis }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.date}>{a.date}</Text>
        <Text style={styles.type}>{(a.classification ?? "").toUpperCase()}</Text>
      </View>
      <RichText text={a.narrative ?? ""} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 18, gap: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  header: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingBottom: 10, marginBottom: 2 },
  date: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  type: { fontSize: 22, fontWeight: "800", color: "#0f172a", letterSpacing: 0.5 },
  body: { fontSize: 15.5, lineHeight: 23, color: "#1e293b" },
  bold: { fontWeight: "800", color: "#0f172a" },
});
