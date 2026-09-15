# apps/mobile — Kaden (Expo)

Runnable-first skelet (Faza 2). Trenutno: renderuje `SessionAnalysis` u chat-like formatu
(offline primer). Backend je live (kaden-7b907); sledeće kačimo Firebase.

## Pokretanje
```bash
cd apps/mobile
npx expo start
```
- **Najlakše:** instaliraj **Expo Go** na iPhone → skeniraj QR iz terminala.
- **Simulator:** pritisni `i` (traži Xcode + iOS simulator).

Vidiš: Kaden header + analiza treninga (osnovni brojevi → zone → ocena → poređenje →
sledeći korak → pitanje) sa verdikt bedžom.

## Stack
- Expo SDK 57, React 19, React Native 0.86, TypeScript. Metro monorepo config (`metro.config.js`).
- Tipovi iz `@kaden/shared-types` (isti ugovori kao backend).

## Sledeći koraci (redom)
1. **Firebase JS SDK** — Google Sign-In (`expo-auth-session`) + Firestore (čita
   `athletes/{uid}/analyses`). Traži registrovan **Web app** u Firebase → config.
2. **Lista analiza** (realtime) → tap → detalj (već imamo `AnalysisView`).
3. **FIT import** — `expo-document-picker` → upload na `sync` (parser ostaje backend).
4. **HealthKit** — `@kingstinct/react-native-healthkit` + **dev build** (ne Expo Go),
   background delivery. Ovde treba Apple Developer (device) ili besplatni Apple ID (7d).
5. **App Check** — migracija na React Native Firebase (native).
