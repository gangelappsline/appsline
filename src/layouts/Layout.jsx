/* eslint-disable react/prop-types */
import { useEffect } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";

const Layout = ({ title, children }) => {
  useEffect(() => { document.title = `${title} · Appsline`; }, [title]);
  return <div className="min-h-screen bg-[#080a0f]"><Header /><main>{children}</main><Footer /></div>;
};
export default Layout;
