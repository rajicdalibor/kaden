# CI/CD — auto-deploy na Firebase (GitHub Actions)

Workflow: `.github/workflows/firebase-deploy.yml` — na `push` u `main` (ili ručno preko
"Run workflow") build-uje, testira i deploy-uje **functions + firestore/storage rules**.

## Jednokratni setup (tvoje akcije)

### 1. Service account za CI
```bash
gcloud config set project kaden-7b907

gcloud iam service-accounts create kaden-ci \
  --display-name="Kaden GitHub CI deploy"

SA="kaden-ci@kaden-7b907.iam.gserviceaccount.com"

# Prava (jednostavna varijanta — Editor pokriva većinu + eksplicitni Firebase/secret/SA-user):
for R in roles/editor roles/firebase.admin roles/iam.serviceAccountUser roles/secretmanager.admin; do
  gcloud projects add-iam-policy-binding kaden-7b907 --member="serviceAccount:$SA" --role="$R"
done

# Ključ (JSON) — sadržaj ide u GitHub secret, fajl posle obriši:
gcloud iam service-accounts keys create kaden-ci-key.json --iam-account="$SA"
```

### 2. GitHub secret
Repo → **Settings → Secrets and variables → Actions → New repository secret**:
- Ime: **`FIREBASE_SERVICE_ACCOUNT`**
- Vrednost: ceo sadržaj `kaden-ci-key.json`

Pa lokalno obriši ključ: `rm kaden-ci-key.json` (nikad u git).

### 3. Anthropic ključ u Secret Manager (ako već nije)
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```
CI ne vidi vrednost ključa — samo ga funkcija veže pri deploy-u; `kaden-ci` SA ima
`secretmanager.admin` pa sme da ga veže.

## Kako radi
- `push` u `main` (izmene u functions/packages/rules) → workflow: `pnpm install` →
  build (shared-types → metrics → **esbuild bundle** functions) → test → auth (SA) →
  `firebase deploy --only functions,firestore,storage`.
- Bundle inline-uje `@kaden/*` (workspace) pa cloud `npm install` ne vidi `workspace:*`.
- Ručno pokretanje: Actions → "Firebase Deploy" → Run workflow.

## Napomena
Prvi deploy 2nd-gen funkcija zna da uključi API-je (Cloud Run, Eventarc, Artifact
Registry, Cloud Build, Pub/Sub) — ako pukne na "API not enabled", pokreni jednom
`firebase deploy` lokalno (interaktivno prihvati enable) ili enable-uj te API-je u konzoli,
pa CI dalje prolazi.
