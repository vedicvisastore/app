import "./ornament.css";

/** Quiet, non-interactive linework shared by storefront section boundaries. */
export function Ornament({ kind, className = "" }: { kind: "lotus" | "feather" | "diya"; className?: string }) {
  return (
    <span className={`store-ornament store-ornament-${kind} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {kind === "lotus" && <>
          <path d="M50 72C32 59 34 40 50 22C66 40 68 59 50 72Z" />
          <path d="M50 72C26 72 17 55 18 38C37 39 49 51 50 72ZM50 72C74 72 83 55 82 38C63 39 51 51 50 72Z" />
          <path d="M50 72C30 83 12 73 6 57C21 54 37 59 50 72ZM50 72C70 83 88 73 94 57C79 54 63 59 50 72Z" />
          <path d="M30 85H70" /><circle cx="50" cy="12" r="2" fill="currentColor" stroke="none" />
        </>}
        {kind === "feather" && <>
          <path d="M24 94C32 70 49 51 65 27M36 71C12 48 29 18 66 8C90 34 88 61 60 72C51 76 44 75 36 71Z" />
          <path d="M40 61C25 44 38 23 64 17C82 37 78 56 59 64C52 67 45 66 40 61Z" />
          <path d="M48 53C41 44 46 32 61 27C71 39 68 50 59 55C54 57 51 56 48 53Z" />
          <path d="M33 78L25 62M40 66L59 77M28 87L22 77" />
          <ellipse cx="57" cy="43" rx="4" ry="6" transform="rotate(25 57 43)" fill="currentColor" stroke="none" />
        </>}
        {kind === "diya" && <>
          <path d="M50 49C35 39 45 27 52 16C51 29 65 38 50 49Z" />
          <path d="M17 57H83C77 76 64 82 50 82C36 82 23 76 17 57Z" />
          <path d="M24 64C40 70 60 70 76 64M35 88H65M50 49V57M23 27L28 33M77 27L72 33M10 42L18 45M90 42L82 45" />
        </>}
      </svg>
    </span>
  );
}

export function OrnamentDivider({ kind, className = "" }: { kind: "lotus" | "diya"; className?: string }) {
  return <div className={`store-ornament-divider ${className}`} aria-hidden="true"><Ornament kind={kind} /></div>;
}
