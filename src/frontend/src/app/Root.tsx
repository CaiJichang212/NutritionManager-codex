import { Outlet, NavLink, useLocation } from "react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  BarChart2,
  FileText,
  Bot,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  Settings,
  Leaf,
} from "lucide-react";

const navItems = [
  { to: "/", label: "首页", icon: LayoutDashboard, end: true },
  { to: "/record", label: "记录饮食", icon: PlusCircle },
  { to: "/nutrition", label: "营养数据", icon: BarChart2 },
  { to: "/reports", label: "数据报告", icon: FileText },
  { to: "/ai", label: "AI营养师", icon: Bot },
  { to: "/social", label: "社交互动", icon: Users },
  { to: "/profile", label: "个人中心", icon: User },
];

const bottomNavItems = [
  { to: "/", label: "首页", icon: LayoutDashboard, end: true },
  { to: "/record", label: "记录", icon: PlusCircle },
  { to: "/nutrition", label: "营养", icon: BarChart2 },
  { to: "/reports", label: "报告", icon: FileText },
  { to: "/profile", label: "我的", icon: User },
];

export function Root() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
            <Leaf size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold text-gray-800 leading-tight">营养健康管家</div>
              <div className="text-xs text-green-600">Nutrition Manager</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all group relative ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={18}
                    className={`flex-shrink-0 ${isActive ? "text-green-600" : "text-gray-500 group-hover:text-gray-700"}`}
                  />
                  {!collapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {item.label}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-gray-100 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>收起侧栏</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-white z-50 flex flex-col transition-transform duration-300 shadow-xl ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
              <Leaf size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">营养健康管家</div>
              <div className="text-xs text-green-600">Nutrition Manager</div>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="text-gray-500">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? "text-green-600" : "text-gray-500"} />
                  <span className="text-sm">{item.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <img
              src="https://images.unsplash.com/photo-1591530347006-82116c5bf6d9?w=40&h=40&fit=crop"
              className="w-8 h-8 rounded-full object-cover"
              alt="avatar"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">李明</div>
              <div className="text-xs text-gray-500">减脂计划进行中</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 p-1"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="hidden lg:block">
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </div>
            </div>
            <div className="lg:hidden">
              <div className="text-sm font-medium text-gray-800">
                {navItems.find((n) => n.to === location.pathname || (n.end && location.pathname === "/"))?.label || "营养健康管家"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button className="hidden lg:flex p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
              <Settings size={18} />
            </button>
            <img
              src="https://images.unsplash.com/photo-1591530347006-82116c5bf6d9?w=40&h=40&fit=crop"
              className="w-8 h-8 rounded-full object-cover cursor-pointer ring-2 ring-green-100"
              alt="avatar"
            />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-pb">
        <div className="flex items-center">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 px-1 transition-colors ${
                  isActive ? "text-green-600" : "text-gray-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.to === "/record" ? (
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-200 -mt-5">
                      <item.icon size={20} className="text-white" />
                    </div>
                  ) : (
                    <item.icon size={20} />
                  )}
                  <span style={{ fontSize: "11px" }}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* AI Float Button */}
      <NavLink
        to="/ai"
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 w-12 h-12 lg:w-14 lg:h-14 bg-green-500 rounded-full flex items-center justify-center shadow-xl shadow-green-300 hover:bg-green-600 transition-all hover:scale-105 z-30"
      >
        <Bot size={22} className="text-white" />
      </NavLink>
    </div>
  );
}
