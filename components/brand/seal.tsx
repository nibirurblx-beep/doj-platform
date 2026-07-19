import Image from "next/image";

/**
 * Department seal.
 *
 * TO CHANGE THE LOGO: replace public/brand/seal.svg with your image.
 * Using seal.png; change the src below if you switch formats.
 * Nothing else in the codebase references the image directly.
 */
export function Seal({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/seal.png"
      alt="Department of Justice seal"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
