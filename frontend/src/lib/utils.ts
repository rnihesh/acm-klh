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
      return "text-red-500 bg-red-500/10";
    case "HIGH":
      return "text-orange-500 bg-orange-500/10";
    case "MEDIUM":
      return "text-yellow-500 bg-yellow-500/10";
    case "LOW":
      return "text-green-500 bg-green-500/10";
    default:
      return "text-gray-500 bg-gray-500/10";
  }
}

export function riskColor(risk: string): string {
  switch (risk) {
    case "CRITICAL":
      return "text-red-400 border-red-500/50 bg-red-500/10";
    case "HIGH":
      return "text-orange-400 border-orange-500/50 bg-orange-500/10";
    case "MEDIUM":
      return "text-yellow-400 border-yellow-500/50 bg-yellow-500/10";
    case "LOW":
      return "text-green-400 border-green-500/50 bg-green-500/10";
    default:
      return "text-gray-400 border-gray-500/50 bg-gray-500/10";
  }
}
