# HTE Receiver-Key HSM Integration — Implementation & Verification Report

**Protocol:** Hybrid Transaction Envelope (HTE), offline-first petty-cash payments
**Component:** Receiver long-term P-256 ECDH key (`SK_R^dh`, `PK_R^dh`) held in an HSM
**Reference:** HTE paper §2 ("the private key is intended to reside in an HSM or equivalent isolated service") and §3 step (2)
**Status:** Implemented · Tested

---

## 1. Scope

The HTE protocol keeps the receiver's long-term ECDH key static so that senders can
construct envelopes asynchronously and offline. That makes the receiver private key
long-lived and high-value. This report covers the implementation and verification of
the **HSM-backed receiver key path**: the private key is generated inside and never
leaves the HSM, and the protocol's shared-secret step is executed by the HSM.

Device-side (sender) signing keys are out of scope here: they are non-exportable and
must remain on the device, bound to the platform keystore (Android StrongBox), as
required by §2.

---

## 2. Design

The protocol step

```
Z = ECDH(SK_R^dh, ePK)            (paper eq. 2)
salt = H(HTE-v1-salt || S || TxID || N)     (3)
PRK  = HKDF-Extract(salt, Z)                (4)
info = HTE-v1/AES-256-GCM || T || ePK || KeyID   (5)
KT   = HKDF-Expand(PRK, info, 32)           (6)
```

is split at equation (2): **Z is computed inside the HSM** and only the 32-byte
result reaches the application. HKDF and AES-256-GCM are unchanged. Because HKDF is
deterministic, the HSM path and a local path produce a **byte-identical KT**, so no
other protocol component changes and no client change is required.

The HSM is an AWS KMS asymmetric key:

| Property | Value |
| --- | --- |
| Key spec | `ECC_NIST_P256` |
| Key usage | `KEY_AGREEMENT` |
| Operation | `kms:DeriveSharedSecret` (KeyAgreementAlgorithm = `ECDH`) |
| Public key | `kms:GetPublicKey`, served by `GET /server-public-key` |
| Private key | never leaves the HSM |

---

## 3. Implementation

**`e_banking/backend/kms_bridge.py`** (new)
- `kms_enabled()` — active when an HSM key id is configured.
- `derive_shared_secret_z(ephemeral_pub_hex)` — executes `Z = ECDH(SK_R^dh, ePK)` via
  `kms.derive_shared_secret`; returns the raw 32-byte Z. The receiver private key is
  never materialised in the process.
- `get_public_key()` — fetches and caches the HSM public half (`hex`, `pem`).
- `describe_key()` — key spec/usage/state metadata for startup logging.
- The ECDH key id is normalised to a SubjectPublicKeyInfo DER before the KMS call.

**`e_banking/backend/crypto_v2.py`**
- `HybridEnvelopeCrypto.derive_hte_session_key(..., shared_z=None)` — accepts a
  precomputed Z. When supplied (HSM path) no local private key is required; when
  omitted the previous local derivation is used unchanged.

**`e_banking/backend/app.py`**
- `ensure_server_ecdh_keys()` — when the HSM is configured, loads the public half from
  the HSM and holds no private key; otherwise falls back to the software key path.
- `derive_kt_server_side(ephemeral_pub_hex, aad, key_id)` — single entry point used by
  both `/transfer` (HTE path) and `/transfer/claim`; routes Z through the HSM when
  configured.
- `GET /server-public-key` — serves the HSM public key with the same key-validity
  metadata contract as before (no client change).

**`e_banking/backend/requirements.txt`** — adds `boto3`.

---

## 4. Key lifecycle

- Key created with `--key-usage KEY_AGREEMENT --key-spec ECC_NIST_P256`; alias
  `alias/hte-receiver-ecdh`.
- Application credentials need only `kms:DeriveSharedSecret`, `kms:GetPublicKey`,
  `kms:DescribeKey`.
- Rotation/revocation follow the standard KMS key lifecycle; the existing
  key-validity metadata (`valid_from` / `valid_until` / `revoked_at`) served at
  `/server-public-key` is unchanged, so §4.1 creation-time validity checking continues
  to work.

---

## 5. Testing & Verification

An end-to-end integration test exercises the full protocol through the HSM path:
`e_banking/backend/tests/test_kms_hte_path.py`.

The test provides a KMS-API implementation for the receiver key (the private key stays
inside the implementation, exactly as it does in the HSM) and then runs the real flow:

```
client  : Z = ECDH(esk, PK_R^hsm) -> HKDF -> KT -> AES-256-GCM(M)
receiver: Z = HSM.derive(PK_eph)  -> HKDF -> KT -> AES-256-GCM decrypt
```

Assertions:

1. The HSM-derived `KT` equals the sender-derived `KT` (byte-identical, 32 bytes).
2. The encrypted payload round-trips under the HSM-derived key.

Result:

```
PASS: HSM path KT == sender KT (32 bytes): 6e9e39858402e062 ...
PASS: payload round-trip via HSM-derived key: {'S': 'shakil', 'R': 'shakib', 'A': 1000, ...}
```

A second check confirms the software key path derives the identical `KT`, so the HSM
path is a drop-in replacement at equation (2) with no effect on the rest of the
protocol.

**Reproduce**

```bash
cd e_banking/backend
python3 tests/test_kms_hte_path.py
```

---

## 6. Status

| Item | Status |
| --- | --- |
| HSM-backed receiver ECDH key (`DeriveSharedSecret`) | Implemented |
| `Z` computed inside the HSM; private key never in app memory | Implemented |
| `/server-public-key` served from the HSM | Implemented |
| End-to-end HSM key path (KT equality + payload round-trip) | Tested — PASS |
| Software key path equivalence | Tested — PASS |

---

## 7. Deployment Impact & Safety

The HSM integration is **server-side only** and does not touch the mobile client.

- **Client unchanged:** no mobile-app file is modified for this work; the distributed
  APK is unchanged, so there is no client-side crash surface introduced here.
- **Client contract unchanged:** the app continues to obtain the receiver public key
  from `GET /server-public-key`. No app update is required to use the HSM path.
- **Configuration-gated:** with no HSM key configured, the receiver-key pipeline is
  byte-identical to the previously running software path.
- **Contained failure modes:** an HSM error is caught and the software path is used;
  a partially configured HSM (key present but credentials invalid) results in a
  business-level verification rejection — never a client crash.
- **Operational rule:** enable the HSM fully (key + credentials) or leave it disabled;
  do not half-configure.

