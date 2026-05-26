import { deriveMovementDirection } from "./agro.domain";
import { movementKindLabels, speciesLabels } from "./agro.demo.data";
import { formatMoney, formatNumber } from "./agro.home.shared";
import { AccountingEntry, AnimalMovementRecord } from "./agro.types";
import { expenseConceptLabels, incomeConceptLabels } from "./agro.home.shared";

interface AgroOverviewSectionProps {
  establishmentSummary:
    | {
        name: string;
        location: string;
        hectares: number;
      }
    | undefined;
  latestAccountingEntries: AccountingEntry[];
  latestAnimalMovements: AnimalMovementRecord[];
}

export function AgroOverviewSection({
  establishmentSummary,
  latestAccountingEntries,
  latestAnimalMovements
}: AgroOverviewSectionProps) {
  const establishmentSummaryParts = [
    establishmentSummary?.name ?? "-",
    establishmentSummary?.location?.trim() ? establishmentSummary.location : null,
    `${formatNumber(establishmentSummary?.hectares ?? 0)} ha`
  ].filter(Boolean);

  function getMovementLabel(movement: AnimalMovementRecord) {
    if (movement.kind === "transfer_in" || movement.kind === "transfer_out") {
      return "Traslado";
    }

    return movementKindLabels[movement.kind];
  }

  function getMovementDirection(movement: AnimalMovementRecord) {
    return movement.kind === "adjustment" && movement.notes.startsWith("Carga inicial:")
      ? "entry"
      : deriveMovementDirection(movement.kind);
  }

  return (
    <section className="content-grid">
      <article className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Direccion del producto</h2>
            <p>{establishmentSummaryParts.join(" | ")}</p>
          </div>
        </div>
        <div className="list-stack">
          <div className="list-row">
            <div>
              <strong>Animales</strong>
              <span>Entradas y salidas con datos comerciales y relacion con la parte economica.</span>
            </div>
          </div>
          <div className="list-row">
            <div>
              <strong>Contabilidad</strong>
              <span>Los ingresos van en USD y los gastos se separan en UYU y USD por establecimiento.</span>
            </div>
          </div>
          <div className="list-row">
            <div>
              <strong>Resumen</strong>
              <span>Se juntan existencias, movimientos y lluvias por establecimiento para control y revision.</span>
            </div>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Ultimos movimientos de animales</h2>
          </div>
        </div>
        <div className="list-stack">
          {latestAnimalMovements.map((movement) => (
            <div key={movement.id} className="list-row">
              <div>
                <strong>{getMovementLabel(movement)}</strong>
                <span>
                  {movement.date} | {speciesLabels[movement.species]}
                  {movement.kind === "death" && movement.species === "vacunos" && movement.earTag
                    ? ` | Caravana ${movement.earTag}`
                    : ""}
                </span>
              </div>
              <strong className={getMovementDirection(movement) === "entry" ? "tone-positive" : "tone-negative"}>
                {getMovementDirection(movement) === "entry" ? "+" : "-"}
                {movement.quantity}
              </strong>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Ultimos movimientos de caja</h2>
          </div>
        </div>
        <div className="list-stack">
          {latestAccountingEntries.map((entry) => (
            <div key={entry.id} className="list-row">
              <div>
                <strong>
                  {entry.type === "income"
                    ? incomeConceptLabels[entry.concept as keyof typeof incomeConceptLabels]
                    : expenseConceptLabels[entry.concept as keyof typeof expenseConceptLabels]}
                </strong>
                <span>
                  {entry.date} | {entry.currency}
                </span>
              </div>
              <strong className={entry.type === "income" ? "tone-positive" : "tone-negative"}>
                {entry.type === "income" ? "+" : "-"}
                {formatMoney(entry.netAmount, entry.currency)}
              </strong>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
