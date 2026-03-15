import { ReactNode, useEffect } from "react";
import { useSettingsStore } from "../../stores/settings-store";
import { useToastStore } from "../../stores/toast-store";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Toast } from "../../ui/components/Toast/Toast";
import "./AppLayout.css";

interface AppLayoutProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AppLayout({
  header,
  sidebar,
  children,
  footer,
}: AppLayoutProps) {
  const { theme } = useSettingsStore();
  const { AnnouncementRegion } = useAnnounce();
  const { toasts, removeToast } = useToastStore();

  // Apply theme on mount and change
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return (
    <div className="app-layout">
      {header && <header className="app-layout-header">{header}</header>}
      <div className="app-layout-body">
        {sidebar && <aside className="app-layout-sidebar">{sidebar}</aside>}
        <main className="app-layout-main">{children}</main>
      </div>
      {footer && <footer className="app-layout-footer">{footer}</footer>}
      <AnnouncementRegion />
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              variant={toast.variant}
              duration={toast.duration}
              action={toast.action}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
