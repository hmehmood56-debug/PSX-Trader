import styles from "./PerchWordmark.module.css";

type PerchWordmarkProps = {
  compact?: boolean;
  className?: string;
};

export function PerchWordmark({ compact = false, className = "" }: PerchWordmarkProps) {
  return (
    <span className={`${styles.wordmark} ${compact ? styles.compact : ""} ${className}`.trim()}>
      <span className={styles.textBlock}>
        <span className={styles.perch}>Perch</span>
        <span className={styles.capital}>Capital</span>
      </span>
    </span>
  );
}
