"use client";

interface NotebookLayoutProps {
  leftPanel?: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel?: React.ReactNode;
}

export default function NotebookLayout({ centerPanel }: NotebookLayoutProps) {
  return (
    <div className="relative flex h-[calc(100dvh-4rem)] overflow-hidden bg-brand-black md:h-dvh">
      <div className="flex min-w-0 flex-1 flex-col">
        {centerPanel}
      </div>
    </div>
  );
}
