import styles from "./PerchWordmark.module.css";

type PerchWordmarkProps = {
  compact?: boolean;
  className?: string;
  tone?: "brand" | "ink" | "navbar";
};

export function PerchWordmark({ compact = false, className = "", tone = "brand" }: PerchWordmarkProps) {
  return (
    <span
      className={`${styles.wordmark} ${compact ? styles.compact : ""} ${
        tone === "ink" ? styles.ink : tone === "navbar" ? styles.navbar : ""
      } ${className}`.trim()}
    >
      <span className={styles.textBlock}>
        <span className={styles.perch}>Perch</span>
        <span className={styles.capital}>Capital</span>
      </span>
    </span>
  );
}
