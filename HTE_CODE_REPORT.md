# HTE_CODE_REPORT.md

Read-only analysis of the "HTE" (Hybrid Transaction Envelope) implementation.
Two codebases are covered:

- **Client (mobile):** `/run/media/shaki/2472D89F72D87750/Main DPT/DPT` (Expo / React Native, TypeScript, Android Kotlin)
- **Server:** `/run/media/shaki/2472D89F72D87750/Main DPT/Web DPT + MainBackend is here/e_banking` (Flask / Python)

Convention: every claim is cited `file:line`. Missing items are marked **NOT FOUND**. Items that differ from the paper are marked **DEVIATION**.

---

## 1. PROJECT OVERVIEW

### 1.1 Repo structure (2–3 levels)

**Client — `Main DPT/DPT/`**
```
DPT/
├── index.ts                       # entry: enableScreens(false) + expo-router/entry
├── app.json                       # Expo config
├── package.json                   # deps
├── android/app/src/main/java/com/riajulshakib/dptapp/
│   ├── MainApplication.kt          # registers DptHcePackage() + DptKeystorePackage()
│   ├── DptHceModule.kt / DptHceService.kt / DptHcePackage.kt
│   └── DptKeystoreModule.kt / DptKeystorePackage.kt   # non-exportable device key
├── ios/                           # generated native ios (out of HTE scope)
├── assets/
└── src/
    ├── app/            # 33 expo-router screens (dashboard, send-money*, qr-*, nfc-transfer, ...)
    ├── components/     # TransactionAuthScreen.tsx, TransactionProcessingView.tsx, ...
    ├── context/        # AuthContext, ThemeContext, LanguageContext, AppLockContext
    ├── services/       # api.ts, crypto.ts, db.ts, sync.ts, nfc.ts
    ├── utils/          # security.ts (PIN hash/lockout/UUID), transactionMapper.ts
    └── constants/      # theme.ts, translations.ts
```

**Server — `Main DPT/Web DPT + MainBackend is here/`**
```
├── docker-compose.yml             # app + nginx + optional zap
├── nginx/nginx.conf, nginx/ssl/
├── Testing/                       # pytest + requests (legacy protocol)
└── e_banking/
    ├── app.py                     # launcher (TLS/port) -> imports backend/app.py
    ├── Dockerfile                 # node build frontend ; python:3.11-slim runtime ; gunicorn 2 workers
    ├── render.txt                 # python-3.11.9
    ├── backend/
    │   ├── app.py                 # Flask API (all endpoints + HTE pipeline) — 2275 lines
    │   ├── crypto.py              # legacy AES-CBC / HMAC / PBKDF2 engine
    │   ├── crypto_v2.py           # HTE crypto (P-256 ECDH/HKDF/AES-GCM/ECDSA) + RSA legacy + PII
    │   ├── supabase_config.py     # dual DB config
    │   └── fake_supabase.py       # in-memory sandbox client
    ├── frontend/                  # Vite React web app (no HTE; uses backend REST only)
    └── database/SUPABASE_NEW_DATABASE_SETUP.sql
```

Out-of-scope siblings present but ignored: `DPT_admin/`, `DPT_v1_backup/`, `DPT_v2_backup_nfc/`, `e_banking/backend_v1_backup/`, `e_banking/backend_v2_backup_nfc/`.

### 1.2 Languages / frameworks / build tools
| Side | Language | Framework | Build tool |
|---|---|---|---|
| Client | TypeScript, Kotlin | React Native 0.86.3 + Expo SDK ~57.0.23, expo-router | Expo / EAS / Gradle (`android/` committed) |
| Server | Python 3.11.9 | Flask 3.0.0 | Docker (python:3.11-slim / node:20-bookworm-slim), gunicorn 21.2.0 |

### 1.3 Crypto / security library versions (copied from build files)
**Client** — `DPT/package.json`:
- `@noble/curves`: `^2.4.0`
- `@noble/hashes`: `^1.7.1`
- `@noble/ciphers`: `^1.2.1`
- `node-forge`: `^1.3.1`
- `expo-crypto`: `~57.0.3`
- `expo-secure-store`: `~57.0.4`
- `expo-sqlite`: `~57.0.3`
- `expo-local-authentication`: `~57.0.3`
- `react-native-nfc-manager`: `^3.16.1`
- `react-native`: `0.86.3`, `react`: `19.2.3`, `expo`: `~57.0.23`

**Server** — `e_banking/backend/requirements.txt`:
- `flask==3.0.0`, `werkzeug==3.0.1`, `flask-cors==4.0.0`
- `pycryptodome==3.19.0`, `cryptography==42.0.5`
- `supabase==2.0.3`, `python-dotenv==1.0.0`, `gunicorn==21.2.0`
- `psycopg2-binary==2.9.9`, `requests==2.31.0`

**NOT FOUND:** Tink, BouncyCastle, JCA (explicit), Spring, PostgreSQL JDBC driver, Room, SQLCipher, WorkManager, JMH. (Greps matched only incidental substrings inside `package-lock.json` integrity hashes and `.md` reports — no source usage.)

### 1.4 SDK / JDK / runtime versions
- Android: `compileSdkVersion: 36`, `targetSdkVersion: 35`, `buildToolsVersion: "35.0.0"`, `newArchEnabled: true` — `DPT/app.json` (expo-build-properties plugin).
- iOS: `ios.bundleIdentifier: "com.riajulshakib.dptapp"` — `app.json`.
- Android applicationId / package: `com.riajulshakib.dptapp` — `app.json`; `MainApplication.kt`.
- Server runtime: **Python 3.11.9** (`e_banking/render.txt`); Docker runtime base `python:3.11-slim` (`e_banking/Dockerfile`).
- JDK for local Android build: documented as OpenJDK 17 (`PROJECT_DOCUMENTATION.md`; not a source constant). **NOT FOUND** in code.
- gunicorn: `--bind 0.0.0.0:5001 --workers 2 --timeout 120` (`e_banking/Dockerfile` CMD).

---

## 2. PROTOCOL / ENVELOPE

### 2.1 Message M and package P
**M** — plain JSON, built at `DPT/src/services/crypto.ts:275`:
```
const M_obj = { S, R, A, T, N, TxID };            // crypto.ts:275
const M_bytes = TextEncoder().encode(JSON.stringify(M_obj));   // crypto.ts:276
```
| Field | Meaning | Type / value in code |
|---|---|---|
| S | sender | string, `sender.trim().toLowerCase()` (`crypto.ts:267`) |
| R | receiver | string, `receiver.trim().toLowerCase()` (`crypto.ts:268`) |
| A | amount | number (`crypto.ts:269`) |
| T | timestamp | ISO-8601 string (`new Date().toISOString()`, `crypto.ts:256`) |
| N | nonce | string, default `` `n-${Date.now()}-${Math.random().toString(36).substring(2,9)}` `` (`crypto.ts:257`) |
| TxID | tx id | string (UUID v4 — see 2.5) |

**P** — interface `HTEEnvelopePackage` (`crypto.ts:208-218`); constructed `crypto.ts:337-345`:
```
{ v, KeyID, AAD, ePK, IV, C, Tag, Sig }
```
| Field | Type | Encoding |
|---|---|---|
| `v` | number | `1` (`crypto.ts:266`) |
| `KeyID` | string | `'hte-bank-ecdh-v1'` default (`crypto.ts:255`) |
| `AAD` | object | see 2.3 |
| `ePK` | string | 65-byte uncompressed P-256 point, lowercase hex (130 chars) (`crypto.ts:280,337`) |
| `IV` | string | 12-byte hex (24 chars) (`crypto.ts:304,338`) |
| `C` | string | AES-GCM ciphertext hex (C = encrypted minus last 16 bytes, `crypto.ts:296`) |
| `Tag` | string | 16-byte GCM tag hex (32 chars) (`crypto.ts:297,315`) |
| `Sig` | string | 64-byte raw r‖s ECDSA signature hex (128 chars) (`crypto.ts:143-166`; native `DptKeystoreModule.kt:153`) |

### 2.2 Serialization & canonicalization
- **JSON** everywhere (UTF-8 via `TextEncoder`). No CBOR/Protobuf.
- **AAD canonicalization (client):** `AAD_obj = { KeyID, N, S, T, TxID, ePK: ePK_hex, v }` then `JSON.stringify(...)` — `crypto.ts:306-308`. Insertion order is `KeyID, N, S, T, TxID, ePK, v`, which is *already* ASCII-sorted (uppercase before lowercase), so this equals sorted output. The comment "sorted keys" (`crypto.ts:307`) is only accidentally true; there is no `.sort()` call.
- **AAD canonicalization (server):** `json.dumps(AAD, sort_keys=True, separators=(',', ':'))` — `backend/app.py:1279` (transfer) and `app.py:1714` (claim). This is sorted + compact, matching the client.
- **Signature input canonicalization:** plain byte concatenation (see 2.4).

### 2.3 Exact byte-level construction
| Item | Client | Server |
|---|---|---|
| **HKDF salt** | `sha256(UTF8("HTE-v1-salt" + S + TxID + N))` — `crypto.ts:289` | `hashlib.sha256(('HTE-v1-salt'+S+TxID+N).encode())` — `crypto_v2.py:105-106` |
| **HKDF info** | `UTF8("HTE-v1/AES-256-GCM" + T)` ‖ `ePK_bytes(65)` ‖ `UTF8(KeyID)` — `crypto.ts:293-299` | `('HTE-v1/AES-256-GCM'+T).encode()` ‖ `eph_pub_bytes` ‖ `key_id.encode()` — `crypto_v2.py:109` |
| **HKDF extract/expand** | `hkdf(sha256, Z, salt, infoInput, 32)` — `crypto.ts:301` | `HKDF(SHA256, length=32, salt, info).derive(shared_z)` — `crypto_v2.py:112-119` |
| **AAD bytes** | `UTF8(JSON.stringify(AAD_obj))` — `crypto.ts:308` | `json.dumps(AAD, sort_keys=True, separators=(',',':'))` — `app.py:1279` |
| **ECDSA signature input** | `UTF8(str(v)+KeyID)` ‖ `ePK(65)` ‖ `IV(12)` ‖ `C` ‖ `Tag(16)` ‖ `AAD_bytes` — `crypto.ts:327-334` | `(str(v)+key_id).encode()` ‖ `bytes.fromhex(ePK)` ‖ `IV` ‖ `C` ‖ `Tag` ‖ `aad_bytes` — `app.py:1280-1283` (claim: `app.py:1715`) |

**Concatenation style:** *plain concatenation* — **no length prefixes, no delimiters**. (e.g. `crypto.ts:289`, `:293`, `:329-334`.) The server mirrors this exactly. This is a design choice worth flagging because `salt` mixes variable-length strings (S, TxID, N) without separators, which is only safe here because `TxID` is a fixed-format UUID and `S` is a restricted username.

### 2.4 Encodings
- **Public key (`ePK`):** uncompressed — `0x04 ‖ X(32) ‖ Y(32)` = 65 bytes; produced with `p256.getPublicKey(secretKey, false)` (`crypto.ts:280`) and, natively, `out[0]=0x04; X 32; Y 32` (`DptKeystoreModule.kt:118-124`). Transported hex-encoded.
- **Signature:** **raw 64-byte r‖s** (software: noble `p256.sign(...)` → hex, `crypto.ts:166`; native: `derToRawHex()` converts Java DER → r‖s, `DptKeystoreModule.kt:153-176`). Server accepts 64-byte raw *or* DER — `crypto_v2.py:143-150`.
- **IV:** **12 bytes (96-bit)**, fresh per message, from `Crypto.getRandomBytes(12)` (`crypto.ts:304`; expo-crypto CSPRNG).
- **Nonce:** string; default format `n-<epoch-ms>-<base36>` (`crypto.ts:257`). Server validates 4 ≤ len ≤ 128 and stores it (`app.py:727-732`, `952-972`).
- **TxID:** UUID v4 — client `generateUUID()` (`src/utils/security.ts:238-247`), used as the per-submission idempotency key (`src/components/TransactionProcessingView.tsx` idempotencyKeyRef). Server validates 8 ≤ len ≤ 128 and `[A-Za-z0-9._:\-]+` (`app.py:719-725`).
- **Timestamp:** ISO-8601 string, microseconds/UTC (`new Date().toISOString()`; server parses ISO or epoch s/ms — `app.py:697-716`).

### 2.5 Protocol version string & constants
- `v = 1` (`crypto.ts:266`); server rejects `int(v) != 1` (`app.py:1259-1261`, `1682`).
- `KeyID = 'hte-bank-ecdh-v1'` (`crypto.ts:255`; server default `app.py:111`).
- Salt prefix: **`"HTE-v1-salt"`** (`crypto.ts:289`, `crypto_v2.py:105`).
- Info prefix: **`"HTE-v1/AES-256-GCM"`** (`crypto.ts:293`, `crypto_v2.py:109`).
- Hashing: SHA-256; KDF: HKDF-SHA256; AEAD: AES-256-GCM; signature: ECDSA P-256 + SHA-256.

### 2.6 Test vectors
**NOT FOUND** — there are no HTE test vectors in the repo (the only unit tests cover the legacy AES-CBC engine, §6).

To produce one deterministically, call:
- **Client:** `createHybridTransactionEnvelope({ sender, receiver, amount, txid, serverPublicKeyHex, keyId, timestamp, nonce })` — `crypto.ts:250`. **Caveat:** the IV is random (`crypto.ts:304`) and the ephemeral key is random (`crypto.ts:279`), so output is not reproducible. To get a KAT you must stub `Crypto.getRandomBytes`/`p256.keygen`, or test only the KDF.
- **Server KDF KAT:** `HybridEnvelopeCrypto.derive_hte_session_key(server_private_key, ephemeral_pub_hex, aad, key_id)` — `crypto_v2.py:87` — with a fixed server key, fixed `ePK`, fixed `AAD={S,TxID,N,T}` is deterministic and gives a fixed `KT`. Then `decrypt_hte_payload` (`crypto_v2.py:122`) verifies it.

---

## 3. CLIENT

### 3.1 Ephemeral ECDH / HKDF / AES-GCM path
All in `DPT/src/services/crypto.ts`, function `createHybridTransactionEnvelope` (`crypto.ts:250-350`):
- Ephemeral keygen: `const ephemeralKey = p256.keygen();` (`crypto.ts:279`).
- `ePK` uncompressed: `p256.getPublicKey(ephemeralKey.secretKey, false)` (`crypto.ts:280`).
- ECDH: `const sharedPoint = p256.getSharedSecret(ephemeralKey.secretKey, serverPubBytes, false);` then `const Z = sharedPoint.slice(1, 33);` (32-byte X) (`crypto.ts:285-286`).
- HKDF: `const KT = hkdf(sha256, Z, salt, infoInput, 32);` (`crypto.ts:301`).
- AES-GCM: `const aesCipher = gcm(KT, iv, AAD_bytes); const encrypted = aesCipher.encrypt(M_bytes);` then split `C`/`Tag` (`crypto.ts:312-315`).

### 3.2 Keystore / StrongBox usage
Native: `DPT/android/app/src/main/java/com/riajulshakib/dptapp/DptKeystoreModule.kt`.
- Module name: `"DptKeystoreModule"` (`DptKeystoreModule.kt:31`).
- Key alias (from JS): `'dpt_device_ecdsa_keystore_v1'` (`crypto.ts:41`).
- KeyGenParameterSpec: `PURPOSE_SIGN or PURPOSE_VERIFY` (`DptKeystoreModule.kt:85`), `ECGenParameterSpec("secp256r1")` (`:87`), `setDigests(DIGEST_SHA256)` (`:88`).
- `setUserAuthenticationRequired(true)` (`:92`, `:99`).
- Validity duration: API ≥ 30 → `setUserAuthenticationParameters(300, AUTH_BIOMETRIC_STRONG or AUTH_DEVICE_CREDENTIAL)` (`:93-96`); API < 30 → `setUserAuthenticationValidityDurationSeconds(300)` (`:101`).
- Signing: `Signature.getInstance("SHA256withECDSA")` → `initSign(privateKey)` → `update(message)` → `sign()` → DER→r‖s (`:129-133`, `:153`).
- `setInvalidatedByBiometricEnrollment`: **NOT FOUND** (defaults to true — the key is invalidated when biometrics change).
- `CryptoObject` / `BiometricPrompt`: **NOT FOUND** — biometric binding is via the 300 s auth **window**, not per-operation `CryptoObject`.
- **StrongBox:** **NOT FOUND** — `setIsStrongBoxBacked`/`StrongBoxUnavailableException` are not used; keys land in TEE-backed Keystore at best, never StrongBox.
- Software fallback when module absent: `generateSoftwareDeviceKey()` stores a hex private key in SecureStore (`crypto.ts:74-92`, aliases `dpt_device_ecdsa_private_key`/`..._public_key`, `crypto.ts:43-44`).

### 3.3 Duress mechanism
**NOT IMPLEMENTED.** A repo-wide search for `duress` matches **only documentation** files (`DPT/PROJECT_DOCUMENTATION.md`, `DPT/DURESS_AND_BATCH_PLAN.md`, and copies under `DPT_admin/`), never source. There is **no** second ECDSA key pair, no duress PIN, no `isDuressMode`, no duress UI. Therefore it also does **not** match the paper's "separate enrolled fingerprint".

**DEVIATION** vs the paper §3.1 (duress authorization via key separation): entirely absent.

### 3.4 Receiver public-key caching
`DPT/src/services/api.ts`:
- Interface `ServerKeyInfo` (`api.ts:56-67`): `publicKey, keyId, rsaPublicKey?, validFrom?, validUntil?, alg?, version?, fetchedAt?, revokedAt?, forceOnlineResync?`.
- Cache key: `const SERVER_KEY_CACHE = 'dpt_server_key_v1';` (`api.ts:69`), stored in SecureStore.
- `computeKeyCacheTtlMs()` = `min(validUntil − validFrom, DEFAULT_KEY_CACHE_TTL_MS)` where `DEFAULT_KEY_CACHE_TTL_MS = 24*60*60*1000` (`api.ts:68,73-80`).
- `isServerKeyFresh(info)` (`api.ts:100-103`).
- `getServerKeyInfo()` fetches `/server-public-key`, caches on 200, and **falls back to the cache on network error** (`api.ts:117-142`).
- `isOfflineEnvelopeAllowed(info)` = has `publicKey` AND NOT `forceOnlineResync` (`api.ts:109-111`); enforced before envelope construction in both processing screens (`TransactionProcessingView.tsx:147-148`, `transaction-processing.tsx:155-156`).
- Refresh rule: `getServerKeyInfo` overwrites the cache whenever it reaches the server; the TTL is not enforced as a hard block (a stale-but-present cache is still returned offline).

### 3.5 Offline queue
`DPT/src/services/db.ts` (SQLite `niropay.db`, WAL + `busy_timeout=5000`, `db.ts:133-134`):
- Table `pending_offline_transactions(id PK, username, receiver, amount, type, created_at, created_at_epoch, status, raw_json, seq, next_attempt_at)` — `db.ts:166-175`, incremental columns added at `db.ts:204,207`.
- **Encryption at rest:** the signed envelope **P** is stored in **SecureStore** under `dpt_pending_env_<reference>` (`PENDING_ENV_PREFIX = 'dpt_pending_env_'`, `db.ts:8`; write `db.ts:556-562`); SQLite holds only metadata (`raw_json` without the envelope). SecureStore is OS-keystore-backed storage (**not** SQLCipher/Room).
- **Monotonic `seq_i`:** SecureStore counter `dpt_queue_seq_<username>` (`QUEUE_SEQ_PREFIX`, `db.ts:9`; `getNextQueueSeq()` `db.ts:40-50`), written to the `seq` column (`db.ts:581`).
- **Ordering:** `ORDER BY created_at_epoch ASC` (`db.ts:622`).
- **Corruption/gap detection:** `checkQueueIntegrity(username)` collects `seq` values and returns missing numbers (`db.ts:653-667`); called at every sync (`sync.ts:170-173`).
- DB access is serialized by a re-entrant in-process lock (`withDbLock`, `db.ts:17-37`) wrapping `runAsync/execAsync/getAllAsync/getFirstAsync/withTransactionAsync` (`db.ts:210-220`) to avoid "database is locked".

### 3.6 Retry / backoff
- Backoff: `backoffMsFor(retryCount) = min(2^retryCount * 1000, 300000)` — `db.ts:12-15`.
- Applied by `updatePendingOfflineTransactionRetry()` which sets `next_attempt_at = Date.now() + backoffMsFor(retry)` (`db.ts:598-608`).
- Scheduler: custom `SyncService` `setInterval(..., 15000)` (`sync.ts:17,447-449,429-434`); each cycle skips items whose `nextAttemptAt` is in the future (`sync.ts:181-183`) and retries up to `< 5` (`sync.ts:272-278`).
- **WorkManager / OS background scheduling: NOT FOUND.** It is an in-app timer only.

### 3.7 Local duress counter against LD
**NOT FOUND** (duress absent). No `LD` constant exists anywhere in the client.

### 3.8 UI confirmation before signing
Yes. `TransactionAuthScreen.tsx` renders a transaction summary before signing: `summaryLabel`, `summaryTitle`, `summarySubtitle` and the **amount** (`TransactionAuthScreen.tsx:344-349`, amount formatted `৳ {parseFloat(amount).toLocaleString(...)}`). Authorization is a 2-step sequence: biometric prompt (`triggerBiometricAuth`, `TransactionAuthScreen.tsx:197`) then PIN entry (`handleNumPress`, `:255-264`; `pinLength = 5` default `:51`). The signature is produced later by the processing screen, not on this screen.

---

## 4. SERVER

### 4.1 API endpoints
All in `e_banking/backend/app.py` (Flask). Auth = `Authorization: Bearer <token>` (`require_auth`, `app.py:540-556`).

| Method | Path | Line | Request | Response / status |
|---|---|---|---|---|
| GET | `/health` | 1055 | — | `{"status":"ok","message":"E-Banking API is running"}` |
| GET | `/server-public-key` | 1109 | — | keys + `valid_from/valid_until/alg/version/revoked_at/force_online_resync` (`app.py:1111-1133`) |
| GET | `/` | 1136 | — | SPA index |
| POST | `/login` | 1142 | `{username,password}` | `{status,token,user{...}}`; 400/401/404 |
| POST | `/transfer` | 1215 | envelope OR plaintext | see 4.2; 400/403/404/409/200 |
| POST | `/transfer/claim` | 1645 | `{envelope}` | receiver relays sender-signed P; 400/403/409/200 |
| GET | `/user/<username>` | 1804 | Bearer | `{status,user{...}}` |
| GET | `/transactions/<username>?since=` | 1856 | Bearer | `{status,transactions:[...]}` |
| GET | `/notifications/<username>` | 1958 | Bearer | `{status,notifications:[...]}` |
| POST | `/register` | 1997 | `{username,password,nid,activationCode,rsaPublicKey|ecdsaPublicKey,...}` | 201 |
| GET | `/check-receiver/<username>` | 2117 | Bearer | 200/404 |
| POST | `/profile-picture` | 2141 | `{username,imageData}` | 200 |
| GET | `/profile-picture/<username>` | 2173 | Bearer | `{imageData}` |
| POST | `/display-name` | 2199 | `{username,displayName}` | 200 (**no-op**, stores nothing) |
| GET | `/<path:path>` | 2237 | — | SPA fallback |

Reason strings (exact, from the HTE path): `"Unsupported HTE protocol version: {v}"` (1261), `"Unknown or retired KeyID: {key_id}"` (1264), `"Biometric device signature verification failed"` (1286), `"Invalid TxID format"` (1300), `"Invalid or missing nonce N"` (1303), stale message from `check_freshness` (1306), `"Envelope nonce has already been used"` (1310), `"Transaction is already being processed"` (1358), `"Insufficient balance"`, `"Daily limit exceeded"` (1339), `"Receiver not found"` (1345).

### 4.2 Verification pipeline order vs paper's 8 steps
Actual order in `/transfer` (HTE path), with the paper-step verdict:

| Paper step | Actual code | Verdict |
|---|---|---|
| (1) version + KeyID | `app.py:1259-1264` | **MATCH** |
| — *(extra)* 1b key-validity/revocation vs T | `app.py:1266-1271` → `validate_key_at_creation` | **MATCH+** (extension) |
| (2) signature over registered key set | `app.py:1273-1286` (single `rsa_public_key`/`ecdsa_public_key`) | **DEVIATION** — verifies a **single** enrolled key, not the paper's set `{PK_normal, PK_duress}`; no "record which key matched" |
| (3) timestamp/nonce/TxID format | `app.py:1289-1306` (`is_txid_valid` 719, `is_nonce_valid` 727, `check_freshness` 734) | **MATCH** |
| (4) duplicate TxID | `app.py:1307-1311` (short-circuit) + atomic reserve at step 8 | **MATCH** |
| (5) ECDH + HKDF | `app.py:1313-1315` (`derive_hte_session_key`) | **MATCH** |
| (6) GCM verify + decrypt | `app.py:1317-1318` (`decrypt_hte_payload`) | **MATCH** |
| (7) business rules + duress profile | `app.py:1320-1349` (amount, self-tx, **daily limit** 1335-1339, receiver) | **PARTIAL** — business rules present; **duress profile NOT FOUND** |
| (8) atomic commit + TxID | `app.py:1352-1383` (reserve + `update_accounts_atomic` + `commit_idempotency`) | **PARTIAL/DEVIATION** — see 4.4 (autocommit) |

### 4.3 DB schema
Two sources:
1. `e_banking/database/SUPABASE_NEW_DATABASE_SETUP.sql` — enums + 12 tables (`profiles` :65, `accounts` :88, `registered_devices` :101, `merchants_or_billers` :113, `beneficiaries` :125, `transactions` :135, `transaction_crypto_audit` :155, `payment_requests` :167, `notifications` :183, `login_events` :195, `staff_profiles` :204, `audit_logs` :215), plus `server_keys` :327, `idempotency_keys` :345, `security_events` :356, `used_nonces` :365, `vault_read_secret()` :376, RLS policies and indexes (:261-277).
2. Runtime auto-create: `auto_create_tables()` (`app.py:244`) creates `profiles` in DB1 (`app.py:246-273`, columns include `rsa_public_key` :272, `daily_limit REAL NOT NULL DEFAULT 5000.0` :270) and in DB2 `accounts`, `transactions`, `notifications`, `idempotency_keys` (`key TEXT PRIMARY KEY`), `server_keys` (+validity cols via `ALTER … ADD COLUMN IF NOT EXISTS`), `security_events`, `used_nonces`.

Unique constraints actually used by HTE: `idempotency_keys.key` PK (`app.py` creation ~`326-334`; SQL `:345`), `server_keys.id` PK (`app.py:337-347`; SQL `:327`), `used_nonces.nonce` PK (SQL `:365`).

**DEVIATION (schema drift):** the `.sql` file defines `profiles` with **plaintext** `full_name/phone_number/email` (`:65-86`), while the runtime `auto_create_tables()` and the app write encrypted `full_name_enc/mobile_enc/email_enc` (`app.py:258-265,2017-2074`). The two schemas do not agree.

### 4.4 Atomic commit / duplicate handling
- **Reserve-first idempotency:** `reserve_idempotency(txid,…)` (`app.py:807-848`) reads the row; if `status == 'committed'` returns the cached result; else INSERTs `status='pending'`; a PK violation is caught and re-checked (`app.py:838-847`). Returns `new | committed | inflight`.
- Fired **after** all validations, at step 8 (`app.py:1352-1359`): `committed` → return cached 200; `inflight` → `409 "Transaction is already being processed"`.
- **Settlement:** `update_accounts_atomic()` (`app.py:871-931`): with a direct Postgres connection (`get_db_connection`, `app.py:222`) it runs a **conditional debit** `UPDATE accounts SET balance = balance - %s WHERE id = %s::uuid AND balance >= %s RETURNING balance` (`app.py:887-890`) then a credit (`app.py:898-901`), then `commit()`. Without a direct connection it falls back to read-modify-write via Supabase (`app.py:905-931`).
- **DEVIATION (atomicity):** `get_db_connection` sets `conn.autocommit = True` (`app.py:223`). With autocommit, the debit and the credit are committed as **two independent transactions**, so the "atomic commit" is not actually a single transaction; a failure between them leaves the receiver un-credited (funds "in flight"). Mitigation: the conditional debit prevents a negative sender balance, and the idempotency reservation prevents duplicate settlement.
- Isolation level: **NOT SPECIFIED** anywhere (defaults to READ COMMITTED). No `SELECT … FOR UPDATE` / explicit `BEGIN` is used.
- Duplicate response: idempotent — identical TxID returns the stored result with HTTP 200 (`app.py:1354-1356`, cached result from `check_idempotency`, `app.py:657-670`).

### 4.5 Receiver key storage / KeyID / validity / grace
- Stored as a **PEM string** in the `server_keys` DB table (column `private_key_pem`), id `'hte-bank-ecdh-v1'` (`app.py:111,137-165`). Not a file, not env, not SoftHSM.
- Optional protection: `wrap_server_secret()/unwrap_server_secret()` encrypt the PEM at rest with AES-256-GCM using `SERVER_KEY_WRAP_KEY` (`app.py:978-1015`).
- Optional external isolation: `load_vault_secret()` reads the PEM from **Supabase Vault** via RPC `vault_read_secret` (`app.py:1018-1033`); used first if `SERVER_KEY_VAULT_SECRET` is set, else the DB row is used.
- Valid_from/valid_until/revoked_at columns: `app.py` `server_keys` DDL ~`337-347`; SQL `:327-343`.
- Grace period: `KEY_ROTATION_GRACE_SECONDS = int(os.environ.get('KEY_ROTATION_GRACE_SECONDS', '86400'))` (`app.py:694`).

### 4.6 Revocation handling (T vs Trev)
Yes. `validate_key_at_creation(key_id, t_value)` (`app.py:758-804`):
- Parses envelope `T` (`parse_envelope_timestamp`, `app.py:697`).
- `revoked_at`: if `creation >= revoked_at` → reject `"Key was revoked before this envelope was created"` (`app.py:782-783`); if `creation < revoked_at` → allowed within `revoked_at + KEY_ROTATION_GRACE_SECONDS` (`app.py:785-790`).
- `valid_until`: beyond it, a grace window is applied (`app.py:793-796`); otherwise only the current active KeyID is accepted (`app.py:799-803`).
- Invoked before signature verification at `app.py:1266-1271`.

### 4.7 Duress profile on server
**NOT FOUND.** No `L_D`, no risk event for duress, no restricted operations, no second-key lookup. `security_events` exists and is written for other reasons (`signature_rejected`, `nonce_replay`, `stale_envelope`, `key_validity_rejected`, `daily_limit_exceeded`, `settlement_failed`, `unknown_keyid`, `claim_forbidden`) via `log_security_event()` (`app.py:933-950`).

### 4.8 Freshness / nonce
- Timestamp window: `HTE_MAX_CLOCK_SKEW_SECONDS = int(os.environ.get('HTE_MAX_CLOCK_SKEW_SECONDS', '300'))` (`app.py:693`); `check_freshness()` rejects if `abs(now − T) > 300s` (`app.py:734-744`).
- Nonce store: `used_nonces(nonce PK, txid, sender, used_at)` (`app.py:952-972`; SQL `:365`). `is_nonce_used()` before settlement (`app.py:1308-1310` transfer, `1705-1709` claim); `mark_nonce_used()` after commit (`app.py:1383`, `1783`). **No expiry/TTL** on nonce rows.

### 4.9 Policy parameters (values)
| Parameter | Value | Location |
|---|---|---|
| `HTE_MAX_CLOCK_SKEW_SECONDS` | `300` | app.py:693 |
| `KEY_ROTATION_GRACE_SECONDS` | `86400` | app.py:694 |
| `SESSION_TTL_SECONDS` | `2592000` (30d) | app.py:512 |
| `daily_limit` default | `5000.0` | app.py:270, 2068 |
| receiver KeyID | `hte-bank-ecdh-v1` | app.py:111 |
| client τ_cache default | `86400000` (24h) | api.ts:68 |
| client backoff cap | `300000` (5 min) | db.ts:13 |
| client queue poll | `15000` ms | sync.ts:17 |
| PIN lockout (client) | 3 attempts / 15 min | security.ts:36-37 |

---

## 5. PAPER-CLAIM CHECKLIST

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| a | Fresh ephemeral ECDH per transaction | **IMPLEMENTED** | `crypto.ts:279` |
| b | ECDH result not used directly as AES key (HKDF used) | **IMPLEMENTED** | `crypto.ts:285-301`; `crypto_v2.py:102-119` |
| c | Salt/info include S,TxID,N (salt) and T,ePK,KeyID (info) | **IMPLEMENTED** | `crypto.ts:289,293`; `crypto_v2.py:105,109` |
| d | AES-256-GCM with fresh 96-bit IV | **IMPLEMENTED** | `crypto.ts:304,312` |
| e | AAD contains v,S,T,N,TxID,KeyID,ePK | **IMPLEMENTED** | `crypto.ts:306` |
| f | Signature covers v‖KeyID‖ePK‖IV‖C‖Tag‖AAD | **IMPLEMENTED** | `crypto.ts:327-334`; `app.py:1280-1283` |
| g | Private signing key non-exportable + biometric-bound | **PARTIAL** | `DptKeystoreModule.kt:74-110` (keystore + auth window, **no StrongBox, no CryptoObject**; software fallback `crypto.ts:74-92`; module not built in current APK) |
| h | Duress key separation | **NOT IMPLEMENTED** | no source matches for "duress" |
| i | Timestamp + nonce + TxID replay checks | **IMPLEMENTED** | `app.py:1289-1311`, `952-972` |
| j | Atomic check-and-commit with DB uniqueness | **PARTIAL** | reserve `app.py:807-848`; **but autocommit breaks single-tx atomicity** `app.py:223,871-931` |
| k | Concurrent duplicate submission handled correctly | **IMPLEMENTED** | PK reserve + 409 inflight `app.py:838-847,1357-1359` |
| l | Encrypted offline queue (Keystore-backed) | **PARTIAL** | envelope in SecureStore `db.ts:8,556-562`; metadata in SQLite (not SQLCipher) `db.ts:166` |
| m | Same immutable P and same TxID reused on retry | **IMPLEMENTED** | `sync.ts:179-188`; `db.ts:540-583` |
| n | Exponential backoff | **IMPLEMENTED** | `db.ts:12-15,598-608`; `sync.ts:181-183` |
| o | Key-validity cache with tau_cache | **PARTIAL** | client TTL `api.ts:73-80,100-103`; server publishes window `app.py:1111-1133`; τ is capped at 24 h, not exactly `Tend−Tstart` unless server supplies it |
| p | Revocation check using creation time T | **IMPLEMENTED** | `app.py:758-804` |
| q | Grace period for retired receiver keys | **IMPLEMENTED** | `app.py:694,785-796` |
| r | Offline duress counter + server recheck of LD | **NOT IMPLEMENTED** | no `LD`/duress source |
| s | No balance change before all checks pass | **PARTIAL** | reserve precedes settlement `app.py:1352-1360`; but settlement is 2 autocommit statements and `record_transaction(...,'aborted'/'futile')` writes before settlement (`app.py:1341-1348`) |
| t | RSA-2048 + RSA-PSS baseline exists | **IMPLEMENTED** | server `crypto_v2.py:163-231`, path `app.py:1417-1505`; client `generateRSAKeyPair` `crypto.ts:353-375` |

---

## 6. TESTS AND BENCHMARKS

### 6.1 Tests present
| File | Type | Coverage | Network needed? |
|---|---|---|---|
| `Testing/Test1_Unit_Crypto/test_crypto.py` | Unit (pytest) | Legacy `CryptoEngine` AES-CBC roundtrip, HMAC determinism, KDF determinism, tamper detection, PBKDF2 — 8 tests | No |
| `Testing/Test2_Integration_Transaction/test_transaction_flow.py` | Integration | register/login/transfer (legacy), 404/400/futile, history; Playwright screenshots | Yes — `https://localhost:5001` |
| `Testing/Test3_Security_Replay/test_replay_attack.py` | Security | replay of same payload, stale T, corrupted ciphertext, missing fields, no auth | Yes |
| `Testing/test_helpers.py` | Helper | `BackendClient` + `encrypt_transfer_payload` (legacy) | — |
| `Testing/create_spreadsheet.py` | Script | builds `Test_Cases.xlsx` | No |
| `Testing/TEST_REPORT.md` | Report | prior run results | — |

**No HTE-specific tests exist.** All tests exercise the **legacy AES-CBC / HMAC (K1/K2/BP/T)** protocol, not the HTE envelope. **No client tests** (jest/Detox absent from `package.json`).

### 6.2 Benchmarks / timing / load
- **NOT FOUND** — no JMH, Macrobenchmark, or custom timing harness. No envelope-size measurement code.
- Only "load/concurrency" artifact is the replay test (`Test3_Security_Replay`), which is functional, not a load test.

### 6.3 What was actually run
- **`Testing/Test1_Unit_Crypto/test_crypto.py`** — executed (offline, no network, no writes outside the repo):
  ```
  cd "Web DPT + MainBackend is here" && python3 -m pytest Testing/Test1_Unit_Crypto/test_crypto.py -q
  => 8 passed in 0.07s
  ```
- **Test2 / Test3 not run:** they require a running server at `https://localhost:5001` with the self-signed TLS cert and mutate data; also reference a Windows Playwright path. Not safe/possible offline here.

---

## 7. MEASUREMENT READINESS

| Item | Exists? | Where to add a timer/counter (no behavior change) |
|---|---|---|
| Per-op timing: ECDH / HKDF / AES-GCM | **NOT FOUND** | wrap `crypto.ts:279-301` and `:312-315`; server: wrap `crypto_v2.py:102,112,130` |
| ECDSA sign timing | **NOT FOUND** | `signWithDeviceKey()` `crypto.ts:143-166`; verify `crypto_v2.py:134-156` |
| Envelope size (computed) | Computable from code | see below |
| Server per-step latency | **NOT FOUND** | instrument `app.py:1259-1383` (one span per `# Step`) |
| Queue storage size per pending envelope | **NOT FOUND** | `db.ts:556-562` (envelope bytes = `envelopeJson.length`) |
| Offline sync metrics (retry count, time-to-commit) | Partial (retryCount stored) | `sync.ts:272-283` (retryCount present); add timestamps around `:179-188` |

**Envelope size (deterministic breakdown, hex chars in the JSON):**
- `ePK`: 65 bytes → **130** hex chars (`crypto.ts:280`).
- `IV`: 12 bytes → **24** hex (`crypto.ts:304`).
- `Tag`: 16 bytes → **32** hex (`crypto.ts:297,315`).
- `Sig`: 64 bytes → **128** hex (`crypto.ts:166`).
- `C`: `len(C) = len(M) − 1 + 16` bytes where `M = {"S":..,"R":..,"A":..,"T":..,"N":..,"TxID":..}`; C hex = 2·len(C).
- `AAD` (JSON): constant fields `v:1`, `KeyID:"hte-bank-ecdh-v1"` (16), `T` (24-char ISO), `TxID` (36-char UUID), `N` (variable), `ePK` (130), `S` (variable).
- Fixed, message-independent payload bytes: `ePK(65) + IV(12) + Tag(16) + Sig(64) = 157 bytes`; the `ePK`-hex and `Sig`-hex dominate the JSON string. An approximate wire size for a typical P2P transfer is ~700–900 bytes of JSON; compute exactly as `serializeEnvelopeP(env).length` (`crypto.ts:437-439`).

---

## 8. DEVIATIONS, RISKS AND KNOWN ISSUES

### 8.1 Deviations from the paper
1. **Duress authorization absent** (paper §3.1) — no second key pair, no `L_D`, no silent risk event. **DEVIATION / NOT IMPLEMENTED.**
2. **Receiver verifies a single enrolled device key**, not the paper's set `{PK_normal, PK_duress}` (`app.py:1274`). **DEVIATION.**
3. **Atomicity:** `conn.autocommit = True` (`app.py:223`) means debit+credit are two transactions; the paper's "atomic commit" is not achieved as written. **DEVIATION.**
4. **No StrongBox, no per-operation `CryptoObject`**; biometric binding is a 300 s window (`DptKeystoreModule.kt:93-101`). **DEVIATION** (paper: per-operation auth via platform keystore).
5. **Receiver key not in an HSM** — a DB-stored PEM, optionally AES-GCM-wrapped or read from Supabase Vault (`app.py:137-165,978-1033`). Paper allows "HSM or equivalent isolated service"; Vault/at-rest are software. **DEVIATION (weaker).**
6. **Nonce has no expiry** (`used_nonces`, no TTL). **DEVIATION (minor).**
7. **Paper's exact ECDSA-over-`v‖KeyID…` uses plain concatenation on both sides** — matches, but note it is not length-prefixed.

### 8.2 TODO / FIXME / HACK
- No literal `TODO`/`FIXME` markers found in the HTE client crypto; the server has explanatory comments referencing the paper (`crypto_v2.py:39`, `app.py:693-745`) and one production note about removed forfeiture (`transaction-processing.tsx:327-329`).
- `app.py:2199-2236` `/display-name` is a documented no-op ("we'll just … return success").

### 8.3 Security concerns
1. **Secrets committed:** `e_banking/backend/.env.backend` is **tracked in git** and contains live Supabase URLs + service-role keys + DB passwords + possible PII keys. **REDACTED here** (values not reproduced). Rotate and untrack.
2. **QR "signature" is not a signature:** `signQRPayload`/`verifyQRPayload` (`crypto.ts:377-405`) compute `SHA256("dpt_qr_sig_"+payload)` with **no key** — anyone can forge a dynamic-QR `sig`. The scanned dynamic QR is treated as valid if this bare digest matches (`qr-pay.tsx:187-198`). This undermines the rolling-QR anti-clone claim.
3. **Hardcoded legacy fingerprint "bp":** `crypto.py:32` uses `fixed_bp = sha256(b"123456")`, and the default `fingerprint_bp` is `'123456'` (`app.py:252`). The "third factor" BP is effectively a constant.
4. **Legacy client-supplied `username`** in `/transfer` body is authorized against the bearer token via `authorize_username` (`app.py:488-492`), but the sender identity is not derived from the token alone.
5. **Verbose logging of financial data:** `[DPT_NATIVE_TRACE]` logs and console output include transaction titles/amounts and IDs (`TransactionAuthScreen.tsx`, `Header.tsx`, `sync.ts`), which can leak to logcat.
6. **Non-constant-time comparisons:** legacy `check_password_hash` fallback compares plaintext `password_key_k2 == password` (`app.py:1209-1212` region); K1/K2 stored server-side (`app.py:2061-2064`), i.e. symmetric keys at rest.
7. **Fallback path is weaker than HTE:** when the envelope is missing or signing fails, the app falls back to plaintext `/transfer` (`app.py:1520-1635`), which only checks a bearer token + balance — the HTE guarantees do not apply. (Necessary for compatibility, but a reviewer will note it.)
8. **`getRandomBytes` polyfill** writes a global `crypto.getRandomValues` backed by expo-crypto (`crypto.ts:26-36`) — correct now, but it must be the first thing loaded; any library that loads before `crypto.ts` still sees no `getRandomValues`.

### 8.4 Reviewer-attack list (summary)
Duress absent; HSM/StrongBox absent; atomicity broken by autocommit; forgeable QR signature; constant BP; secrets in VCS; schema drift between `.sql` and runtime DDL; nonce no-TTL; fallback to unauthenticated-by-signature plaintext transfer.

---

## 9. HOW TO RUN

### 9.1 Server
```bash
cd "Web DPT + MainBackend is here/e_banking"
# Option A: launcher (auto-builds frontend; TLS unless ENABLE_TLS=0)
python3 app.py                      # -> https://localhost:5001
# Option B: plain Flask (no TLS)
cd backend && ENABLE_TLS=0 python3 app.py   # -> http://localhost:5001
# Option C: Docker sandbox (nginx TLS in front)
docker compose up --build           # https://localhost
```
- Port: `PORT` (default `5001`). Env file: `e_banking/backend/.env.backend`.
- Required env (names only): `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `IDENTITY_SUPABASE_URL`, `IDENTITY_SUPABASE_ANON_KEY`, `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`, `IDENTITY_DB_PASSWORD`; optional `PII_ENCRYPTION_KEY`, `PII_HMAC_PEPPER`, `SERVER_KEY_WRAP_KEY`, `SERVER_KEY_VAULT_SECRET`, `SESSION_SECRET`, `HTE_MAX_CLOCK_SKEW_SECONDS`, `KEY_ROTATION_GRACE_SECONDS`, `SANDBOX_FAKE_DB`, `FRONTEND_ORIGINS`.
- Sandbox (no real DB): `SANDBOX_FAKE_DB=1` → in-memory fake with users `alice`/`bob` (`fake_supabase.py`).
- DB setup: run `e_banking/database/SUPABASE_NEW_DATABASE_SETUP.sql` in Supabase's SQL editor, or rely on `auto_create_tables()` at startup if the DB password is set.

### 9.2 Client
```bash
cd "Main DPT/DPT"
npm install
npx expo start                     # dev bundler
npx expo run:android              # build+install (REQUIRES a device or emulator; none needed for the server)
# or a cloud build:
eas build -p android --profile preview
```
- `expo run:android` needs a **physical device (USB debugging) or a running emulator**; it fails with "No Android connected device found" otherwise.
- Hardware keystore (StrongBox) testing requires a **physical device** (emulators have no secure hardware).
- Base API URL is `https://e-pay-fydp.onrender.com` (`api.ts:10-11`; `USE_LOCAL` toggle at `api.ts:7`).

### 9.3 Tests
```bash
# offline, safe:
cd "Web DPT + MainBackend is here" && python3 -m pytest Testing/Test1_Unit_Crypto/test_crypto.py -q
# need a running server at https://localhost:5001:
python3 Testing/Test2_Integration_Transaction/test_transaction_flow.py
python3 Testing/Test3_Security_Replay/test_replay_attack.py
```

---

## 10. SUMMARY TABLE

| Feature | Status | Evidence (file:line) | Notes |
|---|---|---|---|
| Ephemeral P-256 ECDH / tx | IMPLEMENTED | crypto.ts:279 | |
| HKDF-SHA256 KT derivation | IMPLEMENTED | crypto.ts:301; crypto_v2.py:112 | salt/info match paper |
| AES-256-GCM + 96-bit IV | IMPLEMENTED | crypto.ts:304,312 | CSPRNG IV |
| AAD {v,S,T,N,TxID,KeyID,ePK} | IMPLEMENTED | crypto.ts:306 | |
| ECDSA over v‖KeyID‖ePK‖IV‖C‖Tag‖AAD | IMPLEMENTED | crypto.ts:327-334; app.py:1280 | raw r‖s accepted |
| Non-exportable device key (StrongBox) | PARTIAL | DptKeystoreModule.kt:74-110 | no StrongBox, no CryptoObject, module unbuilt |
| Duress key separation | NOT IMPLEMENTED | — | docs only |
| Freshness/nonce/TxID checks | IMPLEMENTED | app.py:1289-1311, 952-972 | window 300s |
| Atomic check-and-commit | PARTIAL | app.py:807-848, 871-931 | autocommit breaks single-tx |
| Concurrent duplicate handling | IMPLEMENTED | app.py:838-847, 1357-1359 | 200 cached / 409 inflight |
| Encrypted offline queue | PARTIAL | db.ts:8,556-562; :166 | SecureStore envelope + SQLite meta |
| Same P+TxID on retry | IMPLEMENTED | sync.ts:179-188 | |
| Exponential backoff | IMPLEMENTED | db.ts:12-15, 598-608 | cap 5 min |
| Key-validity cache (τ) | PARTIAL | api.ts:73-103 | TTL capped 24h |
| Revocation vs T | IMPLEMENTED | app.py:758-804 | |
| Grace period | IMPLEMENTED | app.py:694,785-796 | 86400 s |
| Offline duress counter / LD | NOT IMPLEMENTED | — | |
| No balance change before checks | PARTIAL | app.py:1352-1360 | 2 autocommit statements |
| RSA-2048 + RSA-PSS baseline | IMPLEMENTED | crypto_v2.py:163-231; app.py:1417-1505 | |

### Top 10 things the paper must be corrected to match the code
1. Duress is not implemented — remove or reframe §3.1 (and the "separate enrolled fingerprint" claim).
2. The receiver holds one ECDH key (`hte-bank-ecdh-v1`), no key set `{PK_normal, PK_duress}`.
3. Device signing keys are not StrongBox-backed and not per-operation `CryptoObject`-bound (300 s window instead).
4. Receiver private key lives in a DB row (or Vault), not an HSM.
5. "Atomic commit" is two autocommit statements, not one transaction.
6. Nonce state has no expiry window.
7. The envelope is serialized as JSON (not CBOR) with plain concatenation and no length prefixes.
8. Signature is transported as raw 64-byte r‖s hex (DER also accepted).
9. The offline queue is SQLite metadata + SecureStore blob, not SQLCipher.
10. No test vectors or benchmarks are provided for HTE.

### Top 10 things the code must be fixed to match the paper
1. Implement duress key separation (second enrolled key + `L_D` + silent risk event) client and server.
2. Make settlement a real single transaction (remove `autocommit=True` for the settlement connection; add `SELECT … FOR UPDATE`).
3. Use `BiometricPrompt` with a `CryptoObject` and request StrongBox (`setIsStrongBoxBacked(true)`) with fallback.
4. Verify signatures against a device **key set** and record which key matched.
5. Move the receiver key to an HSM/isolated service (KMS/Vault) and document the trade-off.
6. Add nonce TTL/expiry and enforce `τ_cache ≤ Tend − Tstart` exactly.
7. Add HTE unit tests + fixed test vectors (deterministic IV/keygen injection).
8. Add per-step timing + envelope-size instrumentation.
9. Untrack `.env.backend` and rotate all leaked credentials.
10. Resolve `.sql` vs `auto_create_tables()` schema drift (profiles plaintext vs `_enc`).

---

*End of report.*
