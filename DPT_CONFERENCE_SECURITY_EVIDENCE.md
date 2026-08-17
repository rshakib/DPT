# DPT Mobile Payment Application — Security Attack Evaluation Evidence Log

> **Document Class:** Conference & Academic Evidence Log  
> **Target System:** DPT Mobile Application (`com.riajulshakib.dptapp`) & Backend (`https://e-pay-fydp.onrender.com`)  
> **Assessment Date:** August 17, 2026  
> **Auditor Identity:** Authorized Defensive Security Assessor  

---

## 1. Experimental Setup & Authorization Context

All tests documented in this evidence log were executed against authorized test endpoints and dedicated test accounts (`testuser_audit`, `shakil`). No real monetary assets or production user data were involved.

- **Test Account Username**: `testuser_audit`
- **Test Account ID**: `6a0b0a9f-19d0-42a4-99d6-184e58c3d758`
- **Initial Test Balance**: `5000.0 BDT`
- **REST API Base URL**: `https://e-pay-fydp.onrender.com`

---

## 2. Raw Evidence Records

### SEC-02: JWT Manipulation / Forgery Evidence

#### Test 2.1: Invalid Bearer Token Signature Submission
```http
POST /transfer HTTP/2
Host: e-pay-fydp.onrender.com
Authorization: Bearer invalid_jwt_token_test
Content-Type: application/json

{"username":"testuser_audit","receiver":"shakil","amount":10}
```

```http
HTTP/2 401 Unauthorized
Date: Mon, 17 Aug 2026 17:18:11 GMT
Content-Type: application/json

{"message":"Unauthorized","status":"error"}
```

---

### SEC-04: Transaction Amount Tampering Evidence

#### Test 4.1: Negative Amount Injection
```http
POST /transfer HTTP/2
Host: e-pay-fydp.onrender.com
Authorization: Bearer 19719a58-4811-4a42-83dc-748a734e38c2
Content-Type: application/json

{"username":"testuser_audit","receiver":"testuser_audit","amount":-500}
```

```http
HTTP/2 400 Bad Request
Date: Mon, 17 Aug 2026 17:21:13 GMT
Content-Type: application/json

{"message":"Amount must be greater than zero","status":"error"}
```

---

### SEC-06: Double-Spending / Race Condition Evidence

#### Test 6.1: Concurrent Transfer Requests Exceeding Account Balance
```bash
# Executed two concurrent HTTP POST requests submitting 4000.0 BDT transfers from balance 5000.0 BDT
(curl -i -X POST https://e-pay-fydp.onrender.com/transfer -H "Authorization: Bearer 19719a58-4811-4a42-83dc-748a734e38c2" -d '{"username":"testuser_audit","receiver":"shakil","amount":4000}' & curl -i -X POST https://e-pay-fydp.onrender.com/transfer -H "Authorization: Bearer 19719a58-4811-4a42-83dc-748a734e38c2" -d '{"username":"testuser_audit","receiver":"shakil","amount":4000}' & wait)
```

```http
# Response 1:
HTTP/2 200 OK
{"message":"Transfer of 4000.0 to shakil successful","new_balance":1000.0,"status":"success"}

# Response 2:
HTTP/2 400 Bad Request
{"message":"Insufficient balance","status":"futile"}
```

---

### SEC-10: SQL Injection Evidence

#### Test 10.1: Amount String SQL Injection Injection
```http
POST /transfer HTTP/2
Authorization: Bearer 19719a58-4811-4a42-83dc-748a734e38c2
Content-Type: application/json

{"username":"testuser_audit","receiver":"testuser_audit","amount":"100 OR 1=1"}
```

```http
HTTP/2 400 Bad Request
{"message":"Invalid amount","status":"error"}
```

#### Test 10.2: Login Username SQL Injection
```http
POST /login HTTP/2
Content-Type: application/json

{"username":"testuser_audit' OR '1'='1","password":"Password123!"}
```

```http
HTTP/2 400 Bad Request
{"message":"Missing username or password","status":"error"}
```

---

### SEC-11: Replay Attack Evidence

#### Test 11.1: Identical Sequential Payload Submission
```http
# Request 1 (Balance 1000.0 -> 900.0):
POST /transfer HTTP/2
Authorization: Bearer 19719a58-4811-4a42-83dc-748a734e38c2
{"username":"testuser_audit","receiver":"shakil","amount":100}

HTTP/2 200 OK -> {"message":"Transfer of 100.0 to shakil successful","new_balance":900.0}

# Request 2 (Identical Payload Replayed, Balance 900.0 -> 800.0):
POST /transfer HTTP/2
Authorization: Bearer 19719a58-4811-4a42-83dc-748a734e38c2
{"username":"testuser_audit","receiver":"shakil","amount":100}

HTTP/2 200 OK -> {"message":"Transfer of 100.0 to shakil successful","new_balance":800.0}
```

---

## 3. Cryptographic Implementation Analysis (SEC-12 & SEC-13)

- **Hashing Algorithm**: SHA-256 (`Crypto.digestStringAsync`)
- **Salt Format**: `niropay_salt_v1_${cleanUsername}_${pin}`
- **Storage Target**: Hardware `Expo SecureStore` (Android Keystore / TEE)
- **Key Derivation**: Fixed static prefix salt combined with lowercased username handle.
