"use client";
import * as si from "simple-icons";

type Simple = { path: string; hex: string; title: string };

const map: Record<string, Simple> = {
  netflix: si.siNetflix,
  spotify: si.siSpotify,
  discord: si.siDiscord,
  youtube: si.siYoutube,
  applemusic: si.siApplemusic,
  visa: si.siVisa,
  mastercard: si.siMastercard,
  paypal: si.siPaypal,
  googlepay: si.siGooglepay,
  applepay: si.siApplepay,
  steam: si.siSteam,
  playstation: si.siPlaystation,
  roblox: si.siRoblox,
  valorant: si.siValorant,
  leagueoflegends: si.siLeagueoflegends,
  pubg: si.siPubg,
  rockstargames: si.siRockstargames,
  telegram: si.siTelegram,
  instagram: si.siInstagram,
  x: si.siX,
  trustpilot: si.siTrustpilot,
  epicgames: si.siEpicgames,
  riotgames: si.siRiotgames,
  razorpay: si.siRazorpay,
  crunchyroll: si.siCrunchyroll,
  hbo: si.siHbo,
  google: si.siGoogle,
};

export const hasBrand = (n: string) => !!map[n];

export function BrandIcon({
  name,
  size = 28,
  color,
  className = "",
}: {
  name: keyof typeof map | string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const icon = map[name];
  if (!icon) return null;
  return (
    <svg
      role="img"
      aria-label={icon.title}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={color ?? `#${icon.hex}`}
    >
      <path d={icon.path} />
    </svg>
  );
}

/* Brands without a simple-icons entry — drawn/wordmarked locally */
export function XboxMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-label="Xbox Game Pass">
      <circle cx="12" cy="12" r="12" fill="#107C10" />
      <path
        fill="#fff"
        d="M12 5.6c1.2 0 2.3.3 3.2.9-1.1.5-2.2 1.4-3.2 2.4-1-1-2.1-1.9-3.2-2.4.9-.6 2-.9 3.2-.9zM7.3 7.5c1.2.5 2.7 1.7 4.7 3.9 2 2.2 3 3.7 3.4 4.7-1 .8-2.2 1.3-3.4 1.3s-2.5-.5-3.4-1.3c.4-1 1.4-2.5 3.4-4.7-2-2.2-3.5-3.4-4.7-3.9zm9.4 0c1 1 1.7 2.4 1.7 4.5 0 1.5-.4 2.9-1.1 4-.5-1.3-1.6-3-3.1-4.8 1.1-1.6 2-2.8 2.5-3.7zM6.3 7.5c.5.9 1.4 2.1 2.5 3.7-1.5 1.8-2.6 3.5-3.1 4.8-.7-1.1-1.1-2.5-1.1-4 0-2.1.7-3.5 1.7-4.5z"
      />
    </svg>
  );
}

export function PrimeMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center leading-none ${className}`}>
      <span className="text-[15px] font-bold tracking-tight text-[#00A8E1]">prime</span>
      <svg width="42" height="10" viewBox="0 0 42 10">
        <path
          d="M2 5 C12 11, 30 11, 40 4"
          stroke="#00A8E1"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M40 4 l-5 .2 3.6 2.6z" fill="#00A8E1" />
      </svg>
    </div>
  );
}

export function UpiMark({ h = 18 }: { h?: number }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height: h }}>
      <span className="text-[15px] font-extrabold italic text-[#097939]">UPI</span>
      <span className="mb-[3px] block h-3 w-[5px] -skew-x-12 bg-[#ED752E]" />
      <span className="mb-[3px] block h-3 w-[5px] -skew-x-12 bg-[#097939]" />
    </div>
  );
}

export function DisneyMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-md bg-[#0c1c4d] px-2 py-1"
      style={{ minWidth: size }}
    >
      <span className="text-[11px] font-bold italic tracking-tight text-white">
        Disney+
      </span>
    </div>
  );
}

/** Universal logo renderer: simple-icons key, custom mark, or an image path */
export function AnyLogo({
  logo,
  size = 32,
  className = "",
}: {
  logo: string;
  size?: number;
  className?: string;
}) {
  if (logo.startsWith("/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        className={`rounded-md object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  if (logo === "xbox") return <XboxMark size={size} />;
  if (logo === "prime") return <PrimeMark />;
  if (logo === "disneyplus") return <DisneyMark size={size} />;
  if (hasBrand(logo)) return <BrandIcon name={logo} size={size} className={className} />;
  return (
    <span
      className="grid place-items-center rounded-md bg-brand-600/20 text-[11px] font-bold text-brand-400"
      style={{ width: size, height: size }}
    >
      {logo.slice(0, 2).toUpperCase()}
    </span>
  );
}
