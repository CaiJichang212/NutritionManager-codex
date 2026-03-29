import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  ChevronRight,
  RefreshCw,
  BookOpen,
  Zap,
} from "lucide-react";

type Message = {
  id: number;
  role: "user" | "ai";
  text: string;
  time: string;
  typing?: boolean;
};

const quickQuestions = [
  "今天应该吃什么？",
  "我的蛋白质摄入够吗？",
  "如何加快减脂速度？",
  "推荐高蛋白低卡食物",
  "我今天热量超标了吗？",
  "晚餐吃什么比较健康？",
];

const initialMessages: Message[] = [
  {
    id: 1,
    role: "ai",
    text: "你好！我是你的 AI 营养师 🌿\n\n我已经了解你的基本情况：\n• 目标：减脂（目标体重 65kg）\n• 今日热量：1340 / 1870 kcal\n• 蛋白质：78 / 120g（65% - 偏低）\n\n有什么我可以帮助你的吗？",
    time: "刚刚",
  },
];

const aiResponses: Record<string, string> = {
  default: "根据你今天的饮食记录，我分析了你的营养状况。你今天的蛋白质摄入偏低，建议晚餐补充一些高蛋白食物，比如鸡胸肉或豆腐。热量还有 530 kcal 的空间，可以安排一顿均衡的晚餐。",
  "今天应该吃什么？": "根据你今天的营养数据分析：\n\n**晚餐建议：**\n• 🥩 鸡胸肉 150g（蛋白质 46g，热量 248 kcal）\n• 🥦 西兰花 200g（蛋白质 5g，热量 68 kcal）\n• 🍚 糙米饭 100g（碳水 26g，热量 113 kcal）\n\n这样晚餐约 430 kcal，帮你补充今天缺乏的蛋白质，同时不超过热量目标 ✅",
  "我的蛋白质摄入够吗？": "根据你的数据：\n\n❌ 当前蛋白质：78g（目标 120g）\n📊 完成率：65% - 偏低\n\n**对于你的减脂目标，蛋白质非常重要：**\n• 防止减脂时肌肉流失\n• 增加饱腹感\n• 建议摄入量：体重(72kg) × 1.6 = 115-120g/天\n\n**今天还需要补充 42g 蛋白质：**\n• 鸡胸肉 150g = 46g ✅\n• 希腊酸奶 150g = 18g\n• 蛋白粉 1勺 = 25g",
  "如何加快减脂速度？": "科学减脂建议（基于你的数据）：\n\n**1. 饮食策略 🍽**\n• 保持当前热量缺口（每天少 300-500 kcal）\n• 增加蛋白质到体重×1.6g\n• 控制精制碳水，选择低GI食物\n\n**2. 运动搭配 💪**\n• 每周3-4次力量训练\n• 每周150分钟有氧运动\n\n**3. 注意事项 ⚠️**\n• 减脂速度建议 0.5-1kg/周\n• 不要过度节食，会降低代谢\n• 保持充足睡眠（7-9小时）\n\n你目前的减脂进度是每周约 0.7kg，非常健康！",
  "推荐高蛋白低卡食物": "**高蛋白低卡食物推荐：**\n\n🥩 **动物蛋白（每100g）**\n• 鸡胸肉：165kcal / 31g蛋白\n• 虾仁：95kcal / 21g蛋白\n• 金枪鱼：130kcal / 29g蛋白\n• 蛋白：52kcal / 11g蛋白\n\n🌱 **植物蛋白（每100g）**\n• 豆腐（老）：80kcal / 8g蛋白\n• 鹰嘴豆：164kcal / 9g蛋白\n• 毛豆：122kcal / 11g蛋白\n\n🥛 **乳制品**\n• 希腊酸奶：65kcal / 10g蛋白\n• 低脂奶酪：98kcal / 14g蛋白",
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      text: text.trim(),
      time: "刚刚",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const aiResponse =
        aiResponses[text.trim()] || aiResponses["default"];

      const aiMsg: Message = {
        id: Date.now() + 1,
        role: "ai",
        text: aiResponse,
        time: "刚刚",
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1500 + Math.random() * 1000);
  };

  const formatText = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="font-semibold text-gray-800 mt-2">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith("• ") || line.startsWith("- ")) {
        return <p key={i} className="flex gap-2"><span>•</span><span>{line.slice(2)}</span></p>;
      }
      if (line === "") return <div key={i} className="h-1" />;
      return <p key={i}>{line}</p>;
    });
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)] lg:max-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-1.5">
            AI 营养师
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          <div className="text-xs text-gray-400">基于中国居民膳食指南 · 感知你的健康数据</div>
        </div>
        <button className="ml-auto p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Context Bar */}
      <div className="bg-green-50 border-b border-green-100 px-4 py-2.5 flex items-center gap-4 text-xs text-green-700 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Zap size={12} /> 今日热量 1340/1870 kcal
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Zap size={12} /> 蛋白质 78/120g
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Zap size={12} /> 目标：减脂
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Zap size={12} /> 连续打卡 14天
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
              msg.role === "ai"
                ? "bg-gradient-to-br from-green-400 to-emerald-600"
                : "bg-gray-200"
            }`}>
              {msg.role === "ai" ? (
                <Bot size={14} className="text-white" />
              ) : (
                <User size={14} className="text-gray-600" />
              )}
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] lg:max-w-[60%]`}>
              <div
                className={`px-4 py-3 rounded-2xl text-sm space-y-0.5 ${
                  msg.role === "ai"
                    ? "bg-white border border-gray-100 shadow-sm text-gray-700 rounded-tl-sm"
                    : "bg-green-500 text-white rounded-tr-sm"
                }`}
              >
                {msg.role === "ai" ? formatText(msg.text) : <p>{msg.text}</p>}
              </div>
              <div className={`text-xs text-gray-400 mt-1 ${msg.role === "user" ? "text-right" : ""}`}>
                {msg.time}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 2 && (
        <div className="px-4 py-3 flex-shrink-0">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Sparkles size={11} /> 快捷问题
          </div>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-full hover:bg-green-100 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2 focus-within:border-green-400 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="问我任何营养相关问题..."
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none resize-none"
              rows={1}
              style={{ minHeight: "20px", maxHeight: "80px" }}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
              input.trim() && !isTyping
                ? "bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-200"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-1.5 text-center">
          AI 建议仅供参考，如有特殊健康状况请咨询专业医生
        </div>
      </div>
    </div>
  );
}
