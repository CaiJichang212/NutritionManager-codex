import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { getNutritionSummary } from "../lib/api";

const EMPTY_ARRAY: any[] = [];

const categories = [
  { id: "all", label: "全部" },
  { id: "energy", label: "能量" },
  { id: "macro", label: "宏量素" },
  { id: "fat", label: "脂肪类" },
  { id: "mineral", label: "矿物质" },
  { id: "vitamin", label: "维生素" },
  { id: "additive", label: "添加物" },
];

function NutrientBar({ n }: { n: typeof nutrients[0] }) {
  const pct = Math.min((n.consumed / n.target) * 100, 100);
  const isLow = pct < 70;
  const isHigh = pct > 110;
  const status = isHigh ? "超标" : isLow ? "不足" : "达标";
  const statusColor = isHigh ? "text-red-600" : isLow ? "text-amber-600" : "text-green-600";
  const barColor = isHigh ? "#ef4444" : isLow ? "#f59e0b" : n.color;
  const Icon = isHigh ? TrendingUp : isLow ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-20 text-sm text-gray-700 flex-shrink-0">{n.name}</div>
      <div className="flex-1">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
      <div className="text-xs text-gray-500 w-20 text-right flex-shrink-0">
        {n.consumed} / {n.target} {n.unit}
      </div>
      <div className={`flex items-center gap-0.5 text-xs w-10 flex-shrink-0 ${statusColor}`}>
        <Icon size={10} /> {status}
      </div>
    </div>
  );
}

export function NutritionPage() {
  const [selectedCat, setSelectedCat] = useState("all");
  const [dateOffset, setDateOffset] = useState(0);
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    const current = new Date();
    current.setDate(current.getDate() + dateOffset);
    const dateStr = current.toISOString().slice(0, 10);
    getNutritionSummary(dateStr)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {
        if (active) setSummary(null);
      });
    return () => {
      active = false;
    };
  }, [dateOffset]);

  const dateLabel = dateOffset === 0 ? "今天" : dateOffset === -1 ? "昨天" : `${Math.abs(dateOffset)}天前`;

  const nutrients = summary ? [
    { name: "热量", consumed: summary.calorie_consumed, target: summary.calorie_target, unit: "kcal", category: "energy", color: "#ef4444" },
    ...summary.macros.map((m: any) => ({
      name: m.name,
      consumed: m.consumed,
      target: m.target,
      unit: m.unit,
      category: "macro",
      color: m.color,
    })),
    { name: "添加糖", consumed: summary.focus?.[0]?.consumed ?? 0, target: summary.focus?.[0]?.target ?? 50, unit: "g", category: "additive", color: "#e879f9" },
    { name: "钠", consumed: summary.focus?.[1]?.consumed ?? 0, target: summary.focus?.[1]?.target ?? 2000, unit: "mg", category: "mineral", color: "#6366f1" },
  ] : [];

  const filtered = selectedCat === "all"
    ? nutrients
    : nutrients.filter((n) => n.category === selectedCat);

  const reminders = summary?.reminders || [];
  const additiveStats = summary?.additive_stats || [];
  const advice = summary?.advice || [];
  const populationAssessments = summary?.population_assessments || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Date Nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">营养数据中心</h1>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <button
            onClick={() => setDateOffset(dateOffset - 1)}
            className="text-gray-400 hover:text-gray-600 p-0.5"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-700 min-w-[60px] text-center">{dateLabel}</span>
          <button
            onClick={() => setDateOffset(Math.min(0, dateOffset + 1))}
            className={`text-gray-400 hover:text-gray-600 p-0.5 ${dateOffset === 0 ? "opacity-30" : ""}`}
            disabled={dateOffset === 0}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Top Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-700 mb-4">营养均衡度</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={summary?.radar || EMPTY_ARRAY}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Radar
                name="今日"
                dataKey="A"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="text-center text-sm text-gray-500 mt-1">综合均衡评分 <span className="text-green-600 font-semibold">{summary?.health_score?.score ?? 0}分</span></div>
        </div>

        {/* Weekly Calories */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-gray-700 mb-4">本周热量趋势</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary?.weekly_calories || EMPTY_ARRAY} barSize={20}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 2500]} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                formatter={(v: number) => [`${v} kcal`, "摄入"]}
              />
              <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                {(summary?.weekly_calories || EMPTY_ARRAY).map((entry: any, i: number) => (
                  <Cell
                    key={i}
                    fill={
                      i === 6 ? "#d1fae5" :
                      entry.val > entry.target * 1.1 ? "#fecaca" :
                      entry.val < entry.target * 0.8 ? "#fef3c7" :
                      "#22c55e"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 justify-center text-xs text-gray-400">
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-green-400" /> 达标</div>
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-red-200" /> 超标</div>
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-yellow-200" /> 不足</div>
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-green-100" /> 今天</div>
          </div>
        </div>
      </div>

      {/* Unified Reminders */}
      <div className={`${reminders.some((r: any) => r.type === "warn") ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"} border rounded-2xl p-5`}>
        <div className={`${reminders.some((r: any) => r.type === "warn") ? "text-amber-700" : "text-green-700"} flex items-center gap-2 font-medium mb-3`}>
          <AlertTriangle size={16} /> 今日营养提醒 ({reminders.length} 项)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2">
          {reminders.map((r: any, idx: number) => {
            const warn = r.type === "warn";
            return (
              <div key={`${r.text}-${idx}`} className={`flex items-center gap-2 p-2.5 rounded-xl ${warn ? "bg-red-50" : "bg-green-100"}`}>
                {warn ? <TrendingUp size={14} className="text-red-500" /> : <CheckCircle size={14} className="text-green-600" />}
                <div className="text-sm text-gray-800">{r.text}</div>
              </div>
            );
          })}
          {reminders.length === 0 && (
            <div className="text-sm text-gray-600 bg-gray-100 rounded-xl p-2.5">今日暂无提醒</div>
          )}
        </div>
      </div>

      {/* Health Score */}
      {summary?.health_score && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-700">健康评估</h3>
            <div className="text-sm text-green-600 font-semibold">{summary.health_score.score} 分 · {summary.health_score.level}</div>
          </div>
          <div className="space-y-2">
            {summary.health_score.dimensions.map((d: any) => (
              <div key={d.label} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-500">{d.label}</div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: `${(d.score / d.max) * 100}%` }} />
                </div>
                <div className="text-xs text-gray-500 w-12 text-right">{d.score}/{d.max}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {populationAssessments.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-700">特定人群评估</h3>
            <div className="text-xs text-gray-500">减脂 / 增肌 / 糖尿病 / 高血压 / 过敏</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {populationAssessments.map((item: any) => {
              const status = String(item?.status || "");
              const tone =
                status === "不建议"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : status === "谨慎"
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-green-50 border-green-200 text-green-700";
              return (
                <div key={String(item?.key || item?.name)} className={`rounded-xl border p-3 ${tone}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold">{item?.name}</div>
                    <div className="text-xs font-medium">{Number(item?.score || 0).toFixed(1)}</div>
                  </div>
                  <div className="text-xs mb-1">{item?.level} · {item?.status}</div>
                  <div className="text-xs opacity-90">{item?.highlights?.[0] || "暂无评估说明"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed List */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-700">营养素详情</h3>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Info size={12} /> 基于当前记录
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${
                selectedCat === c.id
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div>
          {filtered.map((n) => (
            <NutrientBar key={n.name} n={n} />
          ))}
        </div>
      </div>

      {/* Additive Analysis */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-gray-700 mb-4">添加剂统计</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {additiveStats.map((item: any) => {
            const ratio = item.max > 0 ? item.val / item.max : 0;
            const color = ratio > 1
              ? "bg-red-100 text-red-700 border-red-200"
              : ratio > 0.7
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-green-100 text-green-700 border-green-200";
            return (
            <div key={item.name} className={`p-4 rounded-xl border ${color}`}>
              <div className="text-sm font-medium mb-1">{item.name}</div>
              <div className="text-xl font-bold">{item.val} <span className="text-sm font-normal">{item.unit}</span></div>
              <div className="text-xs opacity-70 mt-0.5">限量 {item.max}{item.unit}</div>
              <div className="h-1.5 bg-white/50 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-current rounded-full opacity-60"
                  style={{ width: `${Math.min((item.val / (item.max || 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          );})}
        </div>
      </div>

      {/* Personalized Advice */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">今日营养建议</h3>
            <ul className="space-y-1.5 text-green-100 text-sm">
              {advice.map((t: string, idx: number) => (
                <li key={`${idx}-${t}`}>• {t}</li>
              ))}
              {advice.length === 0 && <li>• 暂无建议</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
