export default function Logo({
  size = 38,
  /** Optional "Pro Gaming Services" strapline. Off by default — the brand
   *  mark reads as just G2X.GG in the navbar and the footer. */
  tagline = false,
}: {
  size?: number;
  tagline?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative grid place-items-center rounded-xl"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(140deg,#a855f7,#6d28d9)",
          boxShadow: "0 6px 20px -6px rgba(139,61,255,.9)",
        }}
      >
        <span className="text-[19px] font-black text-white">G</span>
        <span className="absolute inset-0 rounded-xl ring-1 ring-white/25" />
      </div>
      <div className="leading-none">
        <div className="text-[17px] font-extrabold tracking-tight">G2X.GG</div>
        {tagline && <div className="mt-1 text-[10px] muted">Pro Gaming Services</div>}
      </div>
    </div>
  );
}
