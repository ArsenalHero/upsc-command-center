/** Shared logo asset; the adjacent wordmark provides its accessible name. */
export function BrandMark() {
  return (
    <img
      className="brand-mark"
      src={`${import.meta.env.BASE_URL || "./"}brand/logo-mark.webp`}
      alt=""
      aria-hidden="true"
      width={44}
      height={44}
    />
  );
}
