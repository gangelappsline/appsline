import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import ProtectedRoute from "../components/ProtectedRoute";
import POSView from "../pages/POSView";
import LoginForm from "../pages/LoginForm";
import LogoutView from "../pages/LogoutView";
import ReportsView from "../pages/ReportsView";
import NotFound from "../pages/NotFound";
import OrdersView from "../pages/OrdersView";
import CategoriesView from "../pages/CategoriesView";
import ProductsView from "../pages/ProductsView";
import InventoryView from "../pages/ProductsView";

const Routes = () => {
  const { token } = useAuth();

  // Define public routes accessible to all users
  const routesForPublic = [
    {
      path: "/",
      element: <LoginForm />,
    },
    {
      path: "*",
      element: <NotFound />,
    },
  ];

  // Define routes accessible only to authenticated users
  const routesForAuthenticatedOnly = [
    {
      path: "/",
      element: <ProtectedRoute />, // Wrap the component in ProtectedRoute
      children: [
        {
          path: "pos",
          element: <POSView />,
        },
        {
          path: "/pos/orders",
          element: <OrdersView />,
        },
        {
          path: "/pos/categories",
          element: <CategoriesView />,
        },
        {
          path: "/pos/products",
          element: <ProductsView />,
        },
        {
          path: "/pos/inventory",
          element: <InventoryView />,
        },
        {
          path: "/profile",
          element: <div>User Profile</div>,
        },
        {
          path: "/logout",
          element: <LogoutView />,
        },
        {
          path: "/reports",
          element: <ReportsView />,
          children: [],
        },
      ],
    },
  ];

  // Define routes accessible only to non-authenticated users
  const routesForNotAuthenticatedOnly = [
    {
      path: "/",
      element: <LoginForm />,
    },
    {
      path: "*",
      element: <NotFound />,
    },
  ];

  // Combine and conditionally include routes based on authentication status
  const router = createBrowserRouter([
    ...routesForPublic,
    ...(!token ? routesForNotAuthenticatedOnly : []),
    ...routesForAuthenticatedOnly,
  ]);

  // Provide the router configuration using RouterProvider
  return <RouterProvider router={router} />;
};

export default Routes;
