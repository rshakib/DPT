# DPT — Offline-First Hybrid Transaction Envelope (HTE) Payment App

DPT is a mobile payment app that implements the **Hybrid Transaction Envelope (HTE)**
protocol — an offline-first e-payment design built on:

- **P-256 ECDH** — ephemeral sender key + long-term receiver key (key establishment)
- **HKDF-SHA256** — transaction-specific key derivation
- **AES-256-GCM** — authenticated payload encryption
- **ECDSA P-256** — device-bound, biometric-authorized transaction signing
- **Duress authorization** — a second, policy-restricted signing key with a reduced spending limit

Offline payments are **created and queued** offline (encrypted local queue) and **settled by the
receiver** once connectivity returns. Settlement is always receiver-authoritative.

- Client (this repo): Expo / React Native + TypeScript
- Server: Flask + PostgreSQL — **[E_PAY-FYDP](https://github.com/rshakib/E_PAY-FYDP)**

---

## 1. Quick start (app)

### Prerequisites

| Tool | Version used |
| --- | --- |
| Node.js | 22.x |
| npm | 10.x |
| Java (JDK) | 17 |
| Android SDK | platform-tools + build-tools (only needed for a native build) |

```bash
git clone https://github.com/rshakib/DPT.git
cd DPT
npm install
```

### Run in development

```bash
npx expo start
```

Then either:
- scan the QR with **Expo Go** (fastest, no native build), or
- press `a` to run on a connected Android device/emulator, or
- `npm run android` (uses `expo run:android`, builds the native project).

> The native Android Keystore module (`DptKeystoreModule`) is only active in a **native build**
> (APK / `expo run:android`). In Expo Go the app falls back to a software device key — fine for
> trying it out, but hardware-key enrollment needs the APK.

### Build a release APK (no EAS account needed)

```bash
cd android
export ANDROID_HOME=$HOME/Android/sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64     # adjust to your JDK 17 path
./gradlew :app:assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

Install on a connected device:

```bash
export PATH=$PATH:$ANDROID_HOME/platform-tools
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## 2. Point the app at a backend

The backend base URL lives in [`src/services/api.ts`](src/services/api.ts):

```ts
const USE_LOCAL = false;

const BASE_URL = USE_LOCAL
  ? 'http://192.168.0.212:5001'          // your machine's LAN IP for a physical device
  : 'https://e-pay-fydp.onrender.com';   // deployed backend
```

- **Android emulator + local backend:** `http://10.0.2.2:5001`
- **Physical phone + local backend:** `http://<your-computer-LAN-IP>:5001` (same Wi-Fi)
- **Deployed:** the Render URL

Change `USE_LOCAL` and the URL, then restart Expo.

---

## 3. Run the backend locally

```bash
git clone https://github.com/rshakib/E_PAY-FYDP.git
cd "E_PAY-FYDP/e_banking/backend"

python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env.backend     # then edit it
python app.py                    # serves on http://0.0.0.0:5001
```

Required environment variables in `.env.backend` (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | business/transaction database |
| `SUPABASE_DB_PASSWORD` | direct Postgres connection (enables the atomic settlement path) |
| `IDENTITY_SUPABASE_URL`, `IDENTITY_SUPABASE_SERVICE_ROLE_KEY` | identity/profile database (may equal the above) |
| `PII_ENCRYPTION_KEY`, `PII_HMAC_PEPPER` | 64-char hex keys for PII at rest |
| `SESSION_SECRET` | signs session tokens (falls back to `PII_HMAC_PEPPER`) |
| `SANDBOX_FAKE_DB` | set to `1` to run with an in-memory fake database (no Supabase needed) |

Database tables are created automatically on startup (`auto_create_tables()`), so a fresh
Supabase project works with just the env vars filled in.

**Optional — HSM-backed receiver key (AWS KMS):** set `AWS_KMS_ECDH_KEY_ID` (+ AWS credentials)
and the receiver's ECDH key is held in KMS (`kms:DeriveSharedSecret`). Leave it empty to use the
software key path. See the backend repo for details.

### Smoke test the backend

```bash
curl http://localhost:5001/health
curl http://localhost:5001/server-public-key     # returns the receiver ECDH public key + KeyID
```

---

## 4. Try the app (end-to-end)

1. Start the backend (or use the deployed URL).
2. Launch the app, open **Register** and create an account (device signing keys are enrolled here).
3. Log in with your PIN.
4. **Receive:** *My QR* — a dynamic, single-use QR that refreshes every 60 s (or a permanent QR).
5. **Send:** *Send Money* / *QR Pay* / *NFC Transfer*.
6. Go offline (airplane mode) and send — the payment is **queued** locally and settles when you
   come back online.
7. **Duress:** set a duress PIN in *Security*; unlocking with it shows a decoy balance and caps
   spending at L_D = 250.

---

## 5. What is in this repo

```
src/
  app/                      screens (expo-router)
    my-qr.tsx               dynamic + permanent receive QR
    qr-pay.tsx              scan → verify → pay / claim
    send-money.tsx          transfer entry
    nfc-transfer.tsx        NFC handover
    transaction-processing  online + offline settlement UI
    security.tsx            security score, duress PIN
  services/
    crypto.ts               HTE envelope build + device keys (ECDSA)
    api.ts                  backend client, server-key cache (τ_cache), claim
    db.ts                   SQLite cache + offline queue metadata
    sync.ts                 deferred submission, backoff, reconciliation
  utils/security.ts         duress PIN + local L_D counter
android/app/src/main/java/.../DptKeystoreModule.kt   Keystore/StrongBox signing key
```

---

## 6. Protocol notes implemented here

- **Envelope** `P = {v, KeyID, AAD, ePK, IV, C, Tag, Sig}`; signature covers
  `v ‖ KeyID ‖ ePK ‖ IV ‖ C ‖ Tag ‖ AAD`.
- **Encodings:** ePK compressed (33 B), IV 96-bit, GCM tag 16 B, ECDSA signature raw `r‖s` (64 B)
  → ≈125 B fixed cryptographic overhead.
- **Offline queue:** the signed envelope is stored in platform secure storage; the SQLite row
  keeps only routing/retry metadata (no plaintext receiver/amount).
- **τ_cache** (offline key cache) = `min(T_end − T_start, 24 h)`; envelope creation is blocked
  once it expires until the key is refreshed online.
- **Retry:** exponential backoff `min(2^n × 1 s, 300 s)`; the same `TxID` is resubmitted.
- **Duress:** separate Keystore alias + in-app duress PIN; envelope format is unchanged — only
  the signing key differs. Spending is capped at `L_D` and a silent risk event is recorded.

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `crypto.getRandomValues must be defined` | Polyfilled in `src/services/crypto.ts`; make sure you are on the current `master`. |
| Transfer fails only in the APK (works in Expo Go) | The APK uses the hardware Keystore key while Expo Go enrolled a software key — clear app data and re-register with the APK. |
| `Unauthorized` / spinning sync | Backend session/token issue — check the backend URL and login again. |
| Build fails: `SDK location not found` | Set `ANDROID_HOME` (and `local.properties` with `sdk.dir=`). |
| Build fails: `JAVA_COMPILER` / java version | Use **JDK 17** (`JAVA_HOME`). |

---

## 8. License

See [LICENSE](LICENSE).
