import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Share2, Download, ChevronRight, AlertTriangle } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getDailyReport, getMonthlyReport, getWeeklyReport } from "../lib/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type ReportType = "daily" | "weekly" | "monthly";

function CardGrid({ cards }: { cards: any[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card: any) => (
        <div key={card.key} className="p-4 rounded-2xl border bg-white border-gray-100">
          <div className="text-lg font-bold text-gray-800">
            {Number(card.value || 0).toFixed(card.unit === "/10" ? 1 : 0)}
            <span className="text-sm font-normal text-gray-500 ml-1">{card.unit || ""}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          {card.target != null && (
            <div className="text-xs text-gray-400 mt-1">目标 {card.target}{card.unit === "kcal/天" ? " kcal" : card.unit}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<any | null>(null);
  const [weekly, setWeekly] = useState<any | null>(null);
  const [monthly, setMonthly] = useState<any | null>(null);
  const [exporting, setExporting] = useState<"" | "png" | "pdf">("");
  const reportRef = useRef<HTMLDivElement | null>(null);

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, w, m] = await Promise.all([
        getDailyReport() as any,
        getWeeklyReport() as any,
        getMonthlyReport(currentMonth) as any,
      ]);
      setDaily(d);
      setWeekly(w);
      setMonthly(m);
    } catch (e: any) {
      setError(String(e?.message || "报告加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const activeSummaryCards =
    reportType === "daily"
      ? daily?.summary_cards || []
      : reportType === "weekly"
        ? weekly?.summary_cards || []
        : monthly?.summary_cards || [];
  const insights =
    reportType === "daily"
      ? daily?.insights || []
      : reportType === "weekly"
        ? weekly?.insights || []
        : monthly?.insights || [];

  const weeklyChartData = (weekly?.daily_metrics || []).map((x: any) => ({
    day: x.label,
    calories: Number(x.calories || 0),
    protein: Number(x.protein || 0),
    fat: Number(x.fat || 0),
    carbs: Number(x.carbs || 0),
    score: Number(x.score || 0),
    target: Number(x.target || 0),
  }));

  const monthlyChartData = (monthly?.week_metrics || []).map((x: any) => ({
    week: x.week_label,
    goalRate: Number(x.goal_rate || 0),
    avgCal: Number(x.avg_calories || 0),
    avgScore: Number(x.avg_score || 0),
  }));

  const reportTitle = reportType === "daily" ? "日报" : reportType === "weekly" ? "周报" : "月报";
  const exportFileBase = `nutrition-${reportType}-report-${new Date().toISOString().slice(0, 10)}`;

  const getShareText = () => {
    const top = insights[0] || "今日报告已生成";
    return `${reportTitle}：${top}`;
  };

  const handleShare = async () => {
    const text = getShareText();
    const title = `NutritionManager${reportTitle}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: window.location.href });
        return;
      } catch {
        // 用户取消等场景，走降级提示
      }
    }
    try {
      await navigator.clipboard.writeText(`${title}\n${text}\n${window.location.href}`);
      alert("报告摘要已复制，可直接粘贴分享。");
    } catch {
      alert("当前环境不支持系统分享，请手动复制页面链接。");
    }
  };

  const captureReportCanvas = async () => {
    const node = reportRef.current;
    if (!node) throw new Error("报告区域不可用");
    return html2canvas(node, {
      backgroundColor: "#f9fafb",
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
      logging: false,
    });
  };

  const handleExportPNG = async () => {
    setExporting("png");
    try {
      const canvas = await captureReportCanvas();
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportFileBase}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("导出图片失败，请稍后重试。");
    } finally {
      setExporting("");
    }
  };

  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      const canvas = await captureReportCanvas();
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let y = 0;
      if (imgHeight <= pageHeight) {
        pdf.addImage(img, "PNG", 0, 0, imgWidth, imgHeight);
      } else {
        let remaining = imgHeight;
        while (remaining > 0) {
          pdf.addImage(img, "PNG", 0, y, imgWidth, imgHeight);
          remaining -= pageHeight;
          y -= pageHeight;
          if (remaining > 0) pdf.addPage();
        }
      }
      pdf.save(`${exportFileBase}.pdf`);
    } catch {
      alert("导出PDF失败，请稍后重试。");
    } finally {
      setExporting("");
    }
  };

  return (
    <div ref={reportRef} className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">数据报告</h1>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
            title="分享报告"
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={handleExportPNG}
            disabled={exporting !== ""}
            className={`p-2 border border-gray-200 rounded-xl transition-colors ${
              exporting === "" ? "text-gray-500 hover:bg-gray-50" : "text-gray-300 cursor-not-allowed"
            }`}
            title="导出图片"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1">
        {(["daily", "weekly", "monthly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setReportType(t)}
            className={`flex-1 py-2 rounded-lg text-sm transition-all ${
              reportType === t ? "bg-white text-green-700 shadow-sm font-medium" : "text-gray-500"
            }`}
          >
            {{ daily: "日报", weekly: "周报", monthly: "月报" }[t]}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-gray-500">报告加载中...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <CardGrid cards={activeSummaryCards} />

          {reportType === "daily" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-gray-700 mb-4">今日餐次构成</h3>
                <div className="space-y-3">
                  {(daily?.meals || []).map((meal: any) => (
                    <div key={meal.meal_type} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-800">{meal.meal_type}</div>
                        <div className="text-sm text-gray-600">{meal.calories} kcal</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{(meal.foods || []).join("、") || "暂无食物记录"}</div>
                    </div>
                  ))}
                  {(daily?.meals || []).length === 0 && (
                    <div className="text-sm text-gray-500">今日暂无记录。</div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-gray-700 mb-4">今日热量概览</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[{
                    day: "今天",
                    calories: Number((daily?.summary_cards || []).find((x: any) => x.key === "calories")?.value || 0),
                    target: Number((daily?.summary_cards || []).find((x: any) => x.key === "calories")?.target || 0),
                  }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip formatter={(v: number) => [`${v} kcal`, "热量"]} />
                    <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                      <Cell fill="#22c55e" />
                    </Bar>
                    <Bar dataKey="target" radius={[6, 6, 0, 0]}>
                      <Cell fill="#bbf7d0" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {reportType === "weekly" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-gray-700 mb-4">本周热量摄入</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={weeklyChartData}>
                      <defs>
                        <linearGradient id="wCalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(v: number) => [`${v} kcal`, "热量"]} />
                      <Area type="monotone" dataKey="calories" stroke="#22c55e" strokeWidth={2} fill="url(#wCalGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-gray-700 mb-4">每日健康评分</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyChartData} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} hide />
                      <Tooltip formatter={(v: number) => [`${v}分`, "健康评分"]} />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                        {weeklyChartData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.score >= 8 ? "#22c55e" : entry.score >= 6 ? "#f59e0b" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-gray-700 mb-4">食物种类分布（按份量）</h3>
                <div className="space-y-3">
                  {(weekly?.category_distribution || []).map((cat: any) => (
                    <div key={cat.name} className="flex items-center gap-3">
                      <div className="text-sm text-gray-600 w-16">{cat.name}</div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${cat.pct}%` }} />
                      </div>
                      <div className="text-sm font-medium text-gray-700 w-10 text-right">{cat.pct}%</div>
                    </div>
                  ))}
                  {(weekly?.category_distribution || []).length === 0 && (
                    <div className="text-sm text-gray-500">暂无分布数据。</div>
                  )}
                </div>
              </div>
            </>
          )}

          {reportType === "monthly" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-gray-700 mb-4">月度目标达成率</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyChartData}>
                    <defs>
                      <linearGradient id="mGoalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip formatter={(v: number) => [`${v}%`, "达成率"]} />
                    <Area type="monotone" dataKey="goalRate" stroke="#22c55e" strokeWidth={2} fill="url(#mGoalGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-gray-700 mb-4">周均热量与评分</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChartData} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip formatter={(v: number, key: string) => [`${v}${key === "avgCal" ? " kcal" : "分"}`, key === "avgCal" ? "周均热量" : "周均评分"]} />
                    <Bar dataKey="avgCal" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgScore" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={20} className="text-green-100" />
              <h3 className="font-semibold">
                {reportType === "daily" ? "今日日报总结" : reportType === "weekly" ? "本周健康总结" : "本月趋势总结"}
              </h3>
            </div>
            <div className="space-y-2 text-green-100 text-sm">
              {insights.map((line: string, i: number) => (
                <p key={`${i}-${line}`}>• {line}</p>
              ))}
              {insights.length === 0 && <p>• 暂无总结数据</p>}
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm">
                <Share2 size={14} /> 分享报告
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting !== ""}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
                  exporting === "" ? "bg-white/20 hover:bg-white/30" : "bg-white/10 cursor-not-allowed"
                }`}
              >
                <Download size={14} /> {exporting === "pdf" ? "导出中..." : "导出PDF"}
              </button>
              <button onClick={handleExportPNG} className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm">
                <Download size={14} /> {exporting === "png" ? "导出中..." : "导出图片"}
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm opacity-80">
                详情 <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
