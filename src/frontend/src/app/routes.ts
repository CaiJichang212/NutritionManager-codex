import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RecordPage } from "./pages/RecordPage";
import { NutritionPage } from "./pages/NutritionPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AIChatPage } from "./pages/AIChatPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SocialPage } from "./pages/SocialPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: DashboardPage },
      { path: "record", Component: RecordPage },
      { path: "nutrition", Component: NutritionPage },
      { path: "reports", Component: ReportsPage },
      { path: "ai", Component: AIChatPage },
      { path: "profile", Component: ProfilePage },
      { path: "social", Component: SocialPage },
    ],
  },
]);
