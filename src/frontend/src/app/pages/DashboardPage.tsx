import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Plus,
  ChevronRight,
  Flame,
  Clock,
  Camera,
  Search,
  Zap,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getNutritionSummary, getRecordsToday } from "../lib/api";

const COLORS = {
  protein: "#3b82f6",
  fat: "#f59e0b",
  carbs: "#8b5cf6",
  fiber: "#10b981",
};

const iconMap: Record<string, string> = {
  早餐: "🌅",
  午餐: "☀️",
  晚餐: "🌙",
  加餐: "🍎",
};

const quickFoods = [
  { name: "鸡胸肉", cal: 165, per: "100g", img: "https://images.unsplash.com/photo-1762631383378-115f2d4cbe07?w=80&h=80&fit=crop" },
  { name: "西兰花", cal: 34, per: "100g", img: "https://images.unsplash.com/photo-1676300186673-615bcc8d5d68?w=80&h=80&fit=crop" },
  { name: "燕麦粥", cal: 71, per: "100g", img: "https://images.unsplash.com/photo-1645545532196-e867a6ed4ad9?w=80&h=80&fit=crop" },
  { name: "蛋白质奶昔", cal: 120, per: "1杯", img: "https://images.unsplash.com/photo-1772589668083-ae7b80e700ad?w=80&h=80&fit=crop" },
];

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const pct = Math.min((consumed / target) * 100, 100);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="54" fill="none"
          stroke={pct > 110 ? "#ef4444" : pct > 95 ? "#f59e0b" : "#22c55e"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-gray-800">{consumed}</div>
        <div className="text-xs text-gray-400">/ {target}</div>
        <div className="text-xs text-gray-500">千卡</div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [expandedMeal, setExpandedMeal] = useState<number | null>(2);
  const [summary, setSummary] = useState<any | null>(null);
  const [records, setRecords] = useState<any | null>(null);
  const calorieConsumed = summary?.calorie_consumed ?? 0;
  const calorieTarget = summary?.calorie_target ?? 1800;
  const calorieRemaining = calorieTarget - calorieConsumed;
  const macros = summary?.macros || [
    { name: "蛋白质", key: "protein", consumed: 0, target: 0, unit: "g", color: COLORS.protein, tip: "增肌关键" },
    { name: "脂肪", key: "fat", consumed: 0, target: 0, unit: "g", color: COLORS.fat, tip: "优先不饱和脂肪" },
    { name: "碳水", key: "carbs", consumed: 0, target: 0, unit: "g", color: COLORS.carbs, tip: "主要能量来源" },
    { name: "膳食纤维", key: "fiber", consumed: 0, target: 0, unit: "g", color: COLORS.fiber, tip: "促进消化" },
  ];
  const reminders = (summary?.reminders || []).map((r: any) => ({
    ...r,
    icon: r.type === "warn" ? AlertCircle : CheckCircle2,
    color: r.type === "warn" ? "text-amber-600" : "text-green-600",
    bg: r.type === "warn" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200",
  }));
  const meals = (records?.meals || []).map((m: any, idx: number) => ({
    id: idx + 1,
    type: m.meal_type,
    time: m.time || "",
    icon: iconMap[m.meal_type] || "🍽",
    calories: m.calories,
    foods: (m.foods || []).map((f: any) => ({
      name: f.name,
      amount: f.amount,
      cal: f.calories,
      img: f.image,
    })),
  }));

  useEffect(() => {
    let mounted = true;
    Promise.all([getNutritionSummary(), getRecordsToday()])
      .then(([summaryRes, recordRes]) => {
        if (!mounted) return;
        setSummary(summaryRes);
        setRecords(recordRes);
      })
      .catch(() => {
        if (!mounted) return;
        setSummary(null);
        setRecords({ meals: [] });
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-800">早上好，李明 👋</h1>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })} · 减脂计划第 14 天
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-xs font-medium flex items-center gap-1">
            🔥 连续记录 14 天
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Calorie Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-700">今日热量</h3>
              <span className="text-xs text-gray-400">目标 {calorieTarget} kcal</span>
            </div>
            <div className="flex items-center gap-4">
              <CalorieRing consumed={calorieConsumed} target={calorieTarget} />
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">已摄入</div>
                  <div className="text-lg font-bold text-gray-800">{calorieConsumed} <span className="text-sm font-normal text-gray-400">kcal</span></div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">剩余</div>
                  <div className={`text-lg font-bold ${calorieRemaining < 0 ? "text-red-500" : "text-green-600"}`}>
                    {calorieRemaining} <span className="text-sm font-normal text-gray-400">kcal</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-2 py-1">
                  达成率 {Math.round((calorieConsumed / calorieTarget) * 100)}%
                </div>
              </div>
            </div>

            {/* Burn stats */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-orange-50 rounded-xl p-3 flex items-center gap-2">
                <Flame size={16} className="text-orange-500" />
                <div>
                  <div className="text-xs text-gray-500">运动消耗</div>
                  <div className="text-sm font-semibold text-gray-700">320 kcal</div>
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-2">
                <Zap size={16} className="text-blue-500" />
                <div>
                  <div className="text-xs text-gray-500">基础代谢</div>
                  <div className="text-sm font-semibold text-gray-700">1,756 kcal</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Macros + Reminders */}
        <div className="lg:col-span-2 space-y-4">
          {/* Macros */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-700">三大营养素</h3>
              <button
                onClick={() => navigate("/nutrition")}
                className="text-sm text-green-600 flex items-center gap-1 hover:text-green-700"
              >
                详情 <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {macros.map((m) => (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-600">{m.name}</span>
                    <span className="text-xs text-gray-400">{m.consumed}/{m.target}{m.unit}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min((m.consumed / m.target) * 100, 100)}%`,
                        backgroundColor: m.color,
                      }}
                    />
                  </div>
                  <div className="text-xs" style={{ color: m.color }}>
                    {Math.round((m.consumed / m.target) * 100)}% · {m.tip}
                  </div>
                </div>
              ))}
            </div>

            {/* Focused metric for goal */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-2">减脂关注指标</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "添加糖", consumed: 18, target: 50, unit: "g", warn: false },
                  { label: "钠摄入", consumed: 1450, target: 2000, unit: "mg", warn: false },
                  { label: "饱和脂肪", consumed: 14, target: 20, unit: "g", warn: false },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                    <div className="flex items-end gap-1">
                      <span className="text-sm font-semibold text-gray-800">{item.consumed}</span>
                      <span className="text-xs text-gray-400 mb-0.5">/{item.target}{item.unit}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full"
                        style={{ width: `${(item.consumed / item.target) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Reminders */}
          <div className="space-y-2">
            {reminders.length === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-xl border bg-gray-50 border-gray-200">
                <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">今日营养数据已更新</p>
              </div>
            )}
            {reminders.map((r: any, i: number) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${r.bg}`}>
                <r.icon size={16} className={`${r.color} mt-0.5 flex-shrink-0`} />
                <p className="text-sm text-gray-700">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Add */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-700">快捷添加</h3>
          <button
            onClick={() => navigate("/record")}
            className="text-sm text-green-600 flex items-center gap-1 hover:text-green-700"
          >
            更多选项 <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <button
            onClick={() => navigate("/record")}
            className="flex flex-col items-center gap-2 p-3 border-2 border-dashed border-green-300 rounded-xl hover:bg-green-50 transition-colors text-green-600"
          >
            <Camera size={20} />
            <span className="text-xs">拍照识别</span>
          </button>
          <button
            onClick={() => navigate("/record")}
            className="flex flex-col items-center gap-2 p-3 border-2 border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition-colors text-blue-600"
          >
            <Search size={20} />
            <span className="text-xs">搜索食物</span>
          </button>
          {quickFoods.map((f) => (
            <button
              key={f.name}
              className="flex flex-col items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors relative overflow-hidden"
            >
              <img src={f.img} alt={f.name} className="w-10 h-10 rounded-lg object-cover" />
              <span className="text-xs text-gray-700">{f.name}</span>
              <span className="text-xs text-gray-400">{f.cal}kcal/{f.per}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Meals */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-700">今日饮食记录</h3>
          <div className="text-sm text-gray-400">共 {calorieConsumed} kcal</div>
        </div>
        <div className="space-y-3">
          {meals.map((meal) => (
            <div key={meal.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">{meal.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-800">{meal.type}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={11} /> {meal.time} · {meal.foods.length} 种食物
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-700">{meal.calories} kcal</div>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-gray-400 transition-transform ${expandedMeal === meal.id ? "rotate-90" : ""}`}
                />
              </button>

              {expandedMeal === meal.id && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {meal.foods.map((food, fi) => (
                    <div key={fi} className="flex items-center gap-3 px-4 py-3 bg-gray-50/50">
                      <img src={food.img} alt={food.name} className="w-10 h-10 rounded-lg object-cover" />
                      <div className="flex-1">
                        <div className="text-sm text-gray-800">{food.name}</div>
                        <div className="text-xs text-gray-400">{food.amount}</div>
                      </div>
                      <div className="text-sm font-medium text-gray-600">{food.cal} kcal</div>
                    </div>
                  ))}
                  <div className="px-4 py-2 flex justify-end">
                    <button
                      onClick={() => navigate("/record")}
                      className="text-xs text-green-600 flex items-center gap-1 hover:text-green-700"
                    >
                      <Plus size={12} /> 添加食物
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Dinner placeholder */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-green-300 hover:bg-green-50/50 transition-colors"
            onClick={() => navigate("/record")}
          >
            <span className="text-xl">🌙</span>
            <div className="flex-1">
              <div className="text-sm text-gray-500">晚餐</div>
              <div className="text-xs text-gray-400">尚未记录 · 点击添加</div>
            </div>
            <Plus size={16} className="text-green-500" />
          </div>
        </div>
      </div>

      {/* Weekly preview */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">本周健康摘要</h3>
            <p className="text-green-100 text-sm">目标达成率 78%，继续加油！</p>
          </div>
          <button
            onClick={() => navigate("/reports")}
            className="flex items-center gap-1 text-sm text-green-100 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            查看报告 <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["一", "二", "三", "四", "五", "六", "日"].map((day, i) => {
            const height = [65, 80, 72, 90, 78, 55, 0][i];
            const isToday = i === 6;
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <div className="relative w-full flex flex-col-reverse items-center" style={{ height: 48 }}>
                  <div
                    className="w-5 rounded-full transition-all"
                    style={{
                      height: `${height}%`,
                      backgroundColor: height === 0 ? "rgba(255,255,255,0.2)" : isToday ? "#fbbf24" : "rgba(255,255,255,0.7)",
                    }}
                  />
                </div>
                <div className={`text-xs ${isToday ? "text-yellow-300 font-semibold" : "text-green-100"}`}>
                  {day}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
