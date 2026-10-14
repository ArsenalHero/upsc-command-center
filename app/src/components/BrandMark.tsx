import { useId } from "react";

/** Recolour the shared artwork from the active palette while retaining its shading and transparency. */
export function BrandMark() {
  const filterId = `brand-theme-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className="brand-mark"
      aria-hidden="true"
      focusable="false"
      width={44}
      height={44}
      viewBox="0 0 44 44"
    >
      <defs>
        <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feFlood floodColor="currentColor" result="palette" />
          <feBlend in="SourceGraphic" in2="palette" mode="luminosity" result="tinted" />
          <feComposite in="tinted" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
      <image
        href={`${import.meta.env.BASE_URL || "./"}brand/logo-mark.webp`}
        width={44}
        height={44}
        filter={`url(#${filterId})`}
      />
    </svg>
  );
}
