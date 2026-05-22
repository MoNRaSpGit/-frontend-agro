import { AgroPersistenceMode } from "./agro.client";
import { AgroHomePage } from "./AgroHomePage";

interface AgroWorkspaceProps {
  persistenceMode: AgroPersistenceMode;
  onSignOut: () => void;
}

export function AgroWorkspace({ persistenceMode, onSignOut }: AgroWorkspaceProps) {
  return <AgroHomePage persistenceMode={persistenceMode} onSignOut={onSignOut} />;
}
