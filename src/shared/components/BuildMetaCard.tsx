import { buildMeta } from "../config/build";

export function BuildMetaCard() {
  return (
    <article className="build-meta-card">
      <span>{buildMeta.productName}</span>
      <small>{buildMeta.mode}</small>
    </article>
  );
}
