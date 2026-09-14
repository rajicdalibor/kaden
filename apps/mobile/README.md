# apps/mobile (Faza 2 — još ne kreće)

Expo (React Native) app, **development build** (ne Expo Go — health moduli su native).

## Kad kreće
Tek pošto metrics engine i Sonnet output budu validirani na tvojim podacima (Faza 1).

## Stack (planirano)
- iOS: `@kingstinct/react-native-healthkit` (background delivery se registruje automatski)
- Android: `react-native-health-connect` (v4, Android 14+ za Garmin sync)
- Oba iza jednog `HealthProvider` interfejsa
- `expo-dev-client`, config plugin za HealthKit entitlement + usage descriptions

## Ekrani
1. Home/Sync — dugme + status poslednjeg sync-a
2. Dashboard — metrike + AI plan za sledeću nedelju (ovde dolazi Claude Design)
3. Session detail — pace/HR/zone (opciono)

## Bootstrap (kad budeš spreman)
    npx create-expo-app@latest . --template
    npx expo install expo-dev-client
    # dodaj health biblioteke + config plugin, pa: eas build --profile development
