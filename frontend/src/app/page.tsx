import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            💘 Find Love <span className={styles.accent}>Without</span> the
            Hassle
          </h1>
          <p className={styles.subtitle}>
            Skip the weird messages. Stop getting ghosted. Let your AI agent
            find your soulmate.
          </p>
          <Link href="/onboarding" className={styles.cta}>
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
