interface AgroDeleteConfirmModalProps {
  pendingDelete:
    | {
        title: string;
        message: string;
      }
    | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AgroDeleteConfirmModal({ pendingDelete, onCancel, onConfirm }: AgroDeleteConfirmModalProps) {
  if (!pendingDelete) {
    return null;
  }

  return (
    <div className="confirm-modal-backdrop" role="presentation">
      <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
        <div className="confirm-modal-copy">
          <strong id="confirm-delete-title">{pendingDelete.title}</strong>
          <span>{pendingDelete.message}</span>
        </div>
        <div className="action-row">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="ghost-button danger" onClick={onConfirm}>
            Si, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
