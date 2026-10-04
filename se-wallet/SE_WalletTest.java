import java.util.ArrayList;
import java.util.List;

/**
 * SE_WalletTest — executes the Secure-Element wallet reference model against the paper's
 * §IV-A scenarios and prints a result table (mirrors Table V of the paper). Runs on the
 * JVM with no hardware / no external dependencies.
 *
 * Run:  javac -d out se-wallet/*.java && java -cp out SE_WalletTest
 */
public final class SE_WalletTest {

    private static int passed = 0;
    private static int failed = 0;
    private static final List<String> rows = new ArrayList<>();

    private static void check(String test, boolean ok, String detail) {
        if (ok) passed++; else failed++;
        rows.add(String.format("  %-56s %-6s %s", test, ok ? "PASS" : "FAIL", detail));
    }

    private static <T extends Throwable> void expectReject(String test, Runnable action, Class<T> type) {
        try {
            action.run();
            check(test, false, "expected " + type.getSimpleName() + ", no error thrown");
        } catch (Throwable t) {
            check(test, type.isInstance(t), t.getClass().getSimpleName() + ": " + t.getMessage());
        }
    }

    public static void main(String[] args) {
        System.out.println("=== Secure Element wallet reference model — offline settlement scenarios ===\n");

        // --- Load / reservation ---
        SecureElementWallet alice = new SecureElementWallet("SE-ALICE", 5000, 500, "alice-se-secret");
        check("load reserved value (Eq. 11)", alice.load(2000) == 2000, "balance=" + alice.balance());
        expectReject("load beyond holding cap H_max", () -> {
            SecureElementWallet w = new SecureElementWallet("SE-X", 1000, 500, "s");
            w.load(800); w.load(800);
        }, RuntimeException.class);

        // --- Offline payment within limits (immediate finality at F) ---
        SecureElementWallet bob = new SecureElementWallet("SE-BOB", 5000, 500, "bob-se-secret");
        bob.load(500);
        SecureElementWallet.Receipt r = alice.debit("ALICE", "BOB", 300);
        check("payer atomic debit at F", alice.balance() == 1700 && alice.counter() == 1,
                "bal=1700 counter=1");
        bob.credit("BOB", 300, r);
        check("payee atomic credit at F (final)", bob.balance() == 800 && bob.counter() == 1,
                "bal=800 counter=1");

        // --- Limits ---
        expectReject("debit above per-txn limit a_max", () -> alice.debit("ALICE", "BOB", 600), RuntimeException.class);
        expectReject("debit above wallet balance", () -> {
            SecureElementWallet poor = new SecureElementWallet("SE-POOR", 5000, 500, "s");
            poor.load(100);
            poor.debit("POOR", "ALICE", 300); // 300 <= a_max but > balance
        }, RuntimeException.class);

        // --- Receipt integrity ---
        expectReject("tampered receipt rejected", () -> {
            SecureElementWallet.Receipt bad = alice.debit("ALICE", "BOB", 100);
            SecureElementWallet.Receipt forged = new SecureElementWallet.Receipt(
                    bad.walletId, bad.payerId, bad.payeeId, 999, bad.counter, bad.sig);
            bob.credit("BOB", 999, forged);
        }, RuntimeException.class);

        // --- Rollback / clone detection ---
        SecureElementWallet clone = new SecureElementWallet("SE-ALICE", 5000, 500, "alice-se-secret");
        clone.load(1700);                       // restored from an old backup
        clone.detectRollback(1);                // main wallet had counter=1
        boolean rolled = clone.detectRollback(0); // clone presents counter 0 (< lastSeen 1)
        check("clone / rollback detected by counter", rolled, "counter 0 < lastSeen 1");

        // --- Results ---
        System.out.println(String.format("  %-56s %-6s %s", "Test", "Result", "Detail"));
        System.out.println("  " + "-".repeat(110));
        rows.forEach(System.out::println);
        System.out.println("  " + "-".repeat(110));
        System.out.println("  passed=" + passed + " failed=" + failed + "  => " + (failed == 0 ? "ALL PASS" : "FAILURES"));
    }
}
