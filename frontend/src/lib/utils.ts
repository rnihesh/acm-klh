import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "text-red-400 bg-red-500/10";
    case "HIGH":
      return "text-amber-400 bg-amber-500/10";
    case "MEDIUM":
      return "text-gray-400 bg-gray-500/10";
    case "LOW":
      return "text-emerald-400 bg-emerald-500/10";
    default:
      return "text-gray-400 bg-gray-500/10";
  }
}

export function riskColor(risk: string): string {
  switch (risk) {
    case "CRITICAL":
      return "text-red-400 border-red-500/30 bg-red-500/10";
    case "HIGH":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "MEDIUM":
      return "text-gray-400 border-gray-500/30 bg-gray-500/10";
    case "LOW":
      return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    default:
      return "text-gray-400 border-gray-500/30 bg-gray-500/10";
  }
}
