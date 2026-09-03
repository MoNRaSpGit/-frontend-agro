interface AgroDeleteConfirmModalProps {
  pendingDelete:
    | {
        title: string;
        message: string;
        confirmLabel?: string;
        // "danger" (por defecto) es para acciones destructivas (eliminar);
        // "neutral" es para pedir confirmacion de algo no destructivo (ej:
        // traslado entre establecimientos) sin pintarlo de rojo como si
        // fuera a borrar algo.
        variant?: "danger" | "neutral";
      }
    | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AgroDeleteConfirmModal({ pendingDelete, onCancel, onConfirm }: AgroDeleteConfirmModalProps) {
  if (!pendingDelete) {
    return null;
  }

  const variant = pendingDelete.variant ?? "danger";

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
          <button
            type="button"
            className={variant === "danger" ? "ghost-button danger" : "primary-button"}
            onClick={onConfirm}
          >
            {pendingDelete.confirmLabel ?? "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
