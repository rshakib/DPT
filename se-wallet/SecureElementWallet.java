import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * SecureElementWallet — a dependency-free reference model of the Secure-Element (SE)
 * wallet applet described in the paper (§IV-A). It models the *behaviour* a real SE
 * applet provides: an atomic, counter-guarded value store with a per-transfer
 * monotonic counter and a hardware-signed settlement record.
 *
 * A real deployment runs the equivalent applet inside a GlobalPlatform Secure Element
 * (eSE / SIM) reached via the Android Open Mobile API. This model lets the protocol
 * logic be executed and tested WITHOUT provisioning rights, and is the exact logic that
 * would be moved into the SE applet.
 *
 * Invariant (the reason an SE is used): every operation is all-or-nothing, the counter
 * is monotonic, and the balance can never go negative or exceed the holding cap — even
 * across "reinstalls" (the SE state is external to the app).
 */
public final class SecureElementWallet {

    /** A settlement record signed by the paying SE (models VTR / σ_W). */
    public static final class Receipt {
        public final String walletId;
        public final String payerId;
        public final String payeeId;
        public final long amount;
        public final long counter;
        public final String sig;

        Receipt(String walletId, String payerId, String payeeId, long amount, long counter, String sig) {
            this.walletId = walletId;
            this.payerId = payerId;
            this.payeeId = payeeId;
            this.amount = amount;
            this.counter = counter;
            this.sig = sig;
        }

        @Override public String toString() {
            return "Receipt{" + payerId + "->" + payeeId + " amount=" + amount
                    + " counter=" + counter + " sig=" + sig.substring(0, 12) + "…}";
        }
    }

    private static final class Rejected extends RuntimeException {
        Rejected(String m) { super(m); }
    }

    private final String walletId;
    private final long maxHolding;   // H_max  — max value the wallet may hold
    private final long maxTxn;       // a_max  — max value per offline transaction

    private long balance;            // balW
    private long counter;            // cW (monotonic)
    private int loads;               // number of loads
    private long lastSeenCounter;    // highest counter seen by the bank (rollback detection)

    public SecureElementWallet(String walletId, long maxHolding, long maxTxn, String seSecretIgnored) {
        this.walletId = walletId;
        this.maxHolding = maxHolding;
        this.maxTxn = maxTxn;
    }

    /** Bank LOAD (online reservation, Eq. 11): credit reserved value into the wallet. */
    public synchronized long load(long amount) {
        if (amount <= 0) throw new Rejected("load amount must be > 0");
        if (balance + amount > maxHolding) throw new Rejected("holding cap H_max exceeded");
        balance += amount;
        loads++;
        return balance;
    }

    /** Atomic DEBIT by the payer (point F on the payer side). */
    public synchronized Receipt debit(String payerId, String payeeId, long amount) {
        if (amount <= 0) throw new Rejected("amount must be > 0");
        if (amount > maxTxn) throw new Rejected("amount exceeds per-transaction limit a_max");
        if (amount > balance) throw new Rejected("insufficient wallet balance");
        // all-or-nothing from here:
        balance -= amount;
        counter++;
        String sig = sign(walletId + "|" + payerId + "|" + payeeId + "|" + amount + "|" + counter);
        return new Receipt(walletId, payerId, payeeId, amount, counter, sig);
    }

    /** Atomic CREDIT by the payee (point F on the payee side); verifies the payer's receipt. */
    public synchronized long credit(String payeeId, long amount, Receipt r) {
        if (r == null) throw new Rejected("missing receipt");
        if (r.amount != amount) throw new Rejected("receipt amount mismatch");
        if (!r.payeeId.equals(payeeId)) throw new Rejected("receipt payee mismatch");
        if (!r.sig.equals(sign(r.walletId + "|" + r.payerId + "|" + r.payeeId + "|" + r.amount + "|" + r.counter))) {
            throw new Rejected("bad receipt signature");
        }
        if (balance + amount > maxHolding) throw new Rejected("holding cap H_max exceeded");
        balance += amount;
        counter++;
        return balance;
    }

    public synchronized long balance() { return balance; }
    public synchronized long counter() { return counter; }
    public synchronized int loads() { return loads; }

    /**
     * Rollback detection: a real SE cannot be rolled back, so seeing a counter below the
     * last observed value means a cloned/restored device. Models the paper's "clones or
     * rollbacks yield two SE-signed records with the same (W,c)" detection.
     */
    public synchronized boolean detectRollback(long presentedCounter) {
        boolean rolledBack = presentedCounter < lastSeenCounter;
        if (presentedCounter > lastSeenCounter) lastSeenCounter = presentedCounter;
        return rolledBack;
    }

    private String sign(String message) {
        // Demo stand-in for the SE's ECDSA signature over the settlement record: a
        // deterministic digest anyone can recompute (a real SE signs with its
        // non-exportable key; the payee verifies against the payer's enrolled public key).
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(message.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest()) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
