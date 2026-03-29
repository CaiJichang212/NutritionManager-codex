import { useEffect, useState } from "react";
import {
  User,
  Target,
  Bell,
  Shield,
  ChevronRight,
  Edit2,
  LogOut,
  Activity,
  Scale,
  Ruler,
  Heart,
  AlertCircle,
  Check,
  Camera,
} from "lucide-react";
import { getMe, updateMe } from "../lib/api";

const defaultUser = {
  name: "李明",
  avatar: "https://images.unsplash.com/photo-1591530347006-82116c5bf6d9?w=100&h=100&fit=crop",
  phone: "138****8888",
  email: "liming@example.com",
  gender: "男",
  age: 28,
  height: 175,
  weight: 72,
  targetWeight: 65,
  activity: "中度活动",
  goal: "减脂",
  bmi: 23.5,
  bmr: 1756,
  tdee: 2370,
  dailyCalGoal: 1870,
};

const healthConditions = ["无特殊健康状况"];
const allergies = ["无已知过敏"];

const weekStats = [
  { label: "记录天数", value: "14", unit: "天", color: "text-green-600" },
  { label: "平均评分", value: "7.8", unit: "分", color: "text-yellow-600" },
  { label: "目标达成", value: "78%", unit: "", color: "text-blue-600" },
  { label: "已识别食物", value: "82", unit: "种", color: "text-purple-600" },
];

type Section = "basic" | "goal" | "health" | "notification" | "security";

function SectionItem({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between py-3 border-b border-gray-50 last:border-0 ${onClick ? "cursor-pointer hover:bg-gray-50 -mx-4 px-4 rounded-lg" : ""}`}
      onClick={onClick}
    >
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-800">{value}</span>}
        {onClick && <ChevronRight size={14} className="text-gray-400" />}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [userInfo, setUserInfo] = useState(defaultUser);
  const [weight, setWeight] = useState(defaultUser.weight);
  const bmi = (weight / ((userInfo.height / 100) ** 2)).toFixed(1);

  useEffect(() => {
    let active = true;
    getMe()
      .then((data: any) => {
        if (!active) return;
        const mapped = {
          name: data.nickname || "李明",
          avatar: data.avatar || defaultUser.avatar,
          phone: data.phone ? data.phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2") : defaultUser.phone,
          email: data.email || defaultUser.email,
          gender: data.gender || defaultUser.gender,
          age: data.age || defaultUser.age,
          height: data.height || defaultUser.height,
          weight: data.weight || defaultUser.weight,
          targetWeight: data.target_weight || defaultUser.targetWeight,
          activity: data.activity_level || defaultUser.activity,
          goal: data.goal_type || defaultUser.goal,
          bmi: data.bmi || defaultUser.bmi,
          bmr: data.bmr || defaultUser.bmr,
          tdee: data.tdee || defaultUser.tdee,
          dailyCalGoal: data.daily_calorie_goal || defaultUser.dailyCalGoal,
        };
        setUserInfo(mapped);
        setWeight(mapped.weight);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const bmiCategory = Number(bmi) < 18.5 ? "偏轻" : Number(bmi) < 24 ? "正常" : Number(bmi) < 28 ? "超重" : "肥胖";
  const bmiColor = Number(bmi) < 18.5 ? "text-blue-500" : Number(bmi) < 24 ? "text-green-600" : Number(bmi) < 28 ? "text-yellow-600" : "text-red-500";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={userInfo.avatar}
              alt="avatar"
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/30"
            />
            <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
              <Camera size={12} className="text-green-600" />
            </button>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-white text-xl font-bold">{userInfo.name}</h2>
              <button
                onClick={() => setEditing(!editing)}
                className="p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <Edit2 size={12} className="text-white" />
              </button>
            </div>
            <div className="text-green-100 text-sm mt-0.5">{userInfo.phone}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{userInfo.goal}</span>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{userInfo.activity}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mt-5 pt-5 border-t border-white/20">
          {weekStats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-white font-bold text-lg">{s.value}<span className="text-sm font-normal">{s.unit}</span></div>
              <div className="text-green-200 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Body Stats */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-700">身体数据</h3>
          <button
            onClick={() => {
              if (editing) {
                updateMe({ weight }).then((data: any) => {
                  setUserInfo((prev) => ({ ...prev, weight: data.weight, bmi: data.bmi, bmr: data.bmr, tdee: data.tdee, dailyCalGoal: data.daily_calorie_goal }));
                });
              }
              setEditing(!editing);
            }}
            className="text-sm text-green-600 flex items-center gap-1 hover:text-green-700"
          >
            <Edit2 size={12} /> {editing ? "保存" : "编辑"}
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "身高", value: `${userInfo.height}`, unit: "cm", icon: Ruler, color: "bg-blue-50 text-blue-600" },
            { label: "体重", value: `${weight}`, unit: "kg", icon: Scale, color: "bg-green-50 text-green-600", editable: true },
            { label: "BMI", value: bmi, unit: bmiCategory, icon: Activity, color: "bg-yellow-50 text-yellow-600" },
            { label: "目标体重", value: `${userInfo.targetWeight}`, unit: "kg", icon: Target, color: "bg-purple-50 text-purple-600" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 ${item.color.split(" ")[0]}`}>
                <item.icon size={20} className={item.color.split(" ")[1]} />
              </div>
              {item.editable && editing ? (
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full text-center text-lg font-bold text-gray-800 border border-green-300 rounded-lg py-0.5 outline-none"
                />
              ) : (
                <div className="text-lg font-bold text-gray-800">{item.value}</div>
              )}
              <div className="text-xs text-gray-500">{item.label} · {item.unit}</div>
            </div>
          ))}
        </div>

        {/* Calculated Values */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
          {[
            { label: "基础代谢(BMR)", value: `${userInfo.bmr} kcal` },
            { label: "每日总消耗(TDEE)", value: `${userInfo.tdee} kcal` },
            { label: "每日热量目标", value: `${userInfo.dailyCalGoal} kcal` },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-sm font-semibold text-gray-800">{item.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Health Goal */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-700 flex items-center gap-2">
            <Target size={16} className="text-green-500" /> 健康目标
          </h3>
          <button className="text-sm text-green-600 hover:text-green-700">修改</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "目标类型", value: "减脂", icon: "🔥", active: true },
            { label: "减脂速度", value: "0.5 kg/周", icon: "📉", active: false },
            { label: "当前进度", value: `-3.2 kg`, icon: "✅", active: false },
            { label: "预计完成", value: "约14周", icon: "📅", active: false },
          ].map((item) => (
            <div key={item.label} className={`p-3 rounded-xl border ${item.active ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"}`}>
              <div className="text-lg mb-1">{item.icon}</div>
              <div className="text-sm font-semibold text-gray-800">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-green-50 rounded-xl">
          <div className="text-sm text-green-700">
            <span className="font-medium">进度：</span>减重 3.2 kg（目标 7 kg），完成度 46%
          </div>
          <div className="h-2 bg-green-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: "46%" }} />
          </div>
        </div>
      </div>

      {/* Health Info */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-gray-700 mb-4 flex items-center gap-2">
          <Heart size={16} className="text-red-400" /> 健康信息
        </h3>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-500 mb-2">健康状况</div>
            <div className="flex flex-wrap gap-2">
              {healthConditions.map((c) => (
                <span key={c} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{c}</span>
              ))}
              <button className="px-3 py-1 border border-dashed border-gray-300 text-gray-400 rounded-full text-sm hover:border-green-300 hover:text-green-600 transition-colors">
                + 添加
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-2 flex items-center gap-1">
              <AlertCircle size={12} className="text-orange-400" /> 过敏史
            </div>
            <div className="flex flex-wrap gap-2">
              {allergies.map((a) => (
                <span key={a} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{a}</span>
              ))}
              <button className="px-3 py-1 border border-dashed border-gray-300 text-gray-400 rounded-full text-sm hover:border-orange-300 hover:text-orange-600 transition-colors">
                + 添加过敏原
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-gray-700 mb-3">设置</h3>
        <div className="space-y-0.5">
          {[
            { icon: Bell, label: "通知设置", value: "已开启", section: "notification" as Section },
            { icon: Shield, label: "账户安全", value: "手机号已绑定", section: "security" as Section },
            { icon: User, label: "隐私设置", value: "", section: "basic" as Section },
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => setActiveSection(activeSection === item.section ? null : item.section)}
              className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-xl transition-colors"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <item.icon size={15} className="text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-800">{item.label}</div>
                {item.value && <div className="text-xs text-gray-400">{item.value}</div>}
              </div>
              <ChevronRight size={15} className="text-gray-400" />
            </div>
          ))}
        </div>
      </div>

      {/* Notification Settings Expanded */}
      {activeSection === "notification" && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-gray-700 mb-4">通知设置</h3>
          <div className="space-y-3">
            {[
              { label: "热量超标提醒", enabled: true },
              { label: "营养素不足提醒", enabled: true },
              { label: "添加剂超标提醒", enabled: true },
              { label: "钠摄入超标提醒", enabled: true },
              { label: "糖摄入超标提醒", enabled: true },
              { label: "每日打卡提醒", enabled: false },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{n.label}</span>
                <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${n.enabled ? "bg-green-500" : "bg-gray-200"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${n.enabled ? "translate-x-5" : ""}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logout */}
      <button className="w-full py-3 border border-red-200 text-red-500 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors text-sm">
        <LogOut size={16} /> 退出登录
      </button>

      <div className="text-center text-xs text-gray-400 pb-2">
        营养健康管家 v8.1.1 · 数据仅用于健康参考
      </div>
    </div>
  );
}
