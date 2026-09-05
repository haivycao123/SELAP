"use client";

import { useEffect, useMemo, useState } from "react";
import { resolvePropertyImageUrl } from "../lib/images";

type ImageCandidate = {
  alt?: string | null;
  url?: string | null;
};

type PropertyImageWithFallbackProps = {
  alt: string;
  fallbackImages?: readonly ImageCandidate[] | null;
  fallbackSeed?: number;
  images: readonly ImageCandidate[] | null | undefined;
  preferImageAlt?: boolean;
  useDefaultFallbacks?: boolean;
};

const DEFAULT_PROPERTY_IMAGE_URLS = [
  "/uploads/properties/695eda71-cd88-4df3-9270-2b051d2e1d8d.jpg",
  "/uploads/properties/80110770-e3dc-4630-ace8-bc2e79d17b9a.jpg",
  "/uploads/properties/b6d46a9f-a2fa-4222-b783-cd465941afda.jpg",
  "/uploads/properties/f61a2d9a-bc16-4733-8f2e-927029d4100b.jpg"
];

export function PropertyImageWithFallback({
  alt,
  fallbackImages,
  fallbackSeed = 0,
  images,
  preferImageAlt = true,
  useDefaultFallbacks = true
}: PropertyImageWithFallbackProps) {
  const sources = useMemo(
    () =>
      [
        ...(images ?? []),
        ...getRotatedImages(fallbackImages ?? [], fallbackSeed),
        ...(useDefaultFallbacks
          ? getRotatedFallbackImages(fallbackSeed)
          : [])
      ]
        .map((image) => ({
          alt: preferImageAlt ? image.alt || alt : alt,
          src: resolvePropertyImageUrl(image.url)
        }))
        .filter((image) => image.src),
    [
      alt,
      fallbackImages,
      fallbackSeed,
      images,
      preferImageAlt,
      useDefaultFallbacks
    ]
  );
  const sourcesKey = sources.map((source) => source.src).join("\n");
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sourcesKey]);

  const source = sources[sourceIndex];

  if (!source) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={source.alt}
      onError={() => setSourceIndex((current) => current + 1)}
      src={source.src}
    />
  );
}

function getRotatedFallbackImages(seed: number): ImageCandidate[] {
  return getRotatedImages(
    DEFAULT_PROPERTY_IMAGE_URLS.map((url) => ({
      alt: "Apartment interior",
      url
    })),
    seed
  );
}

function getRotatedImages(
  images: readonly ImageCandidate[],
  seed: number
): ImageCandidate[] {
  if (images.length === 0) {
    return [];
  }

  const startIndex =
    Math.abs(Math.trunc(seed)) % images.length;

  return [
    ...images.slice(startIndex),
    ...images.slice(0, startIndex)
  ];
}
