import Image from "next/image";

import { LoadingIndicator } from "@/components/loading-indicator";

export function LoadingStory({
  imageSrc,
  imageAlt,
  label,
  progress,
  priority = false,
}: {
  imageSrc: string;
  imageAlt: string;
  label: string;
  progress?: number;
  priority?: boolean;
}) {
  return (
    <div className="loading-story">
      <figure className="loading-story-illustration">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={1024}
          height={1536}
          sizes="(max-width: 480px) calc(100vw - 80px), 400px"
          priority={priority}
        />
      </figure>
      <LoadingIndicator label={label} progress={progress} />
    </div>
  );
}
