import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem("user");
  const isLoggedIn = localStorage.getItem("isLoggedIn");

  if (!user || isLoggedIn !== "true") {
    alert("Try Signing Up or Logging In");
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
