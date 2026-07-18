import Image from "next/image";

/**
 * Department seal.
 *
 * TO CHANGE THE LOGO: replace public/brand/seal.svg with your image.
 * If you use a PNG instead, change the src below to "/brand/seal.png".
 * Nothing else in the codebase references the image directly.
 */
export function Seal({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/seal.svg"
      alt="Department of Justice seal"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
