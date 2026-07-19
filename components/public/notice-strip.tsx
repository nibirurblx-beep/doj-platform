export function NoticeStrip() {
  return (
    <div className="bg-navy-950 text-white">
      <p className="mx-auto max-w-6xl px-4 py-1.5 text-center text-[11px] leading-snug sm:px-6 sm:text-left sm:text-xs">
        A fictional roleplay platform. Not affiliated with the United States
        Government, the U.S. Department of Justice, Roblox Corporation or
        Discord.{" "}
        <a
          href="/disclaimer"
          className="whitespace-nowrap underline underline-offset-2"
        >
          Read the full disclaimer
        </a>
      </p>
    </div>
  );
}
