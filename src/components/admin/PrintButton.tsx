"use client";

export function PrintButton() {
  return <button className="btn-primary btn-sm" onClick={() => window.print()}>Print</button>;
}
