import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Search,
  QrCode,
  Upload,
  BookOpen,
  Star,
  Clock,
  Plus,
  ChevronRight,
  X,
  Check,
  Info,
  Shield,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  addRecord,
  copyRecordsToToday,
  deleteRecordItem,
  getFoodByBarcode,
  getRecordsByDate,
  recognizeFoodImage,
  searchFoods,
  updateRecordItem,
} from "../lib/api";

type Tab = "scan" | "photo" | "search" | "history";

type FoodResult = {
  id: number;
  name: string;
  brand: string;
  cal: number;
  protein: number;
  fat: number;
  carbs: number;
  per: string;
  score: number;
  img: string;
};

type ApiFood = {
  id: number;
  name: string;
  brand?: string | null;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  health_score?: number;
  image?: string | null;
};

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): {
    detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
  };
};

type ScanRuntime = {
  stream: MediaStream | null;
  timer: number | null;
  busy: boolean;
};

const DEFAULT_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop";

function mapFoodFromApi(f: ApiFood): FoodResult {
  return {
    id: f.id,
    name: f.name,
    brand: f.brand || "",
    cal: Number(f.calories || 0),
    protein: Number(f.protein || 0),
    fat: Number(f.fat || 0),
    carbs: Number(f.carbs || 0),
    per: "100g",
    score: Number(f.health_score ?? 7),
    img: f.image || DEFAULT_FOOD_IMAGE,
  };
}

const scoreColor = (s: number) =>
  s >= 8 ? "text-green-600 bg-green-50 border-green-200" :
  s >= 6 ? "text-yellow-600 bg-yellow-50 border-yellow-200" :
  s >= 4 ? "text-orange-600 bg-orange-50 border-orange-200" :
  "text-red-600 bg-red-50 border-red-200";

const scoreLabel = (s: number) =>
  s >= 8 ? "优秀" : s >= 6 ? "良好" : s >= 4 ? "一般" : "较差";

function FoodDetailModal({ food, onClose, onAdd }: {
  food: FoodResult;
  onClose: () => void;
  onAdd: (amount: number, meal: string) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [meal, setMeal] = useState("午餐");

  const factor = amount / 100;

  const additives = food.score < 7 ? [
    { name: "阿斯巴甜", level: "注意", color: "text-orange-600 bg-orange-50" },
    { name: "焦糖色素", level: "注意", color: "text-orange-600 bg-orange-50" },
    { name: "磷酸", level: "警告", color: "text-red-600 bg-red-50" },
  ] : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6">
      <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-3xl lg:rounded-t-2xl z-10">
          <h3 className="font-semibold text-gray-800">食物详情</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Food Info */}
          <div className="flex gap-4">
            <img src={food.img} alt={food.name} className="w-20 h-20 rounded-xl object-cover" />
            <div className="flex-1">
              <h2 className="text-gray-800 font-semibold text-lg">{food.name}</h2>
              {food.brand && <div className="text-sm text-gray-500">{food.brand}</div>}
              <div className="flex items-center gap-2 mt-2">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-sm font-semibold ${scoreColor(food.score)}`}>
                  <Shield size={12} /> {food.score}/10 · {scoreLabel(food.score)}
                </div>
                <div className="text-xs text-gray-400">NOVA 1类</div>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
              <Zap size={14} className="text-green-500" /> 评分维度
            </div>
            <div className="space-y-2">
              {[
                { label: "营养配比", score: food.score >= 8 ? 28 : food.score >= 6 ? 22 : 12, max: 30 },
                { label: "添加剂", score: food.score >= 8 ? 22 : food.score >= 6 ? 18 : 8, max: 25 },
                { label: "加工程度", score: food.score >= 8 ? 20 : 15, max: 20 },
                { label: "钠含量", score: food.score >= 8 ? 14 : 10, max: 15 },
                { label: "糖含量", score: food.score >= 8 ? 9 : 6, max: 10 },
              ].map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 w-16">{d.label}</div>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-400 rounded-full"
                      style={{ width: `${(d.score / d.max) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 w-10 text-right">{d.score}/{d.max}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nutrition */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">营养成分</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "热量", value: Math.round(food.cal * factor), unit: "kcal", color: "bg-red-50 border-red-100" },
                { label: "蛋白质", value: (food.protein * factor).toFixed(1), unit: "g", color: "bg-blue-50 border-blue-100" },
                { label: "脂肪", value: (food.fat * factor).toFixed(1), unit: "g", color: "bg-yellow-50 border-yellow-100" },
                { label: "碳水", value: (food.carbs * factor).toFixed(1), unit: "g", color: "bg-purple-50 border-purple-100" },
              ].map((n) => (
                <div key={n.label} className={`p-3 rounded-xl border text-center ${n.color}`}>
                  <div className="text-sm font-bold text-gray-800">{n.value}</div>
                  <div className="text-xs text-gray-500">{n.unit}</div>
                  <div className="text-xs text-gray-400">{n.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Additives Warning */}
          {additives.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-2">
                <AlertTriangle size={14} /> 添加剂提醒
              </div>
              <div className="flex flex-wrap gap-2">
                {additives.map((a) => (
                  <span key={a.name} className={`text-xs px-2 py-1 rounded-lg ${a.color}`}>
                    {a.name} · {a.level}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Amount & Meal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 block mb-1.5">份量</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAmount(Math.max(10, amount - 10))}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
                >
                  -
                </button>
                <div className="flex-1 text-center">
                  <span className="text-lg font-semibold text-gray-800">{amount}</span>
                  <span className="text-sm text-gray-400 ml-1">{food.per.replace(/\d+/, "")}</span>
                </div>
                <button
                  onClick={() => setAmount(amount + 10)}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1.5">餐次</label>
              <select
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none"
              >
                <option>早餐</option>
                <option>午餐</option>
                <option>晚餐</option>
                <option>加餐</option>
              </select>
            </div>
          </div>

          {/* Personalized tip */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
            <Info size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <span className="font-medium">减脂建议：</span>
              {food.score >= 7
                ? `${food.name}热量适中，蛋白质含量高，非常适合您的减脂目标。`
                : `该食品添加剂较多，建议适量食用，可用${food.name === "可口可乐" ? "无糖苏打水" : "天然食品"}替代。`}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-2">
            <button className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
              <Star size={16} /> 收藏
            </button>
            <button
              data-testid="add-food-button"
              onClick={() => onAdd(amount, meal)}
              className="flex-2 flex-grow py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-200"
            >
              <Plus size={16} /> 添加到{meal}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecordPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [historyDate, setHistoryDate] = useState(today);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMsg, setHistoryMsg] = useState<string | null>(null);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [amountEdits, setAmountEdits] = useState<Record<number, string>>({});
  const [scanCode, setScanCode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [recognizeErr, setRecognizeErr] = useState<string | null>(null);
  const [recognizeMsg, setRecognizeMsg] = useState<string | null>(null);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [cameraSupport, setCameraSupport] = useState(true);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanRuntimeRef = useRef<ScanRuntime>({ stream: null, timer: null, busy: false });

  const handleSearch = (q: string) => {
    setQuery(q);
    setSearching(true);
  };

  useEffect(() => {
    let active = true;
    searchFoods(query || "")
      .then((data: any[]) => {
        if (!active) return;
        const mapped = data.map((f) => mapFoodFromApi(f));
        setSearchResults(mapped);
      })
      .finally(() => {
        if (active) setSearching(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    if (tab !== "history") return;
    let active = true;
    setHistoryLoading(true);
    setHistoryErr(null);
    getRecordsByDate(historyDate)
      .then((data: any) => {
        if (!active) return;
        setHistoryData(data);
      })
      .catch((e: any) => {
        if (!active) return;
        setHistoryErr(String(e?.message || "历史记录加载失败"));
        setHistoryData({ meals: [] });
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, historyDate]);

  useEffect(() => {
    setRecognizeErr(null);
    setRecognizeMsg(null);
  }, [tab]);

  useEffect(() => {
    if (tab !== "scan" && cameraScanning) {
      stopCameraScan();
    }
  }, [tab, cameraScanning]);

  useEffect(() => () => stopCameraScan(), []);

  const filteredResults = searchResults;

  const openFoodDetail = (food: ApiFood) => {
    setSelectedFood(mapFoodFromApi(food));
  };

  const handleBarcodeRecognizeByCode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      setRecognizeErr("请输入条码后再识别");
      setRecognizeMsg(null);
      return;
    }
    setScanLoading(true);
    setRecognizeErr(null);
    try {
      const food: any = await getFoodByBarcode(code);
      openFoodDetail(food);
      setRecognizeMsg(`识别成功：${food.name}`);
    } catch (e: any) {
      setRecognizeErr(String(e?.message || "条码识别失败"));
      setRecognizeMsg(null);
    } finally {
      setScanLoading(false);
    }
  };

  const handleBarcodeRecognize = async () => handleBarcodeRecognizeByCode(scanCode);

  const stopCameraScan = () => {
    const rt = scanRuntimeRef.current;
    if (rt.timer !== null) {
      window.clearInterval(rt.timer);
      rt.timer = null;
    }
    if (rt.stream) {
      rt.stream.getTracks().forEach((track) => track.stop());
      rt.stream = null;
    }
    rt.busy = false;
    if (scanVideoRef.current) {
      scanVideoRef.current.srcObject = null;
    }
    setCameraScanning(false);
  };

  const startCameraScan = async () => {
    if (cameraScanning) return;
    setRecognizeErr(null);
    setRecognizeMsg(null);
    const detectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!detectorCtor) {
      setCameraSupport(false);
      setRecognizeErr("当前浏览器不支持实时扫码，请手动输入条码或上传图片");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      const video = scanVideoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      const detector = new detectorCtor({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
      });
      scanRuntimeRef.current.stream = stream;
      setCameraSupport(true);
      setCameraScanning(true);
      scanRuntimeRef.current.timer = window.setInterval(async () => {
        const rt = scanRuntimeRef.current;
        if (rt.busy || !scanVideoRef.current) return;
        rt.busy = true;
        try {
          const codes = await detector.detect(scanVideoRef.current);
          const value = String(codes?.[0]?.rawValue || "").trim();
          if (value) {
            setScanCode(value);
            stopCameraScan();
            void handleBarcodeRecognizeByCode(value);
          }
        } catch {
          // 识别失败时静默重试
        } finally {
          rt.busy = false;
        }
      }, 500);
    } catch (e: any) {
      stopCameraScan();
      setRecognizeErr(String(e?.message || "无法访问摄像头"));
    }
  };

  const handleImageSelect = async (file?: File | null) => {
    if (!file) return;
    setPhotoLoading(true);
    setRecognizeErr(null);
    try {
      const food: any = await recognizeFoodImage(file);
      openFoodDetail(food);
      setRecognizeMsg(`识别成功：${food.name}`);
    } catch (e: any) {
      setRecognizeErr(String(e?.message || "图片识别失败"));
      setRecognizeMsg(null);
    } finally {
      setPhotoLoading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const handleAdd = async (amount: number, meal: string) => {
    if (!selectedFood) return;
    await addRecord({
      meal_type: meal,
      items: [{ food_id: selectedFood.id, amount }],
    });
    setAddedIds([...addedIds, selectedFood.id]);
    setSelectedFood(null);
  };

  const tabs = [
    { id: "scan" as Tab, label: "扫码", icon: QrCode },
    { id: "photo" as Tab, label: "拍照", icon: Camera },
    { id: "search" as Tab, label: "搜索", icon: Search },
    { id: "history" as Tab, label: "历史", icon: Clock },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="camera-file-input"
        onChange={(e) => { void handleImageSelect(e.target.files?.[0]); }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="upload-file-input"
        onChange={(e) => { void handleImageSelect(e.target.files?.[0]); }}
      />
      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-all ${
              tab === t.id ? "bg-white text-green-700 shadow-sm font-medium" : "text-gray-500"
            }`}
          >
            <t.icon size={14} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Scan Tab */}
      {tab === "scan" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="relative bg-gray-900 aspect-square max-h-80 overflow-hidden">
              {cameraScanning ? (
                <video
                  ref={scanVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="relative">
                    <div className="w-48 h-48 border-2 border-green-400 rounded-2xl relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-green-400 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 text-gray-300 text-sm">将条形码/二维码对准框内</div>
            </div>
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500 mb-3">支持商品条形码、二维码扫描</p>
              <div className="space-y-3">
                <button
                  data-testid="scan-camera-btn"
                  onClick={() => { void (cameraScanning ? stopCameraScan() : startCameraScan()); }}
                  className={`w-full py-2.5 rounded-xl text-sm transition-colors ${
                    cameraScanning ? "bg-gray-200 text-gray-700 hover:bg-gray-300" : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                >
                  {cameraScanning ? "停止扫描" : "开始扫描"}
                </button>
                <input
                  data-testid="scan-code-input"
                  type="text"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="输入条形码，例如 690000001"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-green-400"
                />
                <button
                  data-testid="scan-recognize-btn"
                  onClick={() => { void handleBarcodeRecognize(); }}
                  disabled={scanLoading || cameraScanning}
                  className="w-full py-2.5 bg-green-500 text-white rounded-xl text-sm hover:bg-green-600 transition-colors disabled:bg-green-300"
                >
                  {scanLoading ? "识别中..." : "识别条码"}
                </button>
                <button
                  onClick={() => setTab("photo")}
                  className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  上传图片
                </button>
              </div>
              {!cameraSupport && <div className="mt-3 text-xs text-orange-600">当前环境不支持实时扫码，已回退到手动条码识别</div>}
              {recognizeMsg && <div className="mt-3 text-xs text-green-600">{recognizeMsg}</div>}
              {recognizeErr && <div className="mt-3 text-xs text-red-500">{recognizeErr}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Photo Tab */}
      {tab === "photo" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <div className="w-24 h-24 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Camera size={40} className="text-green-500" />
            </div>
            <h3 className="text-gray-700 font-medium mb-1">拍照识别食物</h3>
            <p className="text-sm text-gray-500 mb-6">拍摄食物照片或配料表，AI 自动识别营养成分</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="photo-camera-btn"
                onClick={() => cameraInputRef.current?.click()}
                disabled={photoLoading}
                className="py-3 bg-green-500 text-white rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-green-600 transition-colors disabled:bg-green-300"
              >
                <Camera size={16} /> {photoLoading ? "识别中..." : "拍照识别"}
              </button>
              <button
                data-testid="photo-upload-btn"
                onClick={() => uploadInputRef.current?.click()}
                disabled={photoLoading}
                className="py-3 border border-gray-200 text-gray-600 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:text-gray-400 disabled:border-gray-100"
              >
                <Upload size={16} /> 上传图片
              </button>
            </div>
            {recognizeMsg && <div className="mt-3 text-xs text-green-600">{recognizeMsg}</div>}
            {recognizeErr && <div className="mt-3 text-xs text-red-500">{recognizeErr}</div>}
          </div>

          {/* Demo result */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium mb-4">
              <Check size={14} className="bg-green-500 text-white rounded-full p-0.5" /> 识别成功示例
            </div>
            <div className="flex gap-4">
              <img
                src="https://images.unsplash.com/photo-1642339800099-921df1a0a958?w=80&h=80&fit=crop"
                alt="food"
                className="w-20 h-20 rounded-xl object-cover"
              />
              <div className="flex-1">
                <div className="text-gray-800 font-semibold">健康沙拉碗</div>
                <div className="text-sm text-gray-500">预计重量：约 350g</div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">320 kcal</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">蛋白质 18g</span>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">健康评分 8.5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Tab */}
      {tab === "search" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              data-testid="food-search-input"
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="搜索食物名称、品牌..."
              className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-green-400 shadow-sm"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setSearching(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Categories */}
          {!query && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {["全部", "主食", "肉类", "蔬菜", "水果", "乳制品", "坚果", "饮品", "零食"].map((c) => (
                <button
                  key={c}
                  onClick={() => handleSearch(c === "全部" ? "" : c)}
                  className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="space-y-2">
            {filteredResults.map((food) => (
              <div
                key={food.id}
                data-testid={`food-result-${food.id}`}
                onClick={() => setSelectedFood(food)}
                className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 cursor-pointer hover:border-green-300 hover:shadow-md transition-all"
              >
                <img src={food.img} alt={food.name} className="w-14 h-14 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-800 truncate">{food.name}</div>
                    <div className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded border font-semibold ${scoreColor(food.score)}`}>
                      {food.score}分
                    </div>
                  </div>
                  {food.brand && <div className="text-xs text-gray-400">{food.brand}</div>}
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>🔥 {food.cal} kcal</span>
                    <span>蛋白 {food.protein}g</span>
                    <span>脂肪 {food.fat}g</span>
                    <span className="text-gray-400">/{food.per}</span>
                  </div>
                </div>
                {addedIds.includes(food.id) ? (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-green-600" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 hover:bg-green-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Plus size={14} className="text-gray-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-gray-700 font-medium flex items-center gap-2">
                <Clock size={16} className="text-green-500" /> 历史记录
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700"
                />
                <button
                  onClick={async () => {
                    if (historyDate === today) {
                      setHistoryMsg("当前已是今天，无需复制");
                      setHistoryErr(null);
                      return;
                    }
                    try {
                      await copyRecordsToToday(historyDate);
                      setHistoryMsg("已复制到今天");
                      setHistoryErr(null);
                    } catch (e: any) {
                      setHistoryErr(String(e?.message || "复制失败"));
                    }
                  }}
                  className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600"
                >
                  复制到今天
                </button>
              </div>
            </div>

            {historyLoading && <div className="text-sm text-gray-500">正在加载...</div>}
            {!historyLoading && (historyData?.meals || []).length === 0 && (
              <div className="text-sm text-gray-500">该日期暂无记录</div>
            )}

            <div className="space-y-3">
              {(historyData?.meals || []).map((meal: any, idx: number) => (
                <div key={`${meal.meal_type}-${idx}`} className="border border-gray-100 rounded-xl p-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">{meal.meal_type}</div>
                  <div className="space-y-2">
                    {(meal.foods || []).map((food: any) => {
                      const itemId = Number(food.record_item_id || 0);
                      const currentAmount = Number(String(food.amount || "0").replace(/[^\d.]/g, "")) || 0;
                      const editValue = amountEdits[itemId] ?? String(currentAmount);
                      return (
                        <div key={`${itemId}-${food.id}`} className="flex items-center gap-2">
                          <img src={food.image} alt={food.name} className="w-10 h-10 rounded-lg object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800 truncate">{food.name}</div>
                            <div className="text-xs text-gray-400">{food.calories} kcal</div>
                          </div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editValue}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                              setAmountEdits((prev) => ({ ...prev, [itemId]: raw }));
                            }}
                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs text-center"
                          />
                          <span className="text-xs text-gray-500">g</span>
                          <button
                            onClick={async () => {
                              const nextAmount = Number(amountEdits[itemId] ?? currentAmount);
                              if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
                                setHistoryErr("份量必须大于0");
                                return;
                              }
                              try {
                                const data: any = await updateRecordItem(itemId, nextAmount);
                                setHistoryData(data);
                                setHistoryMsg("份量已更新");
                                setHistoryErr(null);
                              } catch (e: any) {
                                setHistoryErr(String(e?.message || "更新失败"));
                              }
                            }}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                          >
                            保存
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const data: any = await deleteRecordItem(itemId);
                                setHistoryData(data);
                                setHistoryMsg("记录已删除");
                                setHistoryErr(null);
                              } catch (e: any) {
                                setHistoryErr(String(e?.message || "删除失败"));
                              }
                            }}
                            className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                          >
                            删除
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {historyMsg && <div className="mt-3 text-xs text-green-600">{historyMsg}</div>}
            {historyErr && <div className="mt-3 text-xs text-red-500">{historyErr}</div>}
          </div>

          {/* Favorites */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-gray-700 font-medium mb-4 flex items-center gap-2">
              <Star size={16} className="text-yellow-500" /> 我的收藏
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {searchResults.slice(0, 4).map((food) => (
                <div
                  key={food.id}
                  onClick={() => setSelectedFood(food)}
                  className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl cursor-pointer hover:border-green-300 transition-colors"
                >
                  <img src={food.img} alt={food.name} className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{food.name}</div>
                    <div className="text-xs text-gray-400">{food.cal} kcal/{food.per}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Food Detail Modal */}
      {selectedFood && (
        <FoodDetailModal
          food={selectedFood}
          onClose={() => setSelectedFood(null)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
