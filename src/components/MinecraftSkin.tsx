import { useState } from "react";

/**
 * Renders a Minecraft player skin (full body) with fallback chain across
 * multiple public render APIs. Some providers (crafatar) are frequently
 * down/rate-limited, so we try several and finally fall back to a static
 * placeholder.
 */
export function MinecraftSkin({
  uuid,
  username,
  alt,
  className,
}: {
  uuid?: string | null;
  username?: string | null;
  alt: string;
  className?: string;
}) {
  // Build the source chain. Most APIs accept either a UUID (dashed or not)
  // or a username. Order from "best render" → "most reliable".
  const id = (uuid ?? username ?? "").trim();
  const sources = id
    ? [
        // Starlight Skins — high quality renders, very reliable
        `https://starlightskins.lunareclipse.studio/render/walking/${encodeURIComponent(id)}/full`,
        // mc-heads.net — long-standing, reliable
        `https://mc-heads.net/body/${encodeURIComponent(id)}/right`,
        // Visage / SurgePlay
        `https://visage.surgeplay.com/full/512/${encodeURIComponent(id)}`,
        // Crafatar — last resort (often rate-limited)
        `https://crafatar.com/renders/body/${encodeURIComponent(id)}?overlay&scale=10`,
      ]
    : [];

  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  if (!id || failed) {
    return (
      <div
        className={
          className ??
          "h-48 w-24 bg-zinc-900 border border-zinc-800 rounded grid place-items-center text-zinc-500 text-[10px] uppercase tracking-widest"
        }
        style={{ fontFamily: "'Space Mono'" }}
      >
        no skin
      </div>
    );
  }

  return (
    <img
      key={sources[idx]}
      src={sources[idx]}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (idx + 1 < sources.length) setIdx(idx + 1);
        else setFailed(true);
      }}
    />
  );
}
