# HTE: App Fix Brief — Offline-First Path (Duress Excluded)

**Rule:** paper stays as the spec; the app is brought to match it. Duress (§3.1) is **out of scope** for this brief. When fixes are done, run the benchmark/test and put Section 5 numbers into the paper.

Source: paper (`HTE_offline_duress_revised`) + code audit (`HTE_CODE_REPORT.md`).

> **Duress excluded:** items #2, #3, #4, #5 from the original brief are removed. The paper's §3.1 (duress) remains unimplemented — see §F.

---

## A. Already matching the paper (do not touch)

- Ephemeral P-256 ECDH; HKDF-SHA256 with paper-matching salt/info
- AES-256-GCM with fresh 96-bit CSPRNG IV
- ECDSA P-256, raw `r‖s` signature
- `AAD = {v, S, T, N, TxID, KeyID, ePK}`; signature input `v‖KeyID‖ePK‖IV‖C‖Tag‖AAD`
- Timestamp 300 s window, nonce syntax, TxID format, duplicate TxID (cached result / 409)
- Offline queue, same `P` + same `TxID` on retry, `seq_i` gap check, exponential backoff
- Receiver public-key validity cache, revocation check using envelope **creation time `T`**, grace period
- RSA-2048 + RSA-PSS baseline

---

## B. What had to be fixed (paper says → code does)

Priority: **P0** = paper's main claim, **P1** = smaller claim. **Status** reflects the current tree.

| # | P | Paper says | Current code | Action | Status |
|---|---|---|---|---|---|
| 1 | P0 | Step 8: financial update + TxID record **atomically committed** | `conn.autocommit = False` in `update_accounts_atomic`; conditional debit + credit (+ nonce) in one Postgres transaction — `app.py:873-924` | Keep conditional debit; test 100 parallel same TxID; keep Supabase fallback **test-only** | ✅ **DONE (code)** — needs 100-parallel test |
| 6 | P0 | Signing key non-exportable, **per-operation** biometric, StrongBox (Table 1) | StrongBox attempted with TEE fallback; `isHardwareBacked()` added — `DptKeystoreModule.kt:73-150`. Still a **300 s auth window**, no `CryptoObject`; software fallback still present; module not in any APK yet | Build the native module; add `BiometricPrompt` + `CryptoObject`; disable software fallback in release; StrongBox→TEE already handled | ⚠️ **PARTIAL** — StrongBox/TEE done; CryptoObject + fallback-off + APK build remaining |
| 7 | P1 | `τ_cache ≤ Tend − Tstart`; once elapsed, no envelope without online refresh | `isOfflineEnvelopeAllowed()` now requires `isServerKeyFresh()` — `api.ts:109-114` | — | ✅ **DONE** |
| 8 | P1 | Nonce state/freshness | `NONCE_TTL_SECONDS` (86400) + `used_nonces.expires_at`; nonce burned **inside** the settlement transaction — `app.py:696,916-923,969-998` | Apply migration on deploy; test "same nonce + new TxID → reject" | ✅ **DONE (code)** — needs `expires_at` column on the live DB |
| 9 | P1 | "No balance-changing side effect before all checks succeed" | Verified: `record_transaction(..., 'aborted'/'futile')` only inserts a row — **never mutates balances** (`app.py:599-617`) | None | ✅ **DONE (verified)** |
| 10 | P1 | Fixed overhead ~125 B (compressed ePK 33 B) | Client now sends **33-byte compressed** ePK (`crypto.ts:279-284`); server accepts compressed points (`from_encoded_point`) — HKDF `info` and signature input use the 33-byte value | Rebuild the test vector; confirm client/server produce identical results | ✅ **DONE (code)** — needs joint test vector |
| 11 | P1 | Local queue "secure storage (keystore-backed)" | `receiver`/`amount` moved out of SQLite into SecureStore `dpt_pending_meta_<id>`; envelope already in `dpt_pending_env_<id>`; SQLite keeps only routing/retry metadata — `db.ts:566-601,662-668,717-722` | — | ✅ **DONE** |
| 12 | P1 | Receiver key HSM / isolated service ("intended") | DB-stored PEM; optionally AES-256-GCM-wrapped (`SERVER_KEY_WRAP_KEY`) or read from Supabase Vault (`SERVER_KEY_VAULT_SECRET`) — `app.py:981-1033` | Set `SERVER_KEY_WRAP_KEY` (or use Vault). Full HSM not required | ⏳ **ACTION (operational)** — set the env |

**Rollback checkpoints:** app `4a37cbe`, backend `422573b`.

---

## C. Repo cleanup (do first)

`e_banking/backend/.env.backend` is **git-tracked** and contains live keys/URLs/passwords.
- **Rotate** every key (Supabase anon + service-role, DB passwords, PII keys).
- **Untrack** the file (`git rm --cached e_banking/backend/.env.backend`) and add to `.gitignore`.
- **Scrub history** (`git filter-repo`) so the repo can be shared.

---

## D. Test-time configuration

- Disable the **plaintext `/transfer` fallback** (`app.py:1520-1635`) for the test run.
- Use **real Postgres** (no `SANDBOX_FAKE_DB`).
- Use a **real Android phone** — emulators have no StrongBox/hardware keystore.

---

## E. After fixes: test + measure (for paper Section 5)

1. **Test vector** — fix an ephemeral key + IV, emit `test_vectors.json`; the TS client and Python server must produce the **same** bytes.
2. **Security tests** — one per Table-1 row: bit-flip (C, Tag, IV, AAD, ePK, KeyID, v), wrong key, replay, old timestamp, reused nonce, **100 parallel same TxID**, revocation (T < T_rev / T ≥ T_rev), retired-key grace, retry, atomicity-failure (kill between debit and credit → balances unchanged), tampered queue.
3. **Benchmark** — 3 phones, 1000 runs, drop 50 warm-ups; report mean/std/median/p95 + raw CSV: ECDH, HKDF, AES-GCM, sign (normal), total; server per-step latency + throughput; envelope size **HTE vs RSA**; queue bytes per envelope; offline (200 tx, 3 scenarios: 5 min offline, on/off, 20% loss).
4. **Return** — setup table (phone, Android, CPU, RAM, key level, library versions, server spec), CSV, test result table, offline results, and a **deviation list** (what could not be done).

---

## F. What the paper must change (not doable in code)

> Duress-specific corrections (separate enrolled fingerprint; single extra key lookup) are **out of scope** here because duress is excluded from the app.

1. **Ref [7]:** TLS 1.3 is **RFC 8446 (2018)**, not RFC 9846.
2. **Section refs:** §3.1 says *"step (2) of §4"* → should be **§3**. Re-check Section 5's *"§4–§4.1"* wording.
3. **§2 "HSM or equivalent isolated service":** the app provides **software** isolation only (AES-256-GCM at rest / Supabase Vault), not a hardware HSM. Either accept the "equivalent isolated service" reading or budget a real HSM (KMS/CloudHSM).
4. **§3.1 duress is not implemented** — if the paper keeps it, it is an unshipped feature; otherwise state it as out of scope.

---

## Current match vs paper (duress excluded)

| Area | Match |
|---|---|
| §3 envelope crypto | **100%** |
| §3 receiver checks | **~95% → ~100%** once #1/#8 are deployed & the fallback is off for tests |
| §4.1 offline lifecycle | **~95%** |
| §2 key protection | **~85%** (StrongBox code in, awaiting APK build; no `CryptoObject`) |
| **Overall** | **≈ 93–97%** (code); strict evidence ~90% |

The remaining gap to 100% is: **#6 `CryptoObject` + build/verify**, **#12 HSM-grade key isolation**, and **§3.1 duress** (excluded).
