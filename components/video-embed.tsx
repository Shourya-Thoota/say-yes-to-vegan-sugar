"use client";

import { useState } from "react";

type VideoEmbedProps = {
  videoId: string;
  title: string;
  watchUrl: string;
};

export function VideoEmbed({ videoId, title, watchUrl }: VideoEmbedProps) {
  const [consented, setConsented] = useState(false);
  const [failed, setFailed] = useState(false);
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;

  if (!consented) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#E5DCCB] bg-white">
        <div className="relative aspect-video bg-[#EFE7D8]">
          <svg
            viewBox="0 0 560 315"
            role="img"
            aria-label="Illustrated preview: sugar cane and a filter diagram, not factory footage"
            className="absolute inset-0 h-full w-full"
          >
            <rect width="560" height="315" fill="#EFE7D8" />
            <path d="M70 250 L170 90 L250 90 L150 250 Z" fill="#fff" stroke="#2D2D2D" strokeWidth="5" />
            <path d="M120 210 L200 210 M135 180 L215 180 M150 150 L220 150" stroke="#E8865A" strokeWidth="7" strokeLinecap="round" />
            <circle cx="400" cy="150" r="72" fill="#F5F0E8" stroke="#2D2D2D" strokeWidth="5" />
            <path d="M352 150 h96 c0 30 -21 48 -48 48 s-48 -18 -48 -48 z" fill="#fff" stroke="#2D2D2D" strokeWidth="5" />
            <ellipse cx="400" cy="150" rx="48" ry="13" fill="#FBE9DD" stroke="#2D2D2D" strokeWidth="4" />
            <text x="36" y="296" fontFamily="Calibri, sans-serif" fontSize="17" fill="#6B5E4F">
              Illustration, not factory footage.
            </text>
          </svg>
          <button
            type="button"
            onClick={() => setConsented(true)}
            aria-label={`Play video: ${title}`}
            className="absolute inset-0 flex h-full w-full items-center justify-center rounded-none focus-visible:outline-none"
          >
            <span className="flex min-h-[44px] items-center gap-3 rounded-xl bg-charcoal px-7 py-3.5 font-semibold text-white shadow-md hover:bg-black focus-visible:outline focus-visible:outline-3 focus-visible:outline-[#9C4A26]">
              <span aria-hidden="true" className="inline-block h-0 w-0 border-y-8 border-l-[14px] border-y-transparent border-l-white" />
              Play video
            </span>
          </button>
        </div>
        <p className="border-t border-[#E5DCCB] px-5 py-3 text-sm leading-relaxed text-[#6B5E4F]">
          Play loads a YouTube video. YouTube may receive information about your visit.{" "}
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-terracotta-deeper underline underline-offset-4">
            Watch on YouTube instead
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5DCCB] bg-black">
      <div className="aspect-video w-full">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-white p-8 text-center">
            <p className="font-heading text-xl font-bold">The embedded player could not load.</p>
            <p className="text-[#4A4238]">You can still watch the video and read the summary below.</p>
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block min-h-[44px] rounded-xl bg-charcoal px-6 py-3 font-semibold text-white hover:bg-black"
            >
              Watch on YouTube
            </a>
          </div>
        ) : (
          <iframe
            src={embedUrl}
            title={title}
            className="h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <p className="border-t border-[#E5DCCB] bg-white px-5 py-3 text-sm leading-relaxed text-[#6B5E4F]">
        Playing from YouTube’s privacy-enhanced domain. Playback is not claimed to be anonymous or
        tracking-free.{" "}
        <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-terracotta-deeper underline underline-offset-4">
          Open on YouTube
        </a>
      </p>
    </div>
  );
}
