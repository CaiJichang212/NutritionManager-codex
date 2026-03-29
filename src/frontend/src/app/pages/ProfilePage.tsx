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
import { bindContact, getMe, updateGoal, updateMe, updatePassword } from "../lib/api";

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
  weeklyTarget: 0.5,
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
  const [profileEditing, setProfileEditing] = useState(false);
  const [bodyEditing, setBodyEditing] = useState(false);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [userInfo, setUserInfo] = useState(defaultUser);
  const [displayName, setDisplayName] = useState(defaultUser.name);
  const [initialWeight, setInitialWeight] = useState(defaultUser.weight);
  const [height, setHeight] = useState(defaultUser.height);
  const [weight, setWeight] = useState(defaultUser.weight);
  const [targetWeight, setTargetWeight] = useState(defaultUser.targetWeight);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [bindPhone, setBindPhone] = useState("");
  const [bindEmail, setBindEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityMsg, setSecurityMsg] = useState<string | null>(null);
  const [securityErr, setSecurityErr] = useState<string | null>(null);
  const [healthEditing, setHealthEditing] = useState(false);
  const [activityLevel, setActivityLevel] = useState(defaultUser.activity);
  const [healthConditionsText, setHealthConditionsText] = useState(healthConditions.join("、"));
  const [allergiesText, setAllergiesText] = useState(allergies.join("、"));
  const [healthMsg, setHealthMsg] = useState<string | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalTypeEdit, setGoalTypeEdit] = useState(defaultUser.goal);
  const [weeklyTargetEdit, setWeeklyTargetEdit] = useState(defaultUser.weeklyTarget);
  const [goalTargetInput, setGoalTargetInput] = useState(String(defaultUser.targetWeight));
  const [goalWeeklyInput, setGoalWeeklyInput] = useState(String(defaultUser.weeklyTarget));
  const [goalMsg, setGoalMsg] = useState<string | null>(null);
  const [goalErr, setGoalErr] = useState<string | null>(null);
  const bmi = (weight / ((height / 100) ** 2)).toFixed(1);

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
          weeklyTarget: data.weekly_target || defaultUser.weeklyTarget,
          bmi: data.bmi || defaultUser.bmi,
          bmr: data.bmr || defaultUser.bmr,
          tdee: data.tdee || defaultUser.tdee,
          dailyCalGoal: data.daily_calorie_goal || defaultUser.dailyCalGoal,
        };
        setUserInfo(mapped);
        setDisplayName(mapped.name);
        setInitialWeight(mapped.weight);
        setHeight(mapped.height);
        setWeight(mapped.weight);
        setTargetWeight(mapped.targetWeight);
        setBindPhone(data.phone || "");
        setBindEmail(data.email || "");
        setActivityLevel(data.activity_level || defaultUser.activity);
        setHealthConditionsText((data.health_conditions || healthConditions).join("、"));
        setAllergiesText((data.allergies || allergies).join("、"));
        setGoalTypeEdit(data.goal_type || defaultUser.goal);
        setWeeklyTargetEdit(data.weekly_target || defaultUser.weeklyTarget);
        setGoalTargetInput(String(data.target_weight || defaultUser.targetWeight));
        setGoalWeeklyInput(String(data.weekly_target || defaultUser.weeklyTarget));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const bmiCategory = Number(bmi) < 18.5 ? "偏轻" : Number(bmi) < 24 ? "正常" : Number(bmi) < 28 ? "超重" : "肥胖";
  const weeklyTarget = Math.max(Number(userInfo.weeklyTarget) || 0.5, 0.1);
  const isLoseGoal = targetWeight < initialWeight;
  const isGainGoal = targetWeight > initialWeight;
  const goalVerb = isLoseGoal ? "减重" : isGainGoal ? "增重" : "体重维持";
  const totalGoalKg = Math.max(Math.abs(targetWeight - initialWeight), 0);
  const rawProgressKg = isLoseGoal ? initialWeight - weight : isGainGoal ? weight - initialWeight : 0;
  const progressKg = Math.max(rawProgressKg, 0);
  const completionPct = totalGoalKg > 0 ? Math.min((progressKg / totalGoalKg) * 100, 100) : 100;
  const etaWeeks = totalGoalKg > 0 ? Math.ceil((totalGoalKg - progressKg) / weeklyTarget) : 0;

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
              {profileEditing ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white/20 text-white text-xl font-bold rounded-lg px-2 py-0.5 outline-none placeholder:text-green-100"
                  placeholder="输入昵称"
                />
              ) : (
                <h2 className="text-white text-xl font-bold">{displayName}</h2>
              )}
              <button
                onClick={async () => {
                  if (profileEditing) {
                    try {
                      const data: any = await updateMe({ nickname: displayName });
                      setDisplayName(data.nickname || displayName);
                    } catch {}
                  }
                  setProfileEditing(!profileEditing);
                }}
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
            onClick={async () => {
              if (!bodyEditing) {
                setBodyError(null);
                setBodyEditing(true);
                return;
              }
              if (!Number.isFinite(height) || height <= 0) {
                setBodyError("身高必须是大于 0 的数字");
                return;
              }
              if (!Number.isFinite(weight) || weight < 0) {
                setBodyError("体重必须是非负数字");
                return;
              }
              if (!Number.isFinite(targetWeight) || targetWeight < 0) {
                setBodyError("目标体重必须是非负数字");
                return;
              }
              try {
                const [meData, goalData]: any = await Promise.all([
                  updateMe({ height, weight }),
                  updateGoal({ target_weight: targetWeight }),
                ]);
                setUserInfo((prev) => ({
                  ...prev,
                  name: displayName,
                  height: meData.height,
                  weight: meData.weight,
                  targetWeight: goalData.target_weight,
                  weeklyTarget: goalData.weekly_target ?? prev.weeklyTarget,
                  bmi: meData.bmi,
                  bmr: meData.bmr,
                  tdee: meData.tdee,
                  dailyCalGoal: meData.daily_calorie_goal,
                }));
                setHeight(meData.height);
                setWeight(meData.weight);
                setTargetWeight(goalData.target_weight);
                setBodyError(null);
                setBodyEditing(false);
              } catch {
                setBodyError("保存失败，请稍后重试");
              }
            }}
            className="text-sm text-green-600 flex items-center gap-1 hover:text-green-700"
          >
            <Edit2 size={12} /> {bodyEditing ? "保存" : "编辑"}
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "身高", value: `${height}`, unit: "cm", icon: Ruler, color: "bg-blue-50 text-blue-600", field: "height", editable: true },
            { label: "体重", value: `${weight}`, unit: "kg", icon: Scale, color: "bg-green-50 text-green-600", field: "weight", editable: true },
            { label: "BMI", value: bmi, unit: bmiCategory, icon: Activity, color: "bg-yellow-50 text-yellow-600", field: "bmi", editable: false },
            { label: "目标体重", value: `${targetWeight}`, unit: "kg", icon: Target, color: "bg-purple-50 text-purple-600", field: "targetWeight", editable: true },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 ${item.color.split(" ")[0]}`}>
                <item.icon size={20} className={item.color.split(" ")[1]} />
              </div>
              {item.editable && bodyEditing ? (
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="^\\d*(\\.\\d+)?$"
                  value={item.field === "height" ? height : item.field === "weight" ? weight : targetWeight}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                    const next = raw === "" ? 0 : Number(raw);
                    if (item.field === "height") setHeight(next);
                    if (item.field === "weight") setWeight(next);
                    if (item.field === "targetWeight") setTargetWeight(next);
                  }}
                  className="w-full text-center text-lg font-bold text-gray-800 border border-green-300 rounded-lg py-0.5 outline-none"
                />
              ) : (
                <div className="text-lg font-bold text-gray-800">{item.value}</div>
              )}
              <div className="text-xs text-gray-500">{item.label} · {item.unit}</div>
            </div>
          ))}
        </div>
        {bodyError && <div className="mt-3 text-sm text-red-500">{bodyError}</div>}

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
          <button
            onClick={async () => {
              if (!goalEditing) {
                setGoalErr(null);
                setGoalMsg(null);
                setGoalTargetInput(String(targetWeight));
                setGoalWeeklyInput(String(weeklyTarget));
                setGoalEditing(true);
                return;
              }
              const parsedTarget = Number(goalTargetInput.trim() || "0");
              const parsedWeekly = Number(goalWeeklyInput.trim() || "0");
              if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
                setGoalErr("目标体重必须是非负数字");
                return;
              }
              if (!Number.isFinite(parsedWeekly) || parsedWeekly <= 0) {
                setGoalErr("周目标必须大于0");
                return;
              }
              try {
                const data: any = await updateGoal({
                  goal_type: goalTypeEdit,
                  target_weight: parsedTarget,
                  weekly_target: parsedWeekly,
                });
                setUserInfo((prev) => ({
                  ...prev,
                  goal: data.goal_type || prev.goal,
                  targetWeight: data.target_weight ?? prev.targetWeight,
                  weeklyTarget: data.weekly_target ?? prev.weeklyTarget,
                  bmi: data.bmi ?? prev.bmi,
                  bmr: data.bmr ?? prev.bmr,
                  tdee: data.tdee ?? prev.tdee,
                  dailyCalGoal: data.daily_calorie_goal ?? prev.dailyCalGoal,
                }));
                setTargetWeight(data.target_weight ?? parsedTarget);
                setGoalTypeEdit(data.goal_type || goalTypeEdit);
                setWeeklyTargetEdit(data.weekly_target ?? parsedWeekly);
                setGoalTargetInput(String(data.target_weight ?? parsedTarget));
                setGoalWeeklyInput(String(data.weekly_target ?? parsedWeekly));
                setGoalErr(null);
                setGoalMsg("健康目标已保存");
                setGoalEditing(false);
              } catch (e: any) {
                setGoalErr(String(e?.message || "健康目标保存失败"));
              }
            }}
            className="text-sm text-green-600 hover:text-green-700"
          >
            {goalEditing ? "保存" : "修改"}
          </button>
        </div>
        {goalEditing && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <select
              value={goalTypeEdit}
              onChange={(e) => setGoalTypeEdit(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
            >
              {["减脂", "增肌", "健康管理", "维持"].map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={goalTargetInput}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                setGoalTargetInput(raw);
              }}
              placeholder="目标体重(kg)"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
            />
            <input
              type="text"
              inputMode="decimal"
              value={goalWeeklyInput}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                setGoalWeeklyInput(raw);
              }}
              placeholder="周目标(kg/周)"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "目标类型", value: goalEditing ? goalTypeEdit : userInfo.goal, icon: "🔥", active: true },
            { label: "目标速度", value: `${goalEditing ? weeklyTargetEdit : weeklyTarget} kg/周`, icon: "📉", active: false },
            { label: "当前进度", value: `${isLoseGoal ? "-" : isGainGoal ? "+" : ""}${progressKg.toFixed(1)} kg`, icon: "✅", active: false },
            { label: "预计完成", value: totalGoalKg <= 0 ? "已达目标" : `约${Math.max(etaWeeks, 0)}周`, icon: "📅", active: false },
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
            <span className="font-medium">进度：</span>
            {goalVerb} {progressKg.toFixed(1)} kg（目标 {totalGoalKg.toFixed(1)} kg），完成度 {Math.round(completionPct)}%
          </div>
          <div className="h-2 bg-green-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
        {goalMsg && <div className="mt-3 text-sm text-green-600">{goalMsg}</div>}
        {goalErr && <div className="mt-3 text-sm text-red-500">{goalErr}</div>}
      </div>

      {/* Health Info */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-700 flex items-center gap-2">
            <Heart size={16} className="text-red-400" /> 健康信息
          </h3>
          <button
            onClick={async () => {
              if (!healthEditing) {
                setHealthMsg(null);
                setHealthErr(null);
                setHealthEditing(true);
                return;
              }
              const splitItems = (s: string) =>
                s
                  .split(/[、,，]/)
                  .map((v) => v.trim())
                  .filter(Boolean);
              const nextConditions = splitItems(healthConditionsText);
              const nextAllergies = splitItems(allergiesText);
              try {
                const data: any = await updateMe({
                  activity_level: activityLevel,
                  health_conditions: nextConditions,
                  allergies: nextAllergies,
                });
                setUserInfo((prev) => ({
                  ...prev,
                  activity: data.activity_level || prev.activity,
                }));
                setActivityLevel(data.activity_level || activityLevel);
                setHealthConditionsText((data.health_conditions || nextConditions).join("、"));
                setAllergiesText((data.allergies || nextAllergies).join("、"));
                setHealthMsg("健康信息已保存");
                setHealthErr(null);
                setHealthEditing(false);
              } catch (e: any) {
                setHealthErr(String(e?.message || "健康信息保存失败"));
              }
            }}
            className="text-sm text-green-600 hover:text-green-700"
          >
            {healthEditing ? "保存" : "修改"}
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-500 mb-2">活动强度</div>
            {healthEditing ? (
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
              >
                {["久坐", "轻度活动", "中度活动", "高度活动", "极度活动"].map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{activityLevel}</span>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-2">健康状况</div>
            {healthEditing ? (
              <input
                value={healthConditionsText}
                onChange={(e) => setHealthConditionsText(e.target.value)}
                placeholder="多个项目用 逗号 或 顿号 分隔"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(healthConditionsText ? healthConditionsText.split(/[、,，]/).map((v) => v.trim()).filter(Boolean) : ["无特殊健康状况"]).map((c) => (
                  <span key={c} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{c}</span>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-2 flex items-center gap-1">
              <AlertCircle size={12} className="text-orange-400" /> 过敏史
            </div>
            {healthEditing ? (
              <input
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder="多个项目用 逗号 或 顿号 分隔"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(allergiesText ? allergiesText.split(/[、,，]/).map((v) => v.trim()).filter(Boolean) : ["无已知过敏"]).map((a) => (
                  <span key={a} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{a}</span>
                ))}
              </div>
            )}
          </div>
          {healthMsg && <div className="text-sm text-green-600">{healthMsg}</div>}
          {healthErr && <div className="text-sm text-red-500">{healthErr}</div>}
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

      {activeSection === "security" && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-5">
          <h3 className="text-gray-700">账户安全</h3>

          <div className="space-y-3">
            <div className="text-sm text-gray-600">绑定手机号/邮箱</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <input
                value={bindPhone}
                onChange={(e) => setBindPhone(e.target.value)}
                placeholder="手机号"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
              />
              <input
                value={bindEmail}
                onChange={(e) => setBindEmail(e.target.value)}
                placeholder="邮箱"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
              />
            </div>
            <button
              onClick={async () => {
                setSecurityMsg(null);
                setSecurityErr(null);
                try {
                  const data: any = await bindContact({
                    phone: bindPhone.trim() || undefined,
                    email: bindEmail.trim() || undefined,
                  });
                  setUserInfo((prev) => ({
                    ...prev,
                    phone: data.phone ? data.phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2") : prev.phone,
                    email: data.email || prev.email,
                  }));
                  setBindPhone(data.phone || bindPhone.trim());
                  setBindEmail(data.email || bindEmail.trim());
                  setSecurityMsg("联系方式绑定成功");
                } catch (e: any) {
                  setSecurityErr(String(e?.message || "联系方式绑定失败"));
                }
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm hover:bg-green-600"
            >
              保存联系方式
            </button>
          </div>

          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div className="text-sm text-gray-600">修改密码</div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="旧密码"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新密码（至少6位）"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="确认新密码"
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400"
              />
            </div>
            <button
              onClick={async () => {
                setSecurityMsg(null);
                setSecurityErr(null);
                if (newPassword !== confirmPassword) {
                  setSecurityErr("两次输入的新密码不一致");
                  return;
                }
                try {
                  await updatePassword({
                    old_password: oldPassword,
                    new_password: newPassword,
                  });
                  setOldPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setSecurityMsg("密码修改成功");
                } catch (e: any) {
                  setSecurityErr(String(e?.message || "密码修改失败"));
                }
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm hover:bg-green-600"
            >
              修改密码
            </button>
          </div>

          {securityMsg && <div className="text-sm text-green-600">{securityMsg}</div>}
          {securityErr && <div className="text-sm text-red-500">{securityErr}</div>}
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
