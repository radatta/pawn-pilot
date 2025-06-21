interface Props {
  board: React.ReactNode;
  sidebar: React.ReactNode;
}

export function TwoPaneLayout({ board, sidebar }: Props) {
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/30">
        <div className="w-full max-w-2xl">{board}</div>
      </div>
      <div className="w-96 border-l bg-card/30 backdrop-blur-sm p-6 space-y-6 overflow-y-auto">
        {sidebar}
      </div>
    </div>
  );
}
