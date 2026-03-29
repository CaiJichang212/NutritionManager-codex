import { useState } from "react";
import {
  Users,
  Award,
  TrendingUp,
  Flame,
  Heart,
  Share2,
  UserPlus,
  Trophy,
  Star,
  CheckCircle2,
  Lock,
  ChevronRight,
  MessageCircle,
} from "lucide-react";

const leaderboard = [
  { rank: 1, name: "健康达人小红", avatar: "https://images.unsplash.com/photo-1676300186673-615bcc8d5d68?w=40&h=40&fit=crop", score: 9.2, streak: 45, medal: "🥇" },
  { rank: 2, name: "营养师阿豪", avatar: "https://images.unsplash.com/photo-1762631383378-115f2d4cbe07?w=40&h=40&fit=crop", score: 8.8, streak: 30, medal: "🥈" },
  { rank: 3, name: "瘦身成功晓晓", avatar: "https://images.unsplash.com/photo-1645545532196-e867a6ed4ad9?w=40&h=40&fit=crop", score: 8.5, streak: 28, medal: "🥉" },
  { rank: 4, name: "李明（我）", avatar: "https://images.unsplash.com/photo-1591530347006-82116c5bf6d9?w=40&h=40&fit=crop", score: 7.8, streak: 14, medal: "", isMe: true },
  { rank: 5, name: "运动爱好者强哥", avatar: "https://images.unsplash.com/photo-1772589668083-ae7b80e700ad?w=40&h=40&fit=crop", score: 7.5, streak: 12, medal: "" },
  { rank: 6, name: "减脂小队队长", avatar: "https://images.unsplash.com/photo-1642339800099-921df1a0a958?w=40&h=40&fit=crop", score: 7.2, streak: 9, medal: "" },
];

const allAchievements = [
  { id: 1, icon: "🔥", title: "连续记录7天", desc: "坚持记录饮食满7天", unlocked: true, unlockedDate: "2025-03-15" },
  { id: 2, icon: "🔥", title: "连续记录14天", desc: "坚持记录饮食满14天", unlocked: true, unlockedDate: "2025-03-22" },
  { id: 3, icon: "🔥", title: "连续记录30天", desc: "坚持记录饮食满30天", unlocked: false, progress: 14, total: 30 },
  { id: 4, icon: "🥗", title: "健康先锋", desc: "选择健康评分≥7的食品满50次", unlocked: true, unlockedDate: "2025-03-20" },
  { id: 5, icon: "💪", title: "蛋白质达人", desc: "连续7天蛋白质达标", unlocked: false, progress: 3, total: 7 },
  { id: 6, icon: "🎯", title: "目标达成者", desc: "连续5天达成热量目标", unlocked: false, progress: 2, total: 5 },
  { id: 7, icon: "🔍", title: "探索家", desc: "识别超过100种不同食品", unlocked: false, progress: 82, total: 100 },
  { id: 8, icon: "⭐", title: "完美一周", desc: "一周每天健康评分≥8", unlocked: false, progress: 4, total: 7 },
  { id: 9, icon: "🏆", title: "减脂冠军", desc: "成功减重达到目标", unlocked: false, progress: 46, total: 100 },
];

const friendPosts = [
  {
    id: 1,
    user: "健康达人小红",
    avatar: "https://images.unsplash.com/photo-1676300186673-615bcc8d5d68?w=40&h=40&fit=crop",
    time: "10分钟前",
    content: "今天的午餐超满足！鸡胸肉沙拉+全麦面包，热量只有450kcal，蛋白质38g，减脂期必备 💪",
    img: "https://images.unsplash.com/photo-1762631383378-115f2d4cbe07?w=400&h=250&fit=crop",
    likes: 24,
    comments: 8,
    score: 9.1,
  },
  {
    id: 2,
    user: "营养师阿豪",
    avatar: "https://images.unsplash.com/photo-1762631383378-115f2d4cbe07?w=40&h=40&fit=crop",
    time: "1小时前",
    content: "分享一个高蛋白早餐：燕麦+希腊酸奶+蓝莓，简单快手，蛋白质高达25g，强烈推荐！",
    img: "https://images.unsplash.com/photo-1645545532196-e867a6ed4ad9?w=400&h=250&fit=crop",
    likes: 56,
    comments: 15,
    score: 8.8,
  },
];

const checkinTypes = [
  { id: "record", label: "记录打卡", desc: "完成今日饮食记录", icon: "📝", done: true },
  { id: "healthy", label: "健康选择", desc: "选择评分≥7的食品", icon: "🥗", done: true },
  { id: "goal", label: "目标达成", desc: "达成今日营养目标", icon: "🎯", done: false },
];

export function SocialPage() {
  const [activeTab, setActiveTab] = useState<"checkin" | "achievement" | "leaderboard" | "feed">("checkin");
  const [likedPosts, setLikedPosts] = useState<number[]>([]);

  const unlockedCount = allAchievements.filter((a) => a.unlocked).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">社交激励</h1>
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <UserPlus size={14} /> 添加好友
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto gap-0.5">
        {[
          { id: "checkin" as const, label: "今日打卡" },
          { id: "achievement" as const, label: "成就系统" },
          { id: "leaderboard" as const, label: "好友榜单" },
          { id: "feed" as const, label: "健康动态" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-max py-2 px-3 rounded-lg text-sm transition-all ${
              activeTab === t.id ? "bg-white text-green-700 shadow-sm font-medium" : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Check-in Tab */}
      {activeTab === "checkin" && (
        <div className="space-y-4">
          {/* Streak */}
          <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-5xl">🔥</div>
              <div>
                <div className="text-white font-bold text-3xl">14</div>
                <div className="text-orange-100 text-sm">连续打卡天数</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-orange-100 text-sm">历史最高</div>
                <div className="text-white font-bold text-xl">21 天</div>
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: i < 14 ? "100%" : "0%" }}
                  />
                </div>
              ))}
              {Array.from({ length: 7 }, (_, i) => (
                <div key={`empty-${i}`} className="flex-1 h-2 bg-white/20 rounded-full" />
              ))}
            </div>
            <div className="text-orange-100 text-xs mt-2">再坚持 16 天，达成30天徽章 🏅</div>
          </div>

          {/* Today's Checkins */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-gray-700 mb-4">今日打卡</h3>
            <div className="space-y-3">
              {checkinTypes.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                    c.done ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="text-2xl">{c.icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{c.label}</div>
                    <div className="text-xs text-gray-500">{c.desc}</div>
                  </div>
                  {c.done ? (
                    <CheckCircle2 size={20} className="text-green-500" />
                  ) : (
                    <div className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600 cursor-pointer">
                      打卡
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Calendar */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-gray-700 mb-4">本月打卡日历</h3>
            <div className="grid grid-cols-7 gap-2">
              {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                <div key={d} className="text-center text-xs text-gray-400 pb-1">{d}</div>
              ))}
              {Array.from({ length: 31 }, (_, i) => {
                const day = i + 1;
                const isChecked = day <= 22 && day !== 8 && day !== 15;
                const isToday = day === 29;
                const isFuture = day > 29;
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs ${
                      isFuture ? "bg-gray-50 text-gray-300" :
                      isToday ? "bg-green-500 text-white font-bold" :
                      isChecked ? "bg-green-100 text-green-700" :
                      "bg-red-50 text-red-400"
                    }`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Achievements Tab */}
      {activeTab === "achievement" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-5 text-white flex items-center gap-4">
            <Trophy size={40} className="text-white" />
            <div>
              <div className="font-bold text-xl">{unlockedCount} / {allAchievements.length}</div>
              <div className="text-yellow-100 text-sm">已解锁成就</div>
            </div>
            <div className="ml-auto">
              <div className="text-right text-yellow-100 text-sm">完成度</div>
              <div className="font-bold text-xl">{Math.round((unlockedCount / allAchievements.length) * 100)}%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAchievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-4 rounded-2xl border transition-all ${
                  ach.unlocked
                    ? "bg-white border-yellow-200 shadow-sm"
                    : "bg-gray-50 border-gray-100"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`text-3xl ${!ach.unlocked && "grayscale opacity-50"}`}>{ach.icon}</div>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${ach.unlocked ? "text-gray-800" : "text-gray-400"}`}>
                      {ach.title}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{ach.desc}</div>
                    {ach.unlocked ? (
                      <div className="flex items-center gap-1 mt-2 text-xs text-yellow-600">
                        <Star size={10} className="fill-current" /> 已解锁 · {ach.unlockedDate}
                      </div>
                    ) : ach.progress !== undefined ? (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>进度 {ach.progress}/{ach.total}</span>
                          <span>{Math.round((ach.progress / ach.total) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full"
                            style={{ width: `${(ach.progress / ach.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                        <Lock size={10} /> 未解锁
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-green-500" /> 好友健康评分排行
            </h3>
            <div className="space-y-3">
              {leaderboard.map((user) => (
                <div
                  key={user.rank}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    user.isMe ? "bg-green-50 border border-green-200" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-7 text-center text-sm font-bold text-gray-500">
                    {user.medal || `#${user.rank}`}
                  </div>
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className={`w-10 h-10 rounded-full object-cover ${user.isMe ? "ring-2 ring-green-400" : ""}`}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{user.name}</div>
                    <div className="text-xs text-gray-400">连续打卡 {user.streak} 天 🔥</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${user.rank === 1 ? "text-yellow-600" : user.rank <= 3 ? "text-green-600" : "text-gray-700"}`}>
                      {user.score}
                    </div>
                    <div className="text-xs text-gray-400">健康评分</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feed Tab */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          {friendPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src={post.avatar} alt={post.user} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{post.user}</div>
                    <div className="text-xs text-gray-400">{post.time}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                    <Award size={10} /> {post.score}分
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{post.content}</p>
              </div>
              {post.img && (
                <img src={post.img} alt="food" className="w-full h-48 object-cover" />
              )}
              <div className="p-4 flex items-center gap-4 border-t border-gray-50">
                <button
                  onClick={() => {
                    setLikedPosts(prev =>
                      prev.includes(post.id) ? prev.filter(id => id !== post.id) : [...prev, post.id]
                    );
                  }}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${
                    likedPosts.includes(post.id) ? "text-red-500" : "text-gray-400 hover:text-red-400"
                  }`}
                >
                  <Heart size={15} className={likedPosts.includes(post.id) ? "fill-current" : ""} />
                  {post.likes + (likedPosts.includes(post.id) ? 1 : 0)}
                </button>
                <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-500 transition-colors">
                  <MessageCircle size={15} /> {post.comments}
                </button>
                <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-green-500 transition-colors ml-auto">
                  <Share2 size={15} /> 分享
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
