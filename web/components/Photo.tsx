import Image from "next/image";
import type { ReactNode } from "react";

/** A framed photograph. Children sit on top of it (glass captions, chips). */
export default function Photo({
  name,
  alt,
  ratio = "1 / 1",
  pos = "center",
  className = "",
  priority = false,
  sizes = "(max-width: 820px) 92vw, 460px",
  children,
}: {
  name: string;
  alt: string;
  ratio?: string;
  pos?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  children?: ReactNode;
}) {
  return (
    <figure className={`photo ${className}`} style={{ aspectRatio: ratio }}>
      <Image src={/\.(jpe?g|png|webp)$/.test(name) ? `/img/${name}` : `/img/${name}.webp`} alt={alt} fill sizes={sizes} priority={priority} style={{ objectFit: "cover", objectPosition: pos }} />
      {children}
    </figure>
  );
}
