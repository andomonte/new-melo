import React, { useEffect, useState } from 'react';

interface HeaderProps {
  title: string;
  hasTime?: boolean;
}

export default function Header(props: HeaderProps) {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    if (props.hasTime) {
      const timer = setInterval(() => {
        setTime(new Date());
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [props.hasTime]);

  return (
    <header className="bg-[#1f517c] shadow-md sticky top-0">
      <div className="flex items-center justify-around px-8 py-6">
        <img
          className="w-[10%]"
          src={'/images/logo1Branco.webp'}
          alt="Your Company"
        />
        <h1 className="text-4xl font-bold text-white">{props.title}</h1>
        {props.hasTime ? (
          <div
            className="text-2xl font-mono text-white"
            suppressHydrationWarning
          >
            {time.toLocaleTimeString()}
          </div>
        ) : (
          <div></div>
        )}
      </div>
    </header>
  );
}
