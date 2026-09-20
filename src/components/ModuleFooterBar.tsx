import type { ReactNode } from "react";

export default function ModuleFooterBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-page">
      <div className="mx-auto flex h-20 max-w-3xl items-center gap-3 px-4 sm:px-6">
        {children}
      </div>
    </div>
  );
}
