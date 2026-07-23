"use client";
import { useEffect, useState } from "react";

const TopHeader = () => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setCurrentTime(new Date()), 0);
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, []);

  const formattedDate = currentTime
    ? currentTime.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <header className="flex min-h-14 flex-col justify-center gap-2 sm:flex-row sm:items-center sm:justify-start sm:gap-5">
      <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.035em] text-[#12213a] sm:text-[34px]">
        Dashboard
      </h1>

      <p className="flex min-h-5 items-center gap-2 text-sm font-medium text-slate-500">
        {currentTime ? (
          <>
            <span
              className="dashboard-status-heartbeat h-2 w-2 shrink-0 rounded-full bg-[#16c7a4]"
              aria-hidden="true"
            />
            <span>{formattedDate}</span>
          </>
        ) : (
          <span className="h-4 w-56 animate-pulse rounded bg-slate-200" />
        )}
      </p>
    </header>
  );
};

export default TopHeader;
