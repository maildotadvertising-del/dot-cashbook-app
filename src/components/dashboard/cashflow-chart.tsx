"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money, moneyShort } from "@/lib/utils";

export function CashflowChart({
  data,
}: {
  data: { day: string; in: number; out: number }[];
}) {
  if (!data.length) {
    return (
      <div className="grid h-52 place-items-center text-sm text-[var(--fg-muted)]">
        No activity in this period
      </div>
    );
  }

  const label = (value: string) =>
    new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--in)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--in)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--out)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--out)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--hairline)" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={label}
            tick={{ fontSize: 11, fill: "var(--fg-muted)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v) => moneyShort(v)}
            tick={{ fontSize: 11, fill: "var(--fg-muted)" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            labelFormatter={(value) => label(String(value))}
            formatter={(value, name) => [
              `₹${money(Number(value))}`,
              name === "in" ? "Cash In" : "Cash Out",
            ]}
            contentStyle={{
              background: "var(--glass-bg-strong)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--glass-border)",
              borderRadius: 14,
              fontSize: 12,
              color: "var(--fg)",
            }}
          />
          <Area
            type="monotone"
            dataKey="in"
            stroke="var(--in)"
            strokeWidth={2}
            fill="url(#inFill)"
          />
          <Area
            type="monotone"
            dataKey="out"
            stroke="var(--out)"
            strokeWidth={2}
            fill="url(#outFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
