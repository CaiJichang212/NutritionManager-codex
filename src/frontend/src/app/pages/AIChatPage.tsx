import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, RefreshCw, Zap } from "lucide-react";
import { chatWithAI, getAIContext, getAIQuickQuestions } from "../lib/api";

type Message = {
  id: number;
  role: "user" | "ai";
  text: string;
  time: string;
};

type ContextItem = {
  key: string;
  label: string;
  value: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [quickQuestions, setQuickQuestions] = useState<string[]>([]);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadContext = async () => {
    setLoading(true);
    try {
      const [ctx, quick] = await Promise.all([getAIContext() as any, getAIQuickQuestions() as any]);
      const greet = String(ctx?.greeting || "你好，我是你的 AI 营养师。");
      setMessages([{ id: Date.now(), role: "ai", text: greet, time: "刚刚" }]);
      setContextItems(Array.isArray(ctx?.context_items) ? ctx.context_items : []);
      setQuickQuestions(Array.isArray(quick) ? quick : Array.isArray(ctx?.quick_questions) ? ctx.quick_questions : []);
    } catch {
      setMessages([{ id: Date.now(), role: "ai", text: "AI 服务暂不可用，请稍后重试。", time: "刚刚" }]);
      setContextItems([]);
      setQuickQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || isTyping) return;

    const userMsg: Message = { id: Date.now(), role: "user", text: content, time: "刚刚" };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);

    try {
      const history = nextMessages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
      const resp: any = await chatWithAI({ message: content, history });
      const aiText = String(resp?.reply || "已收到你的问题，但当前无法生成回答。");
      const aiMsg: Message = { id: Date.now() + 1, role: "ai", text: aiText, time: "刚刚" };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const aiMsg: Message = { id: Date.now() + 1, role: "ai", text: "请求失败，请检查网络或稍后重试。", time: "刚刚" };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const formatText = (text: string) =>
    text.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="font-semibold text-gray-800 mt-2">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith("• ") || line.startsWith("- ")) {
        return <p key={i} className="flex gap-2"><span>•</span><span>{line.slice(2)}</span></p>;
      }
      if (!line) return <div key={i} className="h-1" />;
      return <p key={i}>{line}</p>;
    });

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)] lg:max-h-[calc(100vh-64px)]">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-1.5">
            AI 营养师
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          <div className="text-xs text-gray-400">已接入后端真实数据上下文</div>
        </div>
        <button
          onClick={loadContext}
          className="ml-auto p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="刷新上下文"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div data-testid="ai-context-bar" className="bg-green-50 border-b border-green-100 px-4 py-2.5 flex items-center gap-4 text-xs text-green-700 flex-shrink-0 overflow-x-auto">
        {contextItems.map((item) => (
          <div key={item.key} className="flex items-center gap-1 whitespace-nowrap">
            <Zap size={12} /> {item.label} {item.value}
          </div>
        ))}
        {contextItems.length === 0 && <div className="text-green-700">上下文加载中...</div>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && messages.length === 0 && (
          <div className="text-sm text-gray-500">正在加载 AI 上下文...</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
              msg.role === "ai" ? "bg-gradient-to-br from-green-400 to-emerald-600" : "bg-gray-200"
            }`}>
              {msg.role === "ai" ? <Bot size={14} className="text-white" /> : <User size={14} className="text-gray-600" />}
            </div>

            <div className="max-w-[75%] lg:max-w-[60%]">
              <div
                className={`px-4 py-3 rounded-2xl text-sm space-y-0.5 ${
                  msg.role === "ai"
                    ? "bg-white border border-gray-100 shadow-sm text-gray-700 rounded-tl-sm"
                    : "bg-green-500 text-white rounded-tr-sm"
                }`}
              >
                {msg.role === "ai" ? formatText(msg.text) : <p>{msg.text}</p>}
              </div>
              <div className={`text-xs text-gray-400 mt-1 ${msg.role === "user" ? "text-right" : ""}`}>{msg.time}</div>
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

      {messages.length <= 2 && quickQuestions.length > 0 && (
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
