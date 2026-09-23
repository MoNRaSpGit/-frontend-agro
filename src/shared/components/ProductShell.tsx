import { ReactNode, useEffect, useRef, useState } from "react";
import { Check, LogOut, Menu, UserRound } from "lucide-react";

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
  onSignOut?: () => void;
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
  onSignOut,
  children
}: ProductShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Boton chico (solo el avatar) para "Cerrar sesion" en PC -- pedido
  // explicito (22/09/2026): el boton ancho con el texto "Cerrar sesion" le
  // sacaba lugar a la barra de pestanas y empujaba las ultimas (ej
  // "Resumen") fuera de la vista. Mismo patron de popover que el menu de
  // arriba, pero separado (ese es el menu completo de mobile).
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const sessionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (!sessionMenuRef.current?.contains(event.target as Node)) {
        setIsSessionMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setIsSessionMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const activeItem = navItems.find((item) => item.key === activeKey);

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

        {onSignOut ? (
          <div className="product-shell-session-wrap" ref={sessionMenuRef}>
            <button
              type="button"
              className="product-shell-session-button"
              onClick={() => setIsSessionMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isSessionMenuOpen}
              aria-label="Menu de usuario"
            >
              <span className="product-shell-avatar">
                <UserRound size={18} strokeWidth={2.1} />
              </span>
            </button>

            {isSessionMenuOpen ? (
              <div className="product-shell-session-dropdown" role="menu" aria-label="Menu de usuario">
                <button
                  type="button"
                  className="product-shell-dropdown-item signout"
                  onClick={() => {
                    onSignOut();
                    setIsSessionMenuOpen(false);
                  }}
                >
                  <LogOut size={16} strokeWidth={2.2} />
                  <span>Cerrar sesion</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="product-shell-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className={menuOpen ? "product-shell-menu-button open" : "product-shell-menu-button"}
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Abrir menu del demo"
          >
            <span className="product-shell-menu-user">
              <span className="product-shell-avatar">
                <UserRound size={18} strokeWidth={2.1} />
              </span>
              <span className="product-shell-identity">
                <strong>Demo</strong>
                <small>{activeItem?.label ?? title}</small>
              </span>
            </span>
            <span className="product-shell-menu-icon">
              <Menu size={18} strokeWidth={2.1} />
            </span>
          </button>

          {menuOpen ? (
            <div className="product-shell-dropdown" role="menu" aria-label="Secciones del demo">
              <button
                type="button"
                className={activeKey === null ? "product-shell-dropdown-item active" : "product-shell-dropdown-item"}
                onClick={() => {
                  onTitleClick?.();
                  setMenuOpen(false);
                }}
              >
                <span>Pantalla principal</span>
                {activeKey === null ? <Check size={16} strokeWidth={2.4} /> : null}
              </button>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={activeKey === item.key ? "product-shell-dropdown-item active" : "product-shell-dropdown-item"}
                  onClick={() => {
                    onSelect(item.key);
                    setMenuOpen(false);
                  }}
                >
                  <span>{item.label}</span>
                  {activeKey === item.key ? <Check size={16} strokeWidth={2.4} /> : null}
                </button>
              ))}
              {onSignOut ? (
                <button
                  type="button"
                  className="product-shell-dropdown-item signout"
                  onClick={() => {
                    onSignOut();
                    setMenuOpen(false);
                  }}
                >
                  <span>Cerrar sesion</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      {children}
    </>
  );
}
