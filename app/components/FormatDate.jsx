"use client";
import { useEffect, useState } from "react";

export default function FormatDate({ value, options }) {
  const [text, setText] = useState("");
  useEffect(() => {
    try {
      const d = new Date(value);
      const fmt = new Intl.DateTimeFormat(undefined, options || {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      setText(fmt.format(d));
    } catch {
      setText("");
    }
  }, [value, options]);

  if (!text) return null;
  return text;
}
