"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useMemo, useState } from "react";
import { formatPKRWithSymbol } from "@/lib/format";
import { usePortfolio } from "@/hooks/usePortfolioState";
import { useRouter } from "next/navigation";

type Method = {
  id: "jazzcash" | "easypaisa" | "bank-transfer" | "card";
  label: string;
  detail: string;
};

const METHODS: Method[] = [
  { id: "jazzcash", label: "JazzCash", detail: "Instant wallet funding" },
  { id: "easypaisa", label: "EasyPaisa", detail: "Fast mobile transfer" },
  { id: "bank-transfer", label: "Bank Transfer", detail: "Secure account transfer" },
  { id: "card", label: "Debit / Credit Card", detail: "Card-based virtual funding" },
];

const QUICK_AMOUNTS = [5_000, 10_000, 25_000, 50_000];

const COLORS = {
  orange: "#C45000",
  orangeLight: "#FFF4EC",
  bg: "#FFFFFF",
  bgSecondary: "#F7F7F7",
  border: "#E8E8E8",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  success: "#007A4C",
} as const;

function parseAmount(value: string): number {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function relativeTimeLabel(timestamp: string): string {
  const deltaMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.max(1, Math.floor(deltaMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AccountPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    portfolio,
    accountActivity: activity,
    depositVirtualFunds,
    withdrawVirtualFunds,
  } = usePortfolio();
  const [depositMethod, setDepositMethod] = useState<Method["id"]>(METHODS[0].id);
  const [withdrawMethod, setWithdrawMethod] = useState<Method["id"]>("bank-transfer");
  const [depositAmountInput, setDepositAmountInput] = useState("");
  const [withdrawAmountInput, setWithdrawAmountInput] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const depositAmount = parseAmount(depositAmountInput);
  const withdrawAmount = parseAmount(withdrawAmountInput);
  const depositMethodMeta = METHODS.find((m) => m.id === depositMethod);
  const withdrawMethodMeta = METHODS.find((m) => m.id === withdrawMethod);
  const projectedAfterDeposit = portfolio.cash + (depositAmount > 0 ? depositAmount : 0);
  const projectedAfterWithdrawal = portfolio.cash - (withdrawAmount > 0 ? withdrawAmount : 0);

  const buyingPower = portfolio.cash;
  const availableBalance = portfolio.cash;

  const canDeposit = useMemo(
    () => Boolean(depositMethodMeta) && depositAmount > 0,
    [depositMethodMeta, depositAmount]
  );
  const canWithdraw = useMemo(
    () => Boolean(withdrawMethodMeta) && withdrawAmount > 0,
    [withdrawMethodMeta, withdrawAmount]
  );

  async function handleDeposit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDepositError(null);
    setDepositSuccess(null);

    if (!depositMethodMeta) {
      setDepositError("Please select a deposit method.");
      return;
    }
    if (depositAmount <= 0) {
      setDepositError("Please enter a valid deposit amount in PKR.");
      return;
    }

    const result = await depositVirtualFunds(depositAmount, depositMethodMeta.label);
    if (!result.ok) {
      setDepositError(result.error);
      return;
    }

    setDepositSuccess(
      `${formatPKRWithSymbol(depositAmount)} deposited via ${
        depositMethodMeta.label
      }. Updated cash balance: ${formatPKRWithSymbol(result.newCashBalance)}.`
    );
    setDepositAmountInput("");
  }

  async function handleWithdraw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    if (!withdrawMethodMeta) {
      setWithdrawError("Please select a withdrawal method.");
      return;
    }
    if (withdrawAmount <= 0) {
      setWithdrawError("Please enter a valid withdrawal amount in PKR.");
      return;
    }

    const result = await withdrawVirtualFunds(withdrawAmount, withdrawMethodMeta.label);
    if (!result.ok) {
      setWithdrawError(result.error);
      return;
    }

    setWithdrawSuccess(
      `${formatPKRWithSymbol(withdrawAmount)} withdrawn to ${
        withdrawMethodMeta.label
      }. Remaining cash balance: ${formatPKRWithSymbol(result.newCashBalance)}.`
    );
    setWithdrawAmountInput("");
  }

  return (
    <div style={{ background: COLORS.bgSecondary, minHeight: "calc(100vh - 56px)" }}>
      <div
        className="perch-shell perch-shell-account"
        style={{ paddingTop: "clamp(20px, 4vw, 32px)", paddingBottom: "clamp(36px, 8vw, 48px)" }}
      >
        <section
          style={{
            background: COLORS.bg,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 14,
            padding: "clamp(18px, 4vw, 24px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(24px, 5vw, 30px)",
              fontWeight: 700,
              color: COLORS.text,
            }}
          >
            Account
          </h1>
          <p style={{ margin: "10px 0 0", color: COLORS.muted, fontSize: 15 }}>
            Manage your virtual brokerage wallet with local, paper-trading-only funding
            and withdrawal flows tailored for Pakistan investors.
          </p>

          {user && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, color: COLORS.muted }}>
                Signed in as{" "}
                <strong style={{ color: COLORS.text }}>
                  {(user.user_metadata?.username as string | undefined) ?? user.email ?? "Perch user"}
                </strong>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.refresh();
                }}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.bg,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: COLORS.text,
                }}
              >
                Sign out
              </button>
            </div>
          )}

          <div className="perch-account-metrics" style={{ marginTop: 20 }}>
            <MetricCard label="Current Cash Balance" value={formatPKRWithSymbol(portfolio.cash)} />
            <MetricCard label="Buying Power" value={formatPKRWithSymbol(buyingPower)} />
            <MetricCard label="Available Balance" value={formatPKRWithSymbol(availableBalance)} />
          </div>
        </section>

        <div className="perch-account-columns" style={{ marginTop: 16 }}>
          <section style={panelStyle()}>
            <SectionHeader
              title="Deposit Funds"
              subtitle="Add virtual funds using familiar Pakistan-first payment rails."
            />
            <form onSubmit={handleDeposit} style={{ marginTop: 18 }}>
              <MethodGrid
                methods={METHODS}
                selected={depositMethod}
                onSelect={setDepositMethod}
              />
              <AmountInput
                label="Deposit Amount (PKR)"
                id="deposit-amount"
                value={depositAmountInput}
                onChange={setDepositAmountInput}
              />
              <QuickChips onPick={(v) => setDepositAmountInput(String(v))} />
              <SummaryBox
                title="Deposit Summary"
                rows={[
                  ["Method", depositMethodMeta?.label ?? "Not selected"],
                  [
                    "Amount",
                    depositAmount > 0 ? formatPKRWithSymbol(depositAmount) : "Rs. 0",
                  ],
                  ["Updated Balance", formatPKRWithSymbol(projectedAfterDeposit)],
                ]}
              />
              {depositError && <ErrorText message={depositError} />}
              {depositSuccess && <SuccessText message={depositSuccess} />}
              <SubmitButton label="Confirm Deposit" disabled={!canDeposit} />
            </form>
          </section>

          <section style={panelStyle()}>
            <SectionHeader
              title="Withdraw Funds"
              subtitle="Simulate cash withdrawals while keeping account limits realistic."
            />
            <form onSubmit={handleWithdraw} style={{ marginTop: 18 }}>
              <MethodGrid
                methods={METHODS}
                selected={withdrawMethod}
                onSelect={setWithdrawMethod}
              />
              <AmountInput
                label="Withdraw Amount (PKR)"
                id="withdraw-amount"
                value={withdrawAmountInput}
                onChange={setWithdrawAmountInput}
              />
              <QuickChips onPick={(v) => setWithdrawAmountInput(String(v))} />
              <SummaryBox
                title="Withdrawal Summary"
                rows={[
                  ["Method", withdrawMethodMeta?.label ?? "Not selected"],
                  [
                    "Amount",
                    withdrawAmount > 0 ? formatPKRWithSymbol(withdrawAmount) : "Rs. 0",
                  ],
                  ["Balance After Withdrawal", formatPKRWithSymbol(projectedAfterWithdrawal)],
                ]}
              />
              {withdrawError && <ErrorText message={withdrawError} />}
              {withdrawSuccess && <SuccessText message={withdrawSuccess} />}
              <SubmitButton label="Confirm Withdrawal" disabled={!canWithdraw} />
            </form>
          </section>
        </div>

        <section style={{ ...panelStyle(), marginTop: 16 }}>
          <SectionHeader
            title="Recent Activity"
            subtitle="Latest virtual account movements for your simulated wallet."
          />
          <div style={{ marginTop: 14 }}>
            {activity.length === 0 ? (
              <div style={{ color: COLORS.muted, fontSize: 14 }}>
                No account activity yet. Your deposits and withdrawals will appear here.
              </div>
            ) : (
              activity.slice(0, 8).map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 0",
                    borderTop: idx === 0 ? "none" : `1px solid ${COLORS.border}`,
                  }}
                >
                  <div>
                    <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>
                      {item.kind === "DEPOSIT" ? "Deposit via" : "Withdrawal to"} {item.method}
                    </div>
                    <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>
                      {relativeTimeLabel(item.timestamp)}
                    </div>
                  </div>
                  <div
                    style={{
                      color: item.kind === "DEPOSIT" ? COLORS.success : COLORS.text,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: 14,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.kind === "DEPOSIT" ? "+" : "-"}
                    {formatPKRWithSymbol(item.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function panelStyle(): React.CSSProperties {
  return {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: 22,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  };
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h2 style={{ margin: 0, fontSize: "clamp(19px, 4vw, 22px)", color: COLORS.text }}>{title}</h2>
      <p style={{ margin: "8px 0 0", color: COLORS.muted, fontSize: 14 }}>{subtitle}</p>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: COLORS.muted,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: "clamp(20px, 5vw, 25px)",
          fontWeight: 700,
          color: COLORS.text,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MethodGrid({
  methods,
  selected,
  onSelect,
}: {
  methods: Method[];
  selected: Method["id"];
  onSelect: (methodId: Method["id"]) => void;
}) {
  return (
    <div className="perch-account-method-grid">
      {methods.map((method) => {
        const isSelected = method.id === selected;
        return (
          <button
            key={method.id}
            type="button"
            onClick={() => onSelect(method.id)}
            style={{
              textAlign: "left",
              borderRadius: 12,
              border: `1px solid ${isSelected ? COLORS.orange : COLORS.border}`,
              background: isSelected ? COLORS.orangeLight : COLORS.bg,
              padding: "14px 12px",
              minHeight: 48,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div style={{ fontWeight: 700, color: isSelected ? COLORS.orange : COLORS.text, fontSize: 14 }}>
              {method.label}
            </div>
            <div style={{ marginTop: 4, color: COLORS.muted, fontSize: 12 }}>{method.detail}</div>
          </button>
        );
      })}
    </div>
  );
}

function AmountInput({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: COLORS.muted,
        }}
      >
        {label}
      </label>
      <div
        style={{
          marginTop: 10,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          background: COLORS.bg,
        }}
      >
        <span style={{ color: COLORS.muted, fontWeight: 600, marginRight: 8 }}>Rs.</span>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="Enter amount"
          style={{
            width: "100%",
            minHeight: 52,
            border: "none",
            outline: "none",
            fontSize: "clamp(22px, 5vw, 26px)",
            fontWeight: 700,
            color: COLORS.text,
            fontVariantNumeric: "tabular-nums",
          }}
        />
      </div>
    </div>
  );
}

function QuickChips({ onPick }: { onPick: (amount: number) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {QUICK_AMOUNTS.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onPick(amount)}
          style={{
            borderRadius: 999,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            padding: "10px 14px",
            minHeight: 40,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {formatPKRWithSymbol(amount)}
        </button>
      ))}
    </div>
  );
}

function SummaryBox({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div
      style={{
        marginTop: 14,
        background: COLORS.bgSecondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: COLORS.muted,
        }}
      >
        {title}
      </div>
      {rows.map(([label, value]) => (
        <div
          key={label}
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span style={{ color: COLORS.muted, fontSize: 13 }}>{label}</span>
          <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 13 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return <div style={{ marginTop: 10, color: "#B42318", fontSize: 14 }}>{message}</div>;
}

function SuccessText({ message }: { message: string }) {
  return <div style={{ marginTop: 10, color: COLORS.success, fontSize: 14 }}>{message}</div>;
}

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        marginTop: 14,
        width: "100%",
        minHeight: 50,
        border: "none",
        borderRadius: 10,
        background: disabled ? "#E8E8E8" : COLORS.orange,
        color: disabled ? "#9A9A9A" : "#FFFFFF",
        fontWeight: 700,
        fontSize: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
    </button>
  );
}
