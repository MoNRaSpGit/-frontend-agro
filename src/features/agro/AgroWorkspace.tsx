import { AgroPersistenceMode } from "./agro.client";
import { AgroHomePage } from "./AgroHomePage";

interface AgroWorkspaceProps {
  persistenceMode: AgroPersistenceMode;
}

export function AgroWorkspace({ persistenceMode }: AgroWorkspaceProps) {
  return <AgroHomePage persistenceMode={persistenceMode} />;
}
