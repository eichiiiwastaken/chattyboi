"use client";

import {
  ActivityIcon,
  Clock3Icon,
  GaugeIcon,
  MessageSquareIcon,
  SparklesIcon,
} from "lucide-react";
import useSWR from "swr";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Grid,
  Legend,
  Pie,
  PieChart,
  Sparkline,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/dither-kit";
import type { ChartConfig } from "@/components/dither-kit/chart-context";
import type { DitherColor } from "@/components/dither-kit/palette";
import { Skeleton } from "@/components/ui/skeleton";

type UsageData = {
  totals: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    averageLatency: number;
    averageTtft: number;
    activeDays: number;
  };
  daily: Array<{
    date: string;
    label: string;
    input: number;
    output: number;
    requests: number;
    latency: number;
  }>;
  models: Array<{
    model: string;
    tokens: number;
    requests: number;
    averageLatency: number;
    color: DitherColor;
  }>;
  hours: Array<{ hour: number; requests: number }>;
  latencyBuckets: Array<{ bucket: string; requests: number }>;
  generatedAt: string;
};

const tokenConfig: ChartConfig = {
  input: { label: "Input", color: "blue" },
  output: { label: "Output", color: "purple" },
};
const requestConfig: ChartConfig = {
  requests: { label: "Requests", color: "green" },
};
const latencyConfig: ChartConfig = {
  requests: { label: "Responses", color: "orange" },
};

function compact(value: number) {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function duration(value: number) {
  if (!value) {
    return "—";
  }
  return value < 1000
    ? `${Math.round(value)}ms`
    : `${(value / 1000).toFixed(1)}s`;
}

function UsageCard({
  icon: Icon,
  label,
  value,
  note,
  series,
  color,
}: {
  icon: typeof ActivityIcon;
  label: string;
  value: string;
  note: string;
  series: number[];
  color: DitherColor;
}) {
  return (
    <div className="relative min-h-32 overflow-hidden rounded-xl border border-border/50 bg-card/60 p-4 shadow-[var(--shadow-card)]">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="size-3.5" />
            <span className="font-medium text-[11px] uppercase tracking-[0.14em]">
              {label}
            </span>
          </div>
          <p className="mt-3 font-semibold text-2xl tracking-tight tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
        </div>
      </div>
      <Sparkline
        className="absolute right-0 bottom-0 h-16 w-[58%] opacity-70"
        color={color}
        data={series.length ? series : [0]}
        variant="dotted"
      />
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border/50 bg-card/60 p-4 shadow-[var(--shadow-card)] ${className}`}
    >
      <h3 className="font-medium text-[13px]">{title}</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      <div className="mt-5 h-64">{children}</div>
    </section>
  );
}

export function UsageDashboard() {
  const { data, error, isLoading } = useSWR<UsageData>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/usage`,
    (url: string) =>
      fetch(url).then((response) => {
        if (!response.ok) {
          throw new Error("Could not load usage");
        }
        return response.json();
      }),
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          "tokens",
          "responses",
          "latency",
          "ttft",
          "volume",
          "hours",
          "models",
          "speed",
        ].map((key) => (
          <Skeleton className="h-40 rounded-xl" key={key} />
        ))}
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-[13px] text-muted-foreground">
        Usage data could not be loaded. Try refreshing the page.
      </div>
    );
  }

  const recent = data.daily.slice(-14);
  const modelData = data.models.slice(0, 6).map((model, index) => ({
    name: `model-${index}`,
    label: model.model,
    tokens: model.tokens,
    color: model.color,
  }));
  const modelConfig: ChartConfig = Object.fromEntries(
    modelData.map((item) => [
      item.name,
      { label: item.label, color: item.color },
    ])
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UsageCard
          color="blue"
          icon={SparklesIcon}
          label="Total tokens"
          note={`${compact(data.totals.inputTokens)} in · ${compact(data.totals.outputTokens)} out`}
          series={recent.map((d) => d.input + d.output)}
          value={compact(data.totals.totalTokens)}
        />
        <UsageCard
          color="green"
          icon={MessageSquareIcon}
          label="Responses"
          note={`${data.totals.activeDays} active days this month`}
          series={recent.map((d) => d.requests)}
          value={data.totals.requests.toLocaleString()}
        />
        <UsageCard
          color="orange"
          icon={Clock3Icon}
          label="Avg. response"
          note="End-to-end generation time"
          series={recent.map((d) => d.latency)}
          value={duration(data.totals.averageLatency)}
        />
        <UsageCard
          color="purple"
          icon={GaugeIcon}
          label="First token"
          note="Average time to first token"
          series={recent.map((d) => d.latency)}
          value={duration(data.totals.averageTtft)}
        />
      </div>

      {data.totals.requests === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <ActivityIcon className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No measured usage yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Send a few messages and response metrics will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              description="Input and output tokens over the last 30 days"
              title="Token volume"
            >
              <AreaChart
                bloom="aura"
                config={tokenConfig}
                data={data.daily}
                stackType="stacked"
              >
                <Grid />
                <XAxis dataKey="label" maxTicks={6} />
                <YAxis tickFormatter={compact} />
                <Legend isClickable />
                <Tooltip
                  labelKey="label"
                  valueFormatter={(value) => `${compact(value)} tokens`}
                />
                <Area dataKey="input" isClickable variant="gradient" />
                <Area dataKey="output" isClickable variant="hatched" />
              </AreaChart>
            </ChartCard>

            <ChartCard
              description="Response count by UTC hour across all history"
              title="When you chat"
            >
              <BarChart bloom="low" config={requestConfig} data={data.hours}>
                <Grid />
                <XAxis
                  dataKey="hour"
                  maxTicks={8}
                  tickFormatter={(value) => `${value}:00`}
                />
                <YAxis />
                <Tooltip
                  labelKey="hour"
                  valueFormatter={(value) => `${value} responses`}
                />
                <Bar dataKey="requests" variant="dotted" />
              </BarChart>
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              description="Share of measured tokens across your most-used models"
              title="Model mix"
            >
              {modelData.length ? (
                <PieChart
                  bloom="aura"
                  config={modelConfig}
                  data={modelData}
                  dataKey="tokens"
                  innerRadius={0.52}
                  nameKey="name"
                >
                  <Legend align="center" isClickable />
                  <Tooltip
                    valueFormatter={(value) => `${compact(value)} tokens`}
                  />
                  <Pie variant="hatched" />
                </PieChart>
              ) : null}
            </ChartCard>

            <ChartCard
              description="How long completed responses took from start to finish"
              title="Response speed"
            >
              <BarChart
                bloom="low"
                config={latencyConfig}
                data={data.latencyBuckets}
              >
                <Grid />
                <XAxis dataKey="bucket" maxTicks={4} />
                <YAxis />
                <Tooltip
                  labelKey="bucket"
                  valueFormatter={(value) => `${value} responses`}
                />
                <Bar dataKey="requests" variant="hatched" />
              </BarChart>
            </ChartCard>
          </div>

          <section className="overflow-hidden rounded-xl border border-border/50 bg-card/60 shadow-[var(--shadow-card)]">
            <div className="border-b border-border/40 px-4 py-3">
              <h3 className="font-medium text-[13px]">Models</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Requests, tokens, and average response time
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Responses
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Tokens</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Avg. time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((model) => (
                    <tr className="border-t border-border/30" key={model.model}>
                      <td className="max-w-72 truncate px-4 py-2.5 font-medium">
                        {model.model}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {model.requests.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {compact(model.tokens)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {duration(model.averageLatency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <p className="text-center text-[10px] text-muted-foreground">
        Metrics are calculated from saved assistant responses. Times use UTC.
      </p>
    </div>
  );
}
