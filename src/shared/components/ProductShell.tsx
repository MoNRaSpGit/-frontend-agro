import { ReactNode } from "react";

export interface ProductShellNavItem {
  key: string;
  label: string;
  description: string;
  persistence: "local" | "backend_candidate" | "future";
}

interface ProductShellProps {
  title: string;
  subtitle: string;
  badge: string;
  navItems: ProductShellNavItem[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onTitleClick?: () => void;
  children: ReactNode;
}

export function ProductShell({
  title,
  subtitle,
  badge,
  navItems,
  activeKey,
  onSelect,
  onTitleClick,
  children
}: ProductShellProps) {
  return (
    <>
      <section className="product-shell-bar">
        <div className="product-shell-copy">
          {badge ? <span className="eyebrow">{badge}</span> : null}
          <button type="button" className="product-shell-home" onClick={onTitleClick}>
            <div className="product-shell-title-group">
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </div>
          </button>
        </div>
        <div className="product-shell-nav" role="tablist" aria-label="Areas del producto">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeKey === item.key ? "shell-nav-pill active" : "shell-nav-pill"}
              onClick={() => onSelect(item.key)}
            >
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>
      </section>
      {children}
    </>
  );
}
