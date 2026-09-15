import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { SessionAnalysis } from "@kaden/shared-types";

const VERDICT: Record<SessionAnalysis["verdict"], { label: string; color: string }> = {
  excellent: { label: "ODLIČNO", color: "#16a34a" },
  on_track: { label: "NA PUTU", color: "#2563eb" },
  watch: { label: "OPREZ", color: "#d97706" },
  back_off: { label: "USPORI", color: "#dc2626" },
};

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{icon}  {title}</Text>
      {children}
    </View>
  );
}

export function AnalysisView({ a }: { a: SessionAnalysis }) {
  const v = VERDICT[a.verdict];
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{a.date}</Text>
          <Text style={styles.type}>{a.classification.toUpperCase()}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: v.color }]}>
          <Text style={styles.badgeText}>{v.label}</Text>
        </View>
      </View>

      <Section icon="📊" title="Osnovni brojevi">
        <Text style={styles.body}>{a.basics}</Text>
      </Section>
      <Section icon="🎯" title="Zone">
        <Text style={styles.body}>{a.zones}</Text>
      </Section>
      <Section icon="💬" title="Iskrena ocena">
        <Text style={styles.body}>{a.assessment}</Text>
      </Section>
      <Section icon="📈" title="Poređenje sa prethodnim">
        {a.comparisons.map((c, i) => (
          <Text key={i} style={styles.bullet}>•  {c}</Text>
        ))}
      </Section>
      <Section icon="➡️" title="Sledeći korak">
        <Text style={styles.body}>{a.nextStep}</Text>
      </Section>
      <Section icon="❓" title="Pitanje">
        <Text style={[styles.body, styles.question]}>{a.question}</Text>
      </Section>

      <Text style={styles.note}>{a.coachingNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 18, gap: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 15, color: "#64748b", fontWeight: "600" },
  type: { fontSize: 22, fontWeight: "800", color: "#0f172a", letterSpacing: 0.5 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a", textTransform: "uppercase", letterSpacing: 0.3 },
  body: { fontSize: 15, lineHeight: 22, color: "#334155" },
  bullet: { fontSize: 15, lineHeight: 22, color: "#334155" },
  question: { fontStyle: "italic", color: "#0f172a" },
  note: { fontSize: 12, lineHeight: 17, color: "#94a3b8", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12 },
});
